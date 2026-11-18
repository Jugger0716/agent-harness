#!/usr/bin/env node
// Helper for the /handoff skill: reads and checks handoff documents so the skill's prose does not
// have to. One sub-command per job; every one prints ONE JSON object on stdout.
//
// Usage: node handoff.mjs <command> [--option value]...
//
// Exit codes: 0 success; 1 an input problem (a missing or unreadable file, a document that is not
// a handoff) with a message on stderr; 2 a usage problem (unknown command, missing or unknown
// option) or an internal error, also with a message on stderr. On any failure stdout stays empty.
// A caller that gets a non-zero exit must report it and stop — never fall back to reading the
// document by hand. The one exception is by design: `resolve-path` exits 1 with a message asking for
// an English kebab-case summary when its slug has no ASCII letter or digit; the caller writes one
// and runs it again (templates/handoff/generate.md Step 3).
//
// Adding a command: write one function from the parsed options to a plain object, and one line in
// COMMANDS below naming its options. Nothing else in this file changes.
import fs from 'node:fs'
import path from 'node:path'
import { InputError } from './lib/errors.mjs'
import { parseHandoff, stripEmphasis } from './lib/parse.mjs'
import { deriveNext } from './lib/next.mjs'
import { allowedRoots, nextDocName, normalizeSlug } from './lib/paths.mjs'
import { planReading } from './lib/reading.mjs'
import { carryFromDir, carryFromText, latestEpic } from './lib/ledger.mjs'
import { latestDoc, listDocs } from './lib/select.mjs'
import { drift, gitState, harnessState, requireFolder } from './lib/git.mjs'

class UsageError extends Error {}

function readDoc(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    throw new InputError(`cannot read ${file}: ${e.code || e.message}`)
  }
}

// ---- commands: (options) -> object -----------------------------------------------------------------

function cmdParse(opts) {
  return parseHandoff(readDoc(opts.doc))
}

// How a resume reads the document's Reading Order (lib/reading.mjs): per entry a status, the range to
// read and the bytes, within --budget bytes. The allowed roots come from where the document lives;
// --root (the session's folder) is a root only for a document that has none of its own.
// `doNot` is null unless the document's `Do NOT` section is only a pointer to another document (`doNotRefOnly`, parse.mjs).
// Then it is the plan entry for the `Do NOT` section of the document that section names — planned by the very same rule
// as a Reading Order entry (path rule, roots, real path, budget), apart from `entries`, and first, so the guardrails are
// not what the budget runs out on. A pointer that names no path comes back `skipped-invalid` with that reason.
function cmdReadingPlan(opts) {
  if (!/^[1-9]\d{0,14}$/.test(opts.budget)) throw new UsageError('reading-plan: --budget must be a positive whole number of bytes')
  if (opts.root === '') throw new UsageError('reading-plan: --root must not be empty')
  const docPath = path.resolve(opts.doc)
  const parsed = parseHandoff(readDoc(docPath))
  const roots = allowedRoots(docPath, opts.root)
  if (!parsed.doNotRefOnly) return { ...planReading(parsed.readingOrder, roots, Number(opts.budget), docPath), doNot: null }
  const pointed =
    parsed.doNotRef === null
      ? { raw: '', path: null, range: null, isFile: false, self: false }
      : { raw: `${parsed.doNotRef} §Do NOT`, path: parsed.doNotRef, range: { type: 'section', heading: 'Do NOT' }, isFile: true, self: false }
  const plan = planReading([pointed, ...parsed.readingOrder], roots, Number(opts.budget), docPath)
  const [doNot, ...entries] = plan.entries
  if (parsed.doNotRef === null) doNot.reason = 'the Do NOT section points to another document without naming a file'
  return { ...plan, entries, doNot }
}

// What a resume briefing prints on its `Next :` row and which slash-command tokens item 1 offers
// (lib/next.mjs). --state-relevant is `true` only when `harness-state` reported the live task state
// `relevant` at resume time, which is what lets the recorded `Docs` value name the next slice; left
// out it is `false`.
function cmdNext(opts) {
  const flag = opts['state-relevant']
  if (flag !== undefined && flag !== 'true' && flag !== 'false') throw new UsageError('next: --state-relevant must be true or false')
  return deriveNext(parseHandoff(readDoc(opts.doc)), { stateRelevant: flag === 'true' })
}

// The git facts of a folder (lib/git.mjs): branch, HEAD, every dirty path, the upstream distance.
function cmdGitState(opts) {
  requireFolder(opts.cwd, '--cwd')
  return gitState(path.resolve(opts.cwd))
}

// Whether the folder's `.harness/state.json` belongs to the session's current branch and is unfinished
// (lib/git.mjs). Read-only. --cwd defaults to the folder the command runs in.
function cmdHarnessState(opts) {
  if (opts.branch === '') throw new UsageError('harness-state: --branch must not be empty')
  const cwd = opts.cwd === undefined ? process.cwd() : opts.cwd
  requireFolder(cwd, '--cwd')
  return harnessState(path.resolve(cwd), opts.branch)
}

// How the git state of --cwd (or of the worktree the document recorded) compares with what the
// document recorded: branch, HEAD relationship, and the fate of the paths it listed as dirty.
function cmdDrift(opts) {
  const parsed = parseHandoff(readDoc(opts.doc))
  requireFolder(opts.cwd, '--cwd')
  return drift(parsed, path.resolve(opts.cwd))
}

// The rows of the Progress Ledger a new handoff starts from (lib/ledger.mjs): every unfinished row of one Epic
// and the most recent five finished ones, from ONE document (--doc: one the caller already knows) or from the
// newest document in a folder that holds rows of that Epic (--dir). Exactly one of the two is given; --epic is
// read with one `**`/`__` pair and then one backtick pair removed, like the cells. The output also says which
// document the rows came from (`doc`, null when none held the Epic), its file name (`pointer`), how many finished
// rows were left out (`droppedDone`), how many carried rows had a Status outside the enum (`unknownStatusRows`) or an
// empty Epic cell (`unattributedRows`), and whether that document itself carries an `Earlier rows:` line (`chained`).
function cmdLedgerCarry(opts) {
  const hasDoc = opts.doc !== undefined
  if (hasDoc === (opts.dir !== undefined)) throw new UsageError('ledger-carry: give exactly one of --doc and --dir')
  const epic = stripEmphasis(opts.epic)
  if (epic === '') throw new UsageError('ledger-carry: --epic must not be empty')
  if (hasDoc) return carryFromText(readDoc(opts.doc), epic, opts.doc)
  if (opts.dir === '') throw new UsageError('ledger-carry: --dir must not be empty')
  return carryFromDir(opts.dir, epic)
}

// The Epic a new handoff proposes (lib/ledger.mjs): the Epic of the last ledger row of the newest handoff
// document in a folder that has one, and that document's path; null and null when there is none.
function cmdLatestEpic(opts) {
  if (opts.dir === '') throw new UsageError('latest-epic: --dir must not be empty')
  return latestEpic(opts.dir)
}

// The file a new handoff document is written to (lib/paths.mjs): `<--dir>/<--date>-<slug>[-N].md` with `/`, where the
// slug is --slug normalised to `[a-z0-9-]`, at most 40 characters (the model supplies an English kebab-case summary;
// nothing is transliterated), and -N makes a taken name new. `slug` in the output is the normalised slug without -N;
// `normalized` says --slug changed. Nothing is created. A slug with no ASCII letter or digit is an input problem (exit
// 1, the message asks for an English summary); a --date that is not a calendar date written YYYY-MM-DD is a usage
// problem (exit 2), like any other malformed option value.
function isCalendarDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

function cmdResolvePath(opts) {
  if (opts.dir === '') throw new UsageError('resolve-path: --dir must not be empty')
  if (!isCalendarDate(opts.date)) throw new UsageError('resolve-path: --date must be a calendar date written YYYY-MM-DD')
  const slug = normalizeSlug(opts.slug)
  if (slug === '') {
    throw new InputError('resolve-path: the slug has no ASCII letter or digit and the helper does not transliterate; give an English kebab-case summary of the title (a-z, 0-9 and "-", at most 40 characters)')
  }
  const folder = opts.dir.replace(/\\/g, '/').replace(/\/+$/, '')
  return { path: `${folder}/${nextDocName(opts.dir, opts.date, slug)}`, slug, normalized: slug !== opts.slug }
}

// Every handoff document of a folder, newest first (lib/select.mjs): path, header values and file-name slug.
function cmdList(opts) {
  if (opts.dir === '') throw new UsageError('list: --dir must not be empty')
  return listDocs(opts.dir)
}

// The document a resume starts from (lib/select.mjs): the newest day's only document, or of its several the one furthest
// along (by the commits they record) among those that record --branch (the session's current branch, as git-state reports
// it) with a commit that is at or behind the HEAD of --cwd (default: the folder the command runs in); otherwise
// `needsChoice` and the candidates. Reads only --dir and --cwd; a document never names a folder or a program.
function cmdLatest(opts) {
  if (opts.dir === '') throw new UsageError('latest: --dir must not be empty')
  if (opts.branch === '') throw new UsageError('latest: --branch must not be empty')
  const cwd = opts.cwd === undefined ? process.cwd() : opts.cwd
  requireFolder(cwd, '--cwd')
  return latestDoc(opts.dir, opts.branch, path.resolve(cwd))
}

// name -> { options: every accepted --option, required: the ones that must be given, run }
const COMMANDS = {
  parse: { options: ['doc'], required: ['doc'], run: cmdParse },
  next: { options: ['doc', 'state-relevant'], required: ['doc'], run: cmdNext },
  'reading-plan': { options: ['doc', 'budget', 'root'], required: ['doc', 'budget'], run: cmdReadingPlan },
  'git-state': { options: ['cwd'], required: ['cwd'], run: cmdGitState },
  'harness-state': { options: ['branch', 'cwd'], required: ['branch'], run: cmdHarnessState },
  drift: { options: ['doc', 'cwd'], required: ['doc', 'cwd'], run: cmdDrift },
  'ledger-carry': { options: ['doc', 'dir', 'epic'], required: ['epic'], run: cmdLedgerCarry },
  'latest-epic': { options: ['dir'], required: ['dir'], run: cmdLatestEpic },
  'resolve-path': { options: ['slug', 'date', 'dir'], required: ['slug', 'date', 'dir'], run: cmdResolvePath },
  list: { options: ['dir'], required: ['dir'], run: cmdList },
  latest: { options: ['dir', 'branch', 'cwd'], required: ['dir', 'branch'], run: cmdLatest },
}

// ---- dispatch -----------------------------------------------------------------------------------------

function usage() {
  return `usage: node handoff.mjs <command> [--option value]...\ncommands: ${Object.keys(COMMANDS).join(', ')}`
}

function parseOptions(spec, name, argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (!t.startsWith('--')) throw new UsageError(`${name}: unexpected argument ${t}`)
    const key = t.slice(2)
    if (!spec.options.includes(key)) throw new UsageError(`${name}: unknown option ${t}`)
    if (i + 1 >= argv.length) throw new UsageError(`${name}: ${t} needs a value`)
    opts[key] = argv[++i]
  }
  for (const k of spec.required) if (!(k in opts)) throw new UsageError(`${name}: --${k} is required`)
  return opts
}

function main(argv) {
  const name = argv[0]
  if (name === undefined) throw new UsageError(usage())
  const spec = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : null
  if (!spec) throw new UsageError(`unknown command ${name}\n${usage()}`)
  return spec.run(parseOptions(spec, name, argv.slice(1)))
}

try {
  const result = main(process.argv.slice(2))
  process.stdout.write(JSON.stringify(result) + '\n')
} catch (e) {
  if (e instanceof InputError) {
    process.stderr.write(`handoff: ${e.message}\n`)
    process.exitCode = 1
  } else if (e instanceof UsageError) {
    process.stderr.write(`handoff: ${e.message}\n`)
    process.exitCode = 2
  } else {
    process.stderr.write(`handoff: internal error: ${e && e.message ? e.message : e}\n`)
    process.exitCode = 2
  }
}
