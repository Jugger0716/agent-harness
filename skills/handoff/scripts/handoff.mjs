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
import { parseHandoff } from './lib/parse.mjs'
import { deriveNext } from './lib/next.mjs'
import { allowedRoots } from './lib/paths.mjs'
import { planReading } from './lib/reading.mjs'

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
// read and the bytes, within --budget bytes. The allowed roots come from where the document lives.
function cmdReadingPlan(opts) {
  if (!/^[1-9]\d{0,14}$/.test(opts.budget)) throw new UsageError('reading-plan: --budget must be a positive whole number of bytes')
  const docPath = path.resolve(opts.doc)
  const parsed = parseHandoff(readDoc(docPath))
  return planReading(parsed.readingOrder, allowedRoots(docPath), Number(opts.budget), docPath)
}

// What a resume briefing prints on its `Next :` row and which slash-command tokens item 1 offers
// (lib/next.mjs). --state-relevant is `true` only when the live task state was found at resume time,
// which is what lets the recorded `Docs` value name the next slice; left out it is `false`.
function cmdNext(opts) {
  const flag = opts['state-relevant']
  if (flag !== undefined && flag !== 'true' && flag !== 'false') throw new UsageError('next: --state-relevant must be true or false')
  return deriveNext(parseHandoff(readDoc(opts.doc)), { stateRelevant: flag === 'true' })
}

// name -> { options: every accepted --option, required: the ones that must be given, run }
const COMMANDS = {
  parse: { options: ['doc'], required: ['doc'], run: cmdParse },
  next: { options: ['doc', 'state-relevant'], required: ['doc'], run: cmdNext },
  'reading-plan': { options: ['doc', 'budget'], required: ['doc', 'budget'], run: cmdReadingPlan },
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
