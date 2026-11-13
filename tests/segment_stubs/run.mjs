#!/usr/bin/env node
// Segment stub tests — runs every case in cases.mjs against the Workflow segment scripts under
// workflows/, using the stub engine in engine.mjs (no model, no network, no Workflow tool).
//
// A case's `ok` means the CORRECT behaviour was observed. known_failures.json lists the cases
// that are expected to fail today, keyed by case id with the SPEC appendix A defect number as
// the value. The list is a ratchet in both directions:
//
//   PASS        ok, not listed
//   KNOWN-FAIL  not ok, listed                                   (exit 0)
//   FAIL        not ok, not listed            -> a regression    (exit 1)
//   FIXED       ok, but still listed          -> remove the entry in the same change (exit 1)
//   STALE       listed id has no case, its defect differs from the case's, or it names
//               a representative-arguments case                                    (exit 1)
//   ERROR       the case threw, or returned no boolean `ok`
//                                             -> never blessable, listed or not   (exit 1)
//
// Exit 2 means the run could not start: duplicate case ids, or a known_failures.json that is not
// a JSON object.
//
// Usage: node tests/segment_stubs/run.mjs
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as engine from './engine.mjs'
import { cases } from './cases.mjs'

const KNOWN_PATH = fileURLToPath(new URL('./known_failures.json', import.meta.url))
let known
try {
  known = JSON.parse(fs.readFileSync(KNOWN_PATH, 'utf8'))
} catch (e) {
  console.log(`[segment stubs] known_failures.json is not valid JSON: ${e && e.message}`)
  process.exit(2)
}
if (known === null || typeof known !== 'object' || Array.isArray(known)) {
  console.log('[segment stubs] known_failures.json must be an object of { "<case id>": "<defect>" }')
  process.exit(2)
}

const ids = cases.map((c) => c.id)
const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dup.length) {
  console.log(`[segment stubs] duplicate case id(s): ${[...new Set(dup)].join(', ')}`)
  process.exit(2)
}

const tally = { pass: 0, known: 0, fail: 0, fixed: 0, stale: 0, error: 0 }
for (const c of cases) {
  const listed = Object.hasOwn(known, c.id)
  let status
  let detail
  try {
    const r = await c.check(engine)
    if (!r || typeof r.ok !== 'boolean') throw new Error('check() must resolve to { ok: boolean, detail }')
    detail = r.detail
    if (r.ok) status = listed ? 'FIXED' : 'PASS'
    else status = listed ? 'KNOWN-FAIL' : 'FAIL'
  } catch (e) {
    status = 'ERROR'
    detail = `case threw: ${e && e.message}`
  }
  tally[{ PASS: 'pass', 'KNOWN-FAIL': 'known', FAIL: 'fail', FIXED: 'fixed', ERROR: 'error' }[status]]++
  console.log(`${status.padEnd(10)} ${c.id} [${c.defect ?? '-'}] ${detail}`)
}

const byId = new Map(cases.map((c) => [c.id, c]))
for (const [id, defect] of Object.entries(known)) {
  const c = byId.get(id)
  if (!c) {
    tally.stale++
    console.log(`${'STALE'.padEnd(10)} ${id} [${defect}] listed in known_failures.json but no such case`)
  } else if (c.defect === null) {
    // A representative-arguments case can never be a known failure: listing one would hide a
    // script that no longer runs at all.
    tally.stale++
    console.log(`${'STALE'.padEnd(10)} ${id} [${defect}] a representative-arguments case cannot be listed as a known failure`)
  } else if (typeof defect !== 'string' || c.defect !== defect) {
    tally.stale++
    console.log(`${'STALE'.padEnd(10)} ${id} [${defect}] known_failures.json says ${JSON.stringify(defect)}, the case says ${c.defect}`)
  }
}

const covered = new Set(cases.filter((c) => c.defect === null).map((c) => c.script))
const uncovered = engine.listScripts().filter((s) => !covered.has(s))
console.log(
  `segment stubs: ${tally.pass} pass, ${tally.known} known-fail, ${tally.fail} fail, ` +
    `${tally.fixed} fixed, ${tally.stale} stale, ${tally.error} error; ` +
    `${uncovered.length} script(s) without a representative case`,
)
process.exit(tally.fail || tally.fixed || tally.stale || tally.error ? 1 : 0)
