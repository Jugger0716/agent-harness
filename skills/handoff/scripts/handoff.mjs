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
// document by hand.
//
// Adding a command: write one function from the parsed options to a plain object, and one line in
// COMMANDS below naming its options. Nothing else in this file changes.
import fs from 'node:fs'
import path from 'node:path'
import { InputError } from './lib/errors.mjs'
import { parseHandoff, stripEmphasis } from './lib/parse.mjs'
import { deriveNext } from './lib/next.mjs'
import { allowedRoots } from './lib/paths.mjs'
import { planReading } from './lib/reading.mjs'
import { carryFromDir, carryFromText, latestEpic } from './lib/ledger.mjs'
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
function cmdReadingPlan(opts) {
  if (!/^[1-9]\d{0,14}$/.test(opts.budget)) throw new UsageError('reading-plan: --budget must be a positive whole number of bytes')
  if (opts.root === '') throw new UsageError('reading-plan: --root must not be empty')
  const docPath = path.resolve(opts.doc)
  const parsed = parseHandoff(readDoc(docPath))
  return planReading(parsed.readingOrder, allowedRoots(docPath, opts.root), Number(opts.budget), docPath)
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
// read with one `**`/`__` pair and then one backtick pair removed, like the cells.
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
