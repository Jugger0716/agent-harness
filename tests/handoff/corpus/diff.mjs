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
//   next           the label-first `Next :` rule (skills/handoff/scripts/lib/next.mjs, run as if the
//                  live task state were found) against the 9.0.1 one (legacy_next.mjs), per document:
//                  every change is put in one class — normalisation-only (a Slice cell or label value
//                  lost its ** / __ / backtick wrapper), became-label, became-ambiguous, became-
//                  docs-or-step-one (9.0.1 printed the ledger's last row, the slice that had just
//                  finished) or other, which is the class that must stay empty (an ambiguity counts
//                  only where 9.0.1 took the last of two or more in-progress rows). Also: whether the
//                  label wins in the documents where it and an in-progress row differed under 9.0.1,
//                  whether the documents with no label and one in-progress row kept their value,
//                  how many documents are ambiguous, what became of the last-row documents, and the
//                  same classes when the task state is NOT relevant (the Docs tier unused).
//                  Prints document ids and counts only.
//   extract-agree  the Reading Order entries the shipped parser (skills/handoff/scripts/lib/
//                  parse.mjs) reads from each copy, against what the manifest recorded when the
//                  snapshot was taken: same item count, and the same kind and raw text entry by
//                  entry. Lists the ids that differ and where.
//   reading        what `/handoff resume` would read under the reading plan (skills/handoff/scripts/
//                  lib/reading.mjs), simulated from the manifest's recorded bytes and lines: per-
//                  document read volume (median, P90, max) before any budget and after each
//                  candidate budget, the budget B the D3 rule gives (P90 rounded up to a multiple of
//                  16 KiB, capped at 128 KiB), how many entries are read in the shorter `partial` form
//                  or skipped for the budget, and the documents at the cap or reading nothing; plus
//                  the path-rule checks (a `Docs` value under docs/harness/ passes, an entry with a
//                  `..` or `.git` segment is rejected). Every number that rests on an estimate is
//                  counted in the output: the manifest holds sizes, not content or source paths.
//
// Exit codes: 0 the comparison ran (a difference is a finding, printed, not a failure); 1 input
// problem — no or unreadable manifest.json, a copy that is missing or whose sha256 differs from
// the manifest, or a copy that is not a handoff document; 2 usage or internal error.
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { loadCorpus, computeMetrics, median, percentile } from './measure.mjs'
import { InputError, exitOnError, stripHint } from './snapshot.mjs'
import { deriveLegacyNext, legacyTiers } from './legacy_next.mjs'
import { parseRange, stripEmphasis } from '../../../skills/handoff/scripts/lib/parse.mjs'
import { deriveNext } from '../../../skills/handoff/scripts/lib/next.mjs'
import { validateHandoffPath } from '../../../skills/handoff/scripts/lib/paths.mjs'
import { HEAD_LINES, OUTLINE_HEADING_BYTES, OUTLINE_MAX_ENTRIES, WHOLE_FILE_MAX_LINES, isMarkdownPath } from '../../../skills/handoff/scripts/lib/reading.mjs'

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

// ---- next: the label-first rule against 9.0.1 -----------------------------------------------------------

export const NEXT_CLASSES = ['unchanged', 'normalisation-only', 'became-label', 'became-ambiguous', 'became-docs-or-step-one', 'other']

// One document's change. `legacy` is { slice, source } from legacy_next.mjs, `now` the result of
// deriveNext (slice null = ambiguous), `legacyLiveRows` the number of in-progress rows in the
// Epic of the last row as 9.0.1 read it. A change that is none of the named ones is `other` — in
// particular an ambiguity counts as `became-ambiguous` only where 9.0.1 took the last of two or
// more in-progress rows; any other document that turns ambiguous is something unexplained.
export function classifyNextChange(legacy, now, { legacyLiveRows = 0 } = {}) {
  if (now.slice === null) return legacy.source === 'in-progress' && legacyLiveRows >= 2 ? 'became-ambiguous' : 'other'
  if (now.slice === legacy.slice) return 'unchanged'
  if (now.source === 'label' && legacy.source !== 'label') return 'became-label'
  if (legacy.source === 'last-row' && (now.source === 'docs' || now.source === 'step-one')) return 'became-docs-or-step-one'
  if (now.source === legacy.source && now.slice === stripEmphasis(legacy.slice)) return 'normalisation-only'
  return 'other'
}

// In-progress rows in the Epic of the last ledger row; `key` is the Epic cell as 9.0.1 read it
// (`epicRaw`) or as the new rule reads it (`epic`).
function liveRowCount(parsed, key) {
  const rows = parsed.ledger ? parsed.ledger.rows : []
  if (!rows.length) return 0
  const epic = rows[rows.length - 1][key]
  return rows.filter((r) => r[key] === epic && r.status === 'in-progress').length
}

function nextChange(docs) {
  const per = docs.map((d) => ({
    id: d.id,
    legacy: deriveLegacyNext(d.parsed),
    legacyLiveRows: liveRowCount(d.parsed, 'epicRaw'),
    liveRows: liveRowCount(d.parsed, 'epic'),
    hasLabel: d.parsed.stepOne.sliceLabel !== null,
    tiers: legacyTiers(d.parsed),
    label: stripEmphasis(d.parsed.stepOne.sliceLabel),
    relevant: deriveNext(d.parsed, { stateRelevant: true }),
    notRelevant: deriveNext(d.parsed, { stateRelevant: false }),
  }))
  const tally = (pick) => {
    const classes = Object.fromEntries(NEXT_CLASSES.map((c) => [c, 0]))
    const ids = Object.fromEntries(NEXT_CLASSES.filter((c) => c !== 'unchanged').map((c) => [c, []]))
    for (const x of per) {
      const c = classifyNextChange(x.legacy, x[pick], { legacyLiveRows: x.legacyLiveRows })
      classes[c]++
      if (c !== 'unchanged') ids[c].push(x.id)
    }
    return { classes, ids }
  }
  const main = tally('relevant')
  const apart = tally('notRelevant')

  // (a) the documents where the label and an in-progress row both existed and named other slices
  const both = per.filter((x) => x.tiers.label !== null && x.tiers.ledger && x.tiers.inProgress !== null)
  const differed = both.filter((x) => x.tiers.label !== x.tiers.inProgress)
  const labelCheck = {
    withLabelAndInProgress: both.length,
    valuesDiffered: differed.length,
    newIsLabel: differed.filter((x) => x.relevant.source === 'label' && x.relevant.slice === x.label).length,
  }

  // (b) the documents with no label and exactly one in-progress row keep their value
  const single = per.filter((x) => !x.hasLabel && x.liveRows === 1).map((x) => classifyNextChange(x.legacy, x.relevant, { legacyLiveRows: x.legacyLiveRows }))
  const noLabelOneInProgress = {
    documents: single.length,
    unchanged: single.filter((c) => c === 'unchanged').length,
    normalisationOnly: single.filter((c) => c === 'normalisation-only').length,
    other: single.filter((c) => c !== 'unchanged' && c !== 'normalisation-only').length,
  }

  const ambiguous = per.filter((x) => x.relevant.slice === null).length

  // (c) what became of the documents whose 9.0.1 value was the ledger's last row
  const last = per.filter((x) => x.legacy.source === 'last-row')
  const lastRow = {
    documents: last.length,
    valueChanged: last.filter((x) => x.relevant.slice !== x.legacy.slice).length,
    valueKept: last.filter((x) => x.relevant.slice === x.legacy.slice).length,
    nowDocs: last.filter((x) => x.relevant.source === 'docs').length,
    nowStepOne: last.filter((x) => x.relevant.source === 'step-one').length,
  }

  const stateNotRelevant = {
    valueChanges: per.filter((x) => x.notRelevant.slice !== x.relevant.slice).length,
    classes: apart.classes,
    otherIds: apart.ids.other,
  }

  const n = per.length
  const pct = (c) => (n ? `${(Math.round((1000 * c) / n) / 10).toFixed(1)}%` : '-')
  const lines = [`next: ${n} documents, the label-first rule against 9.0.1 (task state relevant)`]
  for (const c of NEXT_CLASSES) lines.push(`  ${c.padEnd(24)} ${String(main.classes[c]).padStart(4)}  ${pct(main.classes[c])}`)
  for (const c of NEXT_CLASSES) if (c !== 'unchanged' && main.ids[c].length) lines.push(`  ${c}: ${main.ids[c].join(' ')}`)
  lines.push(
    `label check: ${labelCheck.withLabelAndInProgress} ledger documents have a label and an in-progress row; the two named other slices in ${labelCheck.valuesDiffered}; the new Next : is the label value in ${labelCheck.newIsLabel} of those`,
    `check (b): ${noLabelOneInProgress.documents} documents have no label and exactly one in-progress row; their value is unchanged in ${noLabelOneInProgress.unchanged}, changed only by normalisation in ${noLabelOneInProgress.normalisationOnly}, changed otherwise in ${noLabelOneInProgress.other}`,
    `ambiguous: ${ambiguous} documents (no label, two or more in-progress rows in the last row's Epic)`,
    `9.0.1 last-row documents: ${lastRow.documents}; the value changed in ${lastRow.valueChanged} (now Docs ${lastRow.nowDocs}, item 1 ${lastRow.nowStepOne}); the value is the same in ${lastRow.valueKept}`,
    `task state NOT relevant: ${stateNotRelevant.valueChanges} documents print another value than above (the Docs tier is unused); classes: ${NEXT_CLASSES.map((c) => `${c} ${apart.classes[c]}`).join(', ')}${apart.ids.other.length ? `; other: ${apart.ids.other.join(' ')}` : ''}`,
  )
  const data = { documents: n, stateRelevant: true, classes: main.classes, ids: main.ids, labelCheck, noLabelOneInProgress, ambiguous, lastRow, stateNotRelevant }
  return { data, lines }
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

// ---- reading: the budget simulation ------------------------------------------------------------------

const KIB = 1024
const B_STEP = 16 * KIB // D3: B is the P90 rounded UP to a multiple of this ...
const B_CEILING = 128 * KIB // ... and never more than this (the rule's ceiling; B itself is written once, in templates/handoff/resume.md)
const LINES_PER_HEADING = 40 // a Markdown file's heading count when its headings cannot be counted (a snapshot holds sizes, not text)
const PATH_ROOT = path.resolve(path.sep, 'corpus-root') // never touched: the path rule is pure

const stats = (perDoc) => ({ perDoc, median: median(perDoc), p90: percentile(perDoc, 0.9), max: perDoc.length ? Math.max(...perDoc) : null })

// One manifest entry under the reading plan: its class, whether a resume could read it, the form it
// takes with the whole budget at its disposal (`primary`) and the shorter `partial` form tried when
// that does not fit (`alt`). Costs are bytes; the outline is charged OUTLINE_HEADING_BYTES a heading.
function formsOfEntry(e, includeAbsolute) {
  if (e.kind === 'self' || e.self) return { cls: 'self', readable: false }
  const p = stripHint(e.raw)
  const abs = /^([A-Za-z]:[\\/]|[\\/])/.test(p)
  // An absolute path is outside the allowed root unless the snapshot's roots were known; the
  // sensitivity run reads it as if its own folder were the root.
  if (!validateHandoffPath(p, includeAbsolute && abs ? path.dirname(p) : PATH_ROOT).ok) return { cls: 'invalid', readable: false }
  if (!e.exists) return { cls: 'missing', readable: false }
  if (e.isDir || e.lines == null) return { cls: 'unreadable', readable: false }
  // Only a Markdown file has an outline, and it lists at most OUTLINE_MAX_ENTRIES headings.
  const outline = isMarkdownPath(p) ? OUTLINE_HEADING_BYTES * Math.min(OUTLINE_MAX_ENTRIES, Math.round(e.lines / LINES_PER_HEADING)) : 0
  const head = (e.bytes * Math.min(HEAD_LINES, e.lines)) / e.lines + outline
  const r = parseRange(e.raw)
  if (r && r.type === 'lines') {
    if (r.start > e.lines) return { cls: 'partial', readable: true, estimate: 'partial', primary: { cost: outline } }
    const n = Math.min(r.end, e.lines) - r.start + 1
    return { cls: 'range-lines', readable: true, estimate: 'lineRange', primary: { cost: (e.bytes * n) / e.lines } }
  }
  if (r && r.type === 'section') return { cls: 'range-section', readable: true, estimate: 'sectionRange', primary: { cost: e.bytes * 0.25 } }
  if (e.lines > WHOLE_FILE_MAX_LINES) return { cls: 'partial', readable: true, estimate: 'partial', primary: { cost: head } }
  return { cls: 'whole', readable: true, primary: { cost: e.bytes }, alt: e.lines > HEAD_LINES ? { cost: head } : null }
}

// The same walk the planner makes, in document order, on costs: an entry that does not fit what is
// left degrades to its `alt` form if that fits, else it is skipped and the walk goes on.
function spendBudget(forms, budget) {
  let total = 0
  let skipped = 0
  let degraded = 0
  let readable = 0
  const status = { read: 0, range: 0, partial: 0, 'skipped-budget': 0 }
  for (const f of forms) {
    if (!f.readable) continue
    readable++
    const left = budget - total
    if (f.primary.cost <= left) {
      total += f.primary.cost
      status[f.cls === 'whole' ? 'read' : f.cls === 'partial' ? 'partial' : 'range']++
    } else if (f.alt && f.alt.cost <= left) {
      total += f.alt.cost
      degraded++
      status.partial++
    } else {
      skipped++
      status['skipped-budget']++
    }
  }
  return { total, skipped, degraded, readable, status }
}

// -> { documents, entries, readable, docsWithReadable, unbudgeted, byBudget[], classes, estimates }
// `unbudgeted` and each `byBudget[i]` carry `perDoc` (bytes read per document) with its median, P90
// and max. `estimates` counts the readable entries whose bytes come from a model, not a measurement:
// a line range (by line share), a section (25% of the file — there is no live file to look in), a
// `partial` (head bytes by line share, outline heading count = lines / 40).
export function simulateReading(docs, { budgets = [], includeAbsolute = false } = {}) {
  const perDocForms = docs.map((d) => d.readingOrder.map((e) => formsOfEntry(e, includeAbsolute)))
  const unbudgeted = perDocForms.map((fs_) => fs_.reduce((a, f) => a + (f.readable ? f.primary.cost : 0), 0))
  const classes = {}
  const estimates = { lineRange: 0, sectionRange: 0, partial: 0 }
  let entries = 0
  let readable = 0
  let docsWithReadable = 0
  for (const forms of perDocForms) {
    if (forms.some((f) => f.readable)) docsWithReadable++
    for (const f of forms) {
      entries++
      const c = (classes[f.cls] ||= { entries: 0, bytes: 0 })
      c.entries++
      if (f.readable) {
        readable++
        c.bytes += f.primary.cost
        if (f.estimate) estimates[f.estimate]++
      }
    }
  }
  const byBudget = budgets.map((budget) => {
    const rs = perDocForms.map((forms) => spendBudget(forms, budget))
    const after = stats(rs.map((r) => r.total))
    return {
      budget,
      ...after,
      docsAtCap: unbudgeted.filter((v) => v > budget).length,
      skipped: rs.reduce((a, r) => a + r.skipped, 0),
      degraded: rs.reduce((a, r) => a + r.degraded, 0),
      docsWithSkipped: rs.filter((r) => r.skipped > 0).length,
      zeroRead: rs.filter((r) => r.readable > 0 && r.total === 0).length,
      status: Object.fromEntries(Object.keys(rs[0] ? rs[0].status : {}).map((k) => [k, rs.reduce((a, r) => a + r.status[k], 0)])),
    }
  })
  return { documents: docs.length, entries, readable, docsWithReadable, unbudgeted: stats(unbudgeted), byBudget, classes, estimates }
}

// The path rule on the corpus: every `Docs` value recorded under docs/harness/ passes, and every
// Reading Order entry with a `..` or `.git` segment is still rejected.
export function pathRuleChecks(docs) {
  const out = { docsUnderHarness: 0, docsUnderHarnessPass: 0, dotEntries: 0, dotEntriesRejected: 0 }
  for (const d of docs) {
    if (d.facts && d.facts.docsUnderHarness) {
      out.docsUnderHarness++
      const value = d.parsed && d.parsed.fixedLabels ? d.parsed.fixedLabels.Docs : null
      const first = String(value ?? '').replace(/`/g, '').trim().split(/\s+/)[0]
      if (validateHandoffPath(stripHint(first), PATH_ROOT).ok) out.docsUnderHarnessPass++
    }
    for (const e of d.readingOrder) {
      if (e.kind !== 'path') continue
      const p = stripHint(e.raw)
      const segs = p.replace(/\\/g, '/').split('/')
      if (!segs.includes('..') && !segs.includes('.git')) continue
      out.dotEntries++
      if (!validateHandoffPath(p, PATH_ROOT).ok) out.dotEntriesRejected++
    }
  }
  return out
}

const kib = (b) => `${Math.round(b / KIB)} KiB`
const num = (n) => (n === null || n === undefined ? 'n/a' : Math.round(n).toLocaleString('en-US'))
const share = (n, d) => (d ? `${(Math.round((1000 * n) / d) / 10).toFixed(1)}%` : '-')
const triple = (s) => `${num(s.median)} / ${num(s.p90)} / ${num(s.max)}`

function reading(docs) {
  const baseRows = Object.fromEntries(computeMetrics(docs).map((r) => [r.key, r.value]))
  const baseline = { median: baseRows['readBytes.median'], p90: baseRows['readBytes.p90'], max: baseRows['readBytes.max'] }
  const first = simulateReading(docs)
  const p90 = first.unbudgeted.p90
  const roundedUp = p90 === null ? 0 : Math.ceil(p90 / B_STEP) * B_STEP
  const B = Math.min(roundedUp, B_CEILING)
  const budgets = [...new Set([64 * KIB, 96 * KIB, 128 * KIB, 256 * KIB, roundedUp].filter((b) => b > 0))].sort((a, b) => a - b)
  const sim = simulateReading(docs, { budgets })
  const sens = simulateReading(docs, { includeAbsolute: true }).unbudgeted
  const rules = pathRuleChecks(docs)
  const N = sim.documents
  const data = {
    documents: N,
    entries: sim.entries,
    readable: sim.readable,
    docsWithReadable: sim.docsWithReadable,
    baseline9_0_1: baseline,
    unbudgeted: { median: sim.unbudgeted.median, p90, max: sim.unbudgeted.max },
    absoluteSensitivity: { median: sens.median, p90: sens.p90, max: sens.max },
    budgetRule: { p90, roundedUpToStep: roundedUp, ceiling: B_CEILING, B, capped: roundedUp > B_CEILING, stepBytes: B_STEP },
    byBudget: sim.byBudget.map(({ perDoc, ...rest }) => rest),
    classes: sim.classes,
    estimates: { ...sim.estimates, sectionResolvedAgainstALiveFile: 0, outlineCountedFromALiveFile: 0 },
    pathRules: rules,
  }
  const lines = [
    `reading: ${N} documents, ${sim.entries} Reading Order entries, ${sim.readable} readable (valid path, existing file, not the document itself); ${sim.docsWithReadable} documents have at least one`,
    `read volume per document, bytes (median / P90 / max):`,
    `  9.0.1 baseline (files over ${WHOLE_FILE_MAX_LINES} lines skipped)         ${triple(baseline)}`,
    `  range-aware, no budget                                ${triple(sim.unbudgeted)}`,
    `  range-aware, no budget, existing absolute entries read ${triple(sens)}   (sensitivity: the snapshot has no root, absolute entries are otherwise outside it)`,
    `B (D3): P90 ${num(p90)} -> next multiple of ${kib(B_STEP)}: ${num(roundedUp)} (${kib(roundedUp)}) -> ${roundedUp > B_CEILING ? `over the ${kib(B_CEILING)} ceiling` : 'within the ceiling'} -> B = ${num(B)} (${kib(B)})`,
    `by budget (budget; skipped-budget of readable; read as partial because the whole file did not fit; documents at the cap; volume after the budget median / P90 / max; documents that read nothing of those with a readable entry):`,
  ]
  for (const b of sim.byBudget) {
    const mark = b.budget === B ? '  <- B' : b.budget === roundedUp && roundedUp > B_CEILING ? '  (uncapped P90 rule, for reference)' : ''
    lines.push(
      `  ${kib(b.budget).padStart(8)}  skipped ${b.skipped}/${sim.readable} (${share(b.skipped, sim.readable)})  partial ${b.degraded} (${share(b.degraded, sim.readable)})  at cap ${b.docsAtCap}/${N} (${share(b.docsAtCap, N)})  after ${triple(b)}  nothing read ${b.zeroRead}/${sim.docsWithReadable}${mark}`,
    )
  }
  const atB = sim.byBudget.find((b) => b.budget === B)
  if (atB) {
    const s = atB.status
    lines.push(`readable entries by final status at B: read ${s.read}, range ${s.range}, partial ${s.partial} (${atB.degraded} of them only because the whole file did not fit), skipped-budget ${s['skipped-budget']}`)
  }
  lines.push('volume by entry class, no budget (readable entries; bytes charged):')
  for (const [k, c] of Object.entries(sim.classes)) lines.push(`  ${k.padEnd(14)} ${String(c.entries).padStart(5)} entries  ${num(c.bytes)} bytes`)
  const e = sim.estimates
  lines.push(
    `estimates used: line range ${e.lineRange} (bytes by line share), section range ${e.sectionRange} (25% of the file; 0 resolved against a live file, the snapshot stores no source path), partial ${e.partial} (head bytes by line share, outline headings = lines / ${LINES_PER_HEADING} for a .md or .markdown file, at most ${OUTLINE_MAX_ENTRIES}, none for any other file; 0 counted from a live file); every budget row also uses the partial estimate for the entries it reads as partial`,
    `path rules: ${rules.docsUnderHarnessPass} of ${rules.docsUnderHarness} recorded Docs values under docs/harness/ pass; ${rules.dotEntriesRejected} of ${rules.dotEntries} Reading Order entries with a .. or .git segment are rejected`,
  )
  return { data, lines }
}

export const WHAT = { 'next-legacy': nextLegacy, next: nextChange, 'extract-agree': extractAgree, reading }

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
