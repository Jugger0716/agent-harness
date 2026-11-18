#!/usr/bin/env node
// Before/after comparer over the frozen handoff corpus (see snapshot.mjs). Each `--what` names one
// comparison; a later change that alters what the shipped helper reads adds one entry to WHAT and
// is judged by running it against the same snapshot. Reads only the snapshot folder; never prints
// a path, a name or a document's text — only document ids (d001, …) and counts. Not CI-wired; it
// is run by hand, so human-readable stdout is allowed.
//
// Usage:
//   node tests/handoff/corpus/diff.mjs --corpus <snapshot dir> --what <name> [--json] [--mtime-before <ISO-8601>]
//
// What:
//   next-legacy    where the 9.0.1 `Next :` row comes from, per document (legacy_next.mjs): counts
//                  by source, and the same counts as the share of documents.
//   extract-agree  the Reading Order entries the shipped parser (skills/handoff/scripts/lib/
//                  parse.mjs) reads from each copy, against what the manifest recorded when the
//                  snapshot was taken: same item count, and the same kind and raw text entry by
//                  entry. Lists the ids that differ and where.
//
// Exit codes: 0 the comparison ran (a difference is a finding, printed, not a failure); 1 input
// problem — no or unreadable manifest.json, a copy that is missing or whose sha256 differs from
// the manifest, or a copy that is not a handoff document; 2 usage or internal error.
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { loadCorpus } from './measure.mjs'
import { InputError, exitOnError } from './snapshot.mjs'
import { deriveLegacyNext } from './legacy_next.mjs'

const SOURCES = ['in-progress', 'label', 'last-row', 'docs', 'step-one']

// ---- comparisons: (docs) -> { data, lines } --------------------------------------------------------

function nextLegacy(docs) {
  const counts = Object.fromEntries(SOURCES.map((s) => [s, 0]))
  for (const d of docs) counts[deriveLegacyNext(d.parsed).source]++
  const n = docs.length
  const lines = [`next-legacy: ${n} documents`]
  for (const s of SOURCES) lines.push(`  ${s.padEnd(12)} ${String(counts[s]).padStart(4)}  ${n ? (Math.round((1000 * counts[s]) / n) / 10).toFixed(1) : '-'}%`)
  return { data: { documents: n, counts }, lines }
}

// What the shipped parser reads as snapshot.mjs-style entries: [kind, raw] for the document
// itself and for every item with a path-like token.
const shippedEntries = (parsed) => parsed.readingOrder.filter((e) => e.self || e.isFile).map((e) => [e.self ? 'self' : 'path', e.raw])

function extractAgree(docs) {
  const differ = []
  for (const d of docs) {
    const want = d.readingOrder.map((e) => [e.kind, e.raw])
    const got = shippedEntries(d.parsed)
    let first = -1
    for (let i = 0; i < Math.max(want.length, got.length) && first < 0; i++) {
      if (!want[i] || !got[i] || want[i][0] !== got[i][0] || want[i][1] !== got[i][1]) first = i
    }
    const items = d.parsed.readingOrder.length
    if (first >= 0 || items !== d.readingOrderItems) {
      differ.push({ id: d.id, manifestEntries: want.length, shippedEntries: got.length, manifestItems: d.readingOrderItems, shippedItems: items, firstDifferentEntry: first < 0 ? null : first + 1 })
    }
  }
  const lines = [`extract-agree: ${docs.length} documents, ${docs.length - differ.length} agree, ${differ.length} differ`]
  for (const x of differ) {
    lines.push(`  ${x.id}: entries ${x.manifestEntries} (manifest) vs ${x.shippedEntries} (shipped), items ${x.manifestItems} vs ${x.shippedItems}, first difference at entry ${x.firstDifferentEntry ?? '-'}`)
  }
  return { data: { documents: docs.length, agree: docs.length - differ.length, differ }, lines }
}

export const WHAT = { 'next-legacy': nextLegacy, 'extract-agree': extractAgree }

// ---- CLI -------------------------------------------------------------------------------------------------

function usage(msg) {
  if (msg) console.error(`diff: ${msg}`)
  console.error(`usage: node tests/handoff/corpus/diff.mjs --corpus <snapshot dir> --what <${Object.keys(WHAT).join('|')}> [--json] [--mtime-before <ISO-8601>]`)
  process.exit(2)
}

function parseArgs(argv) {
  const a = { corpus: null, what: null, json: false, mtimeBefore: null }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--corpus') a.corpus = argv[++i] ?? null
    else if (t === '--what') a.what = argv[++i] ?? null
    else if (t === '--json') a.json = true
    else if (t === '--mtime-before') a.mtimeBefore = argv[++i] ?? null
    else if (t === '-h' || t === '--help') usage()
    else usage(`unexpected argument ${t}`)
  }
  if (!a.corpus) usage('--corpus is required')
  if (!a.what) usage('--what is required')
  if (!Object.hasOwn(WHAT, a.what)) usage(`unknown --what ${a.what}`)
  if (a.mtimeBefore !== null && Number.isNaN(Date.parse(a.mtimeBefore))) usage('--mtime-before is not an ISO-8601 date-time')
  return a
}

function main(argv) {
  const args = parseArgs(argv)
  const dir = path.resolve(args.corpus)
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw new InputError('no manifest.json in --corpus')
  const { docs, problems } = loadCorpus(dir)
  if (problems.length) throw new InputError(problems.join('; '))
  const cutoff = args.mtimeBefore === null ? null : Date.parse(args.mtimeBefore)
  const picked = cutoff === null ? docs : docs.filter((d) => d.mtimeMs < cutoff)
  const r = WHAT[args.what](picked)
  if (args.json) console.log(JSON.stringify({ what: args.what, ...r.data }, null, 1))
  else console.log(r.lines.join('\n'))
}

function isMain() {
  if (!process.argv[1]) return false
  try { return pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url } catch { return false }
}

if (isMain()) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    exitOnError('diff', e)
  }
}
