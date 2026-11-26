#!/usr/bin/env node
// Handoff script tests — runs every case in cases.mjs against the shipped helper under
// skills/handoff/scripts/ (and the test-side corpus tools under tests/handoff/corpus/). No model,
// no network; the fixtures are invented text.
//
// A case is `{ id, run }`. `run` is async and throws (usually an assert) when the behaviour is
// wrong; it returns nothing on success. A thrown error is that case's FAIL — one broken module
// fails the cases that load it, it does not stop the run.
//
// Output: one `PASS id` / `FAIL id: why` line per case, then `N pass, M fail`.
// Exit codes: 0 every case passed; 1 at least one case failed; 2 the run could not start
// (duplicate case ids, or a cases module that cannot be loaded or exports no cases).
//
// Usage: node tests/handoff/run.mjs [<cases module>]
//   The optional argument replaces cases.mjs; the runner's own exit-code test uses it.
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const target = process.argv[2]
  ? pathToFileURL(path.resolve(process.argv[2])).href
  : new URL('./cases.mjs', import.meta.url).href

let cases
try {
  cases = (await import(target)).cases
} catch (e) {
  console.log(`[handoff tests] cannot load the cases module: ${e && e.message}`)
  process.exit(2)
}
if (!Array.isArray(cases) || cases.length === 0) {
  console.log('[handoff tests] the cases module exports no `cases` array')
  process.exit(2)
}

const ids = cases.map((c) => c.id)
const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dup.length) {
  console.log(`[handoff tests] duplicate case id(s): ${[...new Set(dup)].join(', ')}`)
  process.exit(2)
}

let pass = 0
let fail = 0
for (const c of cases) {
  try {
    await c.run()
    pass++
    console.log(`PASS ${c.id}`)
  } catch (e) {
    fail++
    const why = String((e && e.message) || e).split('\n').slice(0, 6).join('\n  ')
    console.log(`FAIL ${c.id}: ${why}`)
  }
}
console.log(`${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
