#!/usr/bin/env node
// Corpus measurement tool — measures the handoff documents frozen by snapshot.mjs, under the
// CURRENT (9.0.1) handoff contract. Reads only the snapshot folder (its manifest.json and the
// d###.md copies); it never touches a live work repository, so before/after runs are comparable.
//
// Usage:
//   node tests/handoff/corpus/measure.mjs --corpus <snapshot dir> [--json] [--mtime-before <ISO-8601>]
//
// Output: a Markdown table on stdout, or with --json an object { meta, metrics }. `--mtime-before`
// keeps only documents whose manifest mtime is earlier than the given instant (a date-time without
// an offset is read in local time); the table header and `meta` say so. Nothing here prints a
// path or a name. Nothing is CI-wired; it is run by hand.
//
// What is measured (the `Next :` origin metrics — in-progress / label / last row, and the
// label-vs-in-progress disagreement count — are NOT here; the `Next :` derivation lives in
// legacy_next.mjs, which wires them in):
//   - docs / docsByRoot      documents, and how many came from each 1-based root index.
//   - ro.*                   Reading Order entries as snapshot.mjs recorded them.
//   - readBytes / readLines  what one resume would read: per document the sum over Reading Order
//                            entries that (a) pass the handoff skill's inline path conditions
//                            (relative, no `..` segment, no `.git` segment; "inside the repo" is
//                            implied by resolving against the repo root), (b) exist, (c) are files,
//                            (d) are not the document itself, (e) are at most 2000 lines. Documents
//                            with nothing readable count as 0. This is the contract's Step 4 rule,
//                            NOT path_validator.md's stricter file_reference (d), which also rejects
//                            docs/harness/ — applying it would collapse the volume.
//   - cap.*                  share of those targets over 2000 lines (the contract skips them), and
//                            documents with at least one. capAudit.* is the same over the earlier
//                            audit's basis (every existing file entry, absolute and `..` ones and
//                            the document itself included) for comparison with its numbers.
//   - ledger.*               documents with a `## Progress Ledger` section (heading must START
//                            with `Progress Ledger`, case-sensitive), data rows of its first
//                            table (the two header lines are skipped), documents over 50 / 100
//                            rows, documents with 2 or more `in-progress` rows (Status cell with a
//                            surrounding `**`/`__` pair and then a backtick pair removed), and the
//                            ledger section's share of document bytes.
//   - fixed.*                documents whose `## In Progress` section carries all five fixed labels
//                            (Skill, Task, Phase, Mode, Docs), and how many of those record a
//                            `Docs` value under `docs/harness/`.
// Percentiles are nearest-rank as in the audit: sorted[min(n-1, floor(p*n))]; the median of an
// even count is the mean of the middle two. Sizes are raw bytes. Line counts are the snapshot's
// (`split('\n').length`).
//
// Exit codes: 0 ok, 1 a copy is missing or its sha256 differs from the manifest (the table is
// still printed), 2 usage or structural problem.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { splitSections, stripHint, isAbsoluteRef } from './snapshot.mjs'

export const LINE_CAP = 2000

// ---- statistics ------------------------------------------------------------------------------

export function median(a) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function percentile(a, p) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

const max = (a) => (a.length ? Math.max(...a) : null)
const sum = (a) => a.reduce((x, y) => x + y, 0)

// ---- document facts --------------------------------------------------------------------------

// `**x**` / `__x__`, then a backtick pair, removed; trimmed.
export function stripCell(c) {
  let v = (c || '').trim()
  let m
  if ((m = v.match(/^\*\*(.*)\*\*$/)) || (m = v.match(/^__(.*)__$/))) v = m[1].trim()
  if ((m = v.match(/^`(.*)`$/))) v = m[1].trim()
  return v
}

const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim())
const FIXED_LABELS = ['Skill', 'Task', 'Phase', 'Mode', 'Docs']

// -> { ledger: { present, rows, inProgress, bytes }, fixedAll, docsUnderHarness }
export function parseFacts(text) {
  const secs = splitSections(text)
  const facts = { ledger: { present: false, rows: 0, inProgress: 0, bytes: 0 }, fixedAll: false, docsUnderHarness: false }
  const pl = secs.find((s) => /^Progress Ledger/.test(s.heading))
  if (pl) {
    facts.ledger.present = true
    facts.ledger.bytes = Buffer.byteLength(pl.body.join('\n'))
    const tbl = pl.body.filter((l) => /^\s*\|/.test(l))
    if (tbl.length >= 2) {
      const hdr = cells(tbl[0]).map((h) => stripCell(h).toLowerCase())
      const iSt = hdr.indexOf('status')
      const data = tbl.slice(2)
      facts.ledger.rows = data.length
      facts.ledger.inProgress = data.filter((r) => stripCell(cells(r)[iSt]) === 'in-progress').length
    }
  }
  const ip = secs.find((s) => /^In Progress/.test(s.heading))
  const ipText = ip ? ip.body.join('\n') : ''
  facts.fixedAll = FIXED_LABELS.every((k) => new RegExp('^\\s*[-*]?\\s*`?' + k + '\\s*:', 'm').test(ipText))
  facts.docsUnderHarness = facts.fixedAll && /^\s*[-*]?\s*`?Docs\s*:\s*`?docs\/harness\//m.test(ipText)
  return facts
}

// The handoff skill's Step 4 inline conditions on a Reading Order path: relative, no `..`
// segment, outside `.git/`.
export function isContractReadable(raw) {
  const p = stripHint(raw).replace(/\\/g, '/')
  if (isAbsoluteRef(p)) return false
  const segs = p.split('/')
  return !segs.includes('..') && !segs.includes('.git')
}

// ---- corpus loading --------------------------------------------------------------------------

// Iterates the manifest's docs list (never the folder), re-hashes every copy.
// -> { manifest, docs: [{ ...manifestEntry, text, facts }], problems: string[] }
export function loadCorpus(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  if (manifest.schema !== 1 || !Array.isArray(manifest.docs)) throw new Error('unsupported manifest')
  const problems = []
  const docs = []
  for (const e of manifest.docs) {
    if (!/^d\d+\.md$/.test(e.file)) throw new Error(`bad file name in manifest: ${e.id}`)
    let buf
    try {
      buf = fs.readFileSync(path.join(dir, e.file))
    } catch {
      problems.push(`${e.id}: copy missing`)
      continue
    }
    if (crypto.createHash('sha256').update(buf).digest('hex') !== e.sha256) problems.push(`${e.id}: sha256 differs from the manifest`)
    const text = buf.toString('utf8')
    docs.push({ ...e, text, facts: parseFacts(text) })
  }
  return { manifest, docs, problems }
}

// ---- metrics ---------------------------------------------------------------------------------

const pctOf = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null)

function capStats(docs, pick) {
  let targets = 0
  let over = 0
  let docsWith = 0
  for (const d of docs) {
    const t = d.readingOrder.filter(pick)
    targets += t.length
    const o = t.filter((e) => e.lines > LINE_CAP).length
    over += o
    if (o) docsWith++
  }
  return { targets, over, overPct: pctOf(over, targets), docsWith, docsWithPct: pctOf(docsWith, docs.length) }
}

// -> ordered [{ key, label, value }]. A metric group that needs the `Next :` derivation is added
// here by the task that introduces legacy_next.mjs.
export function computeMetrics(docs) {
  const rows = []
  const add = (key, label, value) => rows.push({ key, label, value })
  const n = docs.length

  const byRoot = {}
  for (const d of docs) byRoot[d.rootIndex] = (byRoot[d.rootIndex] || 0) + 1
  add('docs', 'Documents', n)
  add('docsByRoot', 'Documents per root index', Object.entries(byRoot).map(([k, v]) => `${k}:${v}`).join(' '))

  const all = docs.flatMap((d) => d.readingOrder)
  const files = all.filter((e) => e.kind === 'path')
  add('ro.items', 'Reading Order list items', sum(docs.map((d) => d.readingOrderItems)))
  add('ro.entries', 'Reading Order file-like entries', files.length)
  add('ro.existingFiles', 'of which existing files', files.filter((e) => e.exists && !e.isDir).length)
  add('ro.dirs', 'of which directories', files.filter((e) => e.isDir).length)
  add('ro.missing', 'of which missing', files.filter((e) => !e.exists).length)
  add('ro.selfPath', 'of which resolving to the document itself', files.filter((e) => e.self).length)
  add('ro.invalidRefs', 'of which failing the inline path rule (absolute, `..`, `.git`)', files.filter((e) => !isContractReadable(e.raw)).length)

  const readable = (e) => e.kind === 'path' && isContractReadable(e.raw) && e.exists && !e.isDir && !e.self && e.lines != null
  const bytesPerDoc = []
  const linesPerDoc = []
  for (const d of docs) {
    const r = d.readingOrder.filter((e) => readable(e) && e.lines <= LINE_CAP)
    bytesPerDoc.push(sum(r.map((e) => e.bytes)))
    linesPerDoc.push(sum(r.map((e) => e.lines)))
  }
  add('readBytes.median', 'Resume read volume, bytes: median', median(bytesPerDoc))
  add('readBytes.p90', 'Resume read volume, bytes: P90', percentile(bytesPerDoc, 0.9))
  add('readBytes.max', 'Resume read volume, bytes: max', max(bytesPerDoc))
  add('readLines.median', 'Resume read volume, lines: median', median(linesPerDoc))
  add('readLines.p90', 'Resume read volume, lines: P90', percentile(linesPerDoc, 0.9))
  add('readLines.max', 'Resume read volume, lines: max', max(linesPerDoc))

  const cap = capStats(docs, readable)
  add('cap.targets', 'Readable targets (contract rule)', cap.targets)
  add('cap.over', `Targets over ${LINE_CAP} lines (skipped by the contract)`, cap.over)
  add('cap.overPct', 'Targets over the cap, %', cap.overPct)
  add('cap.docsWith', 'Documents with at least one over-cap target', cap.docsWith)
  add('cap.docsWithPct', 'Documents with an over-cap target, %', cap.docsWithPct)
  const aud = capStats(docs, (e) => e.kind === 'path' && e.exists && !e.isDir && e.lines != null)
  add('capAudit.targets', 'Existing file entries (audit basis)', aud.targets)
  add('capAudit.over', `Of them over ${LINE_CAP} lines (audit basis)`, aud.over)
  add('capAudit.overPct', 'Over the cap, % (audit basis)', aud.overPct)
  add('capAudit.docsWith', 'Documents with at least one over-cap entry (audit basis)', aud.docsWith)
  add('capAudit.docsWithPct', 'Documents with an over-cap entry, % (audit basis)', aud.docsWithPct)

  const L = docs.filter((d) => d.facts.ledger.present)
  const rowsPer = L.map((d) => d.facts.ledger.rows)
  const ipPer = L.map((d) => d.facts.ledger.inProgress)
  add('ledger.docs', 'Documents with a Progress Ledger', L.length)
  add('ledger.docsPct', 'Documents with a ledger, %', pctOf(L.length, n))
  add('ledger.rowsMedian', 'Ledger rows: median', median(rowsPer))
  add('ledger.rowsMax', 'Ledger rows: max', max(rowsPer))
  add('ledger.over50', 'Ledgers over 50 rows', rowsPer.filter((r) => r > 50).length)
  add('ledger.over100', 'Ledgers over 100 rows', rowsPer.filter((r) => r > 100).length)
  add('ledger.ipMulti', 'Ledgers with 2 or more in-progress rows', ipPer.filter((c) => c >= 2).length)
  add('ledger.ipMax', 'Most in-progress rows in one ledger', max(ipPer))
  add('ledger.shareAggregate', 'Ledger bytes / document bytes, ledger documents pooled, %', pctOf(sum(L.map((d) => d.facts.ledger.bytes)), sum(L.map((d) => d.bytes))))
  const shares = L.map((d) => d.facts.ledger.bytes / d.bytes)
  add('ledger.shareMedian', 'Ledger share of a document: median, %', shares.length ? Math.round(1000 * median(shares)) / 10 : null)
  add('ledger.shareOver50', 'Documents whose ledger is over half their bytes', shares.filter((s) => s > 0.5).length)

  const fx = docs.filter((d) => d.facts.fixedAll)
  add('fixed.docs', 'Documents recording all five fixed labels', fx.length)
  add('fixed.docsUnderHarness', 'of which Docs is under docs/harness/', fx.filter((d) => d.facts.docsUnderHarness).length)
  return rows
}

// ---- output ----------------------------------------------------------------------------------

function fmt(v) {
  if (v === null || v === undefined) return 'n/a'
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : String(v)
  return String(v)
}

export function renderTable(rows, header) {
  const out = [`# Handoff corpus metrics`, '', header, '', '| Metric | Value |', '|---|---:|']
  for (const r of rows) out.push(`| ${r.label} (\`${r.key}\`) | ${fmt(r.value)} |`)
  return out.join('\n') + '\n'
}

// ---- CLI -------------------------------------------------------------------------------------

function usage(msg) {
  if (msg) console.error(`measure: ${msg}`)
  console.error('usage: node tests/handoff/corpus/measure.mjs --corpus <snapshot dir> [--json] [--mtime-before <ISO-8601>]')
  process.exit(2)
}

function parseArgs(argv) {
  const a = { corpus: null, json: false, mtimeBefore: null }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--corpus') a.corpus = argv[++i] ?? null
    else if (t === '--json') a.json = true
    else if (t === '--mtime-before') a.mtimeBefore = argv[++i] ?? null
    else if (t === '-h' || t === '--help') usage()
    else usage(`unexpected argument ${t}`)
  }
  if (!a.corpus) usage('--corpus is required')
  if (a.mtimeBefore !== null && Number.isNaN(Date.parse(a.mtimeBefore))) usage('--mtime-before is not an ISO-8601 date-time')
  return a
}

function main(argv) {
  const args = parseArgs(argv)
  const dir = path.resolve(args.corpus)
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) usage('no manifest.json in --corpus')
  const { manifest, docs, problems } = loadCorpus(dir)
  const cutoff = args.mtimeBefore === null ? null : Date.parse(args.mtimeBefore)
  const picked = cutoff === null ? docs : docs.filter((d) => d.mtimeMs < cutoff)
  const rows = computeMetrics(picked)
  if (args.json) {
    const metrics = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const meta = { schema: 1, createdAt: manifest.createdAt, manifestCount: manifest.count, selected: picked.length, mtimeBefore: args.mtimeBefore, problems }
    console.log(JSON.stringify({ meta, metrics }, null, 1))
  } else {
    const sub = cutoff === null ? '' : `; subset: mtime before ${args.mtimeBefore}`
    process.stdout.write(renderTable(rows, `Snapshot of ${manifest.count} documents (taken ${manifest.createdAt})${sub}; measured ${picked.length}.`))
  }
  for (const p of problems) console.error(`measure: ${p}`)
  if (problems.length) process.exit(1)
}

function isMain() {
  if (!process.argv[1]) return false
  try { return pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url } catch { return false }
}

if (isMain()) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    // An fs error message carries the path it failed on; print the code only (no paths are printed).
    console.error(`measure: ${e && e.code ? `${e.code} (${e.syscall || 'fs'})` : e && e.message ? e.message : e}`)
    process.exit(1)
  }
}
