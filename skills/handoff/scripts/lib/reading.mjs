// Reading plan — which Reading Order entries `/handoff resume` reads, in what form, and how many
// bytes that is. It looks at the files (size, lines, headings) and decides; it never prints a file's
// content, and the caller reads exactly what the plan says.
//
//   planReading(entries, roots, budgetBytes, docPath?) -> {
//     entries: [{ raw, path, file, isFile, self, status, reason, range, bytes, lines, fileLines,
//                 outline?, outlineBytes? }],             (one per input entry, same order)
//     totalBytes, budget
//   }
//   `entries` are `parse`'s readingOrder items; `roots` is the allowed-root list (paths.mjs
//   `allowedRoots`, or one folder); `docPath` is the document itself.
//
// Per entry, in document order:
//   - the document itself ("이 문서", or a path that resolves to it): status "read", bytes 0 — the
//     resume has read it already;
//   - not a file shape (a memory item, a command): "skipped-invalid", reason "not a file";
//   - a path that fails the handoff rule (paths.mjs `validateHandoffPath`): "skipped-invalid";
//   - a directory, or a file that does not exist: "skipped-invalid" / "skipped-missing";
//   - a range hint: only that range. `path:START-END` reads those lines (the end is clipped to the
//     file; a start past the end is a "partial" with the outline only). `path §Foo` reads the first
//     section whose heading contains `Foo` (case-insensitive, headings inside code fences do not
//     count) up to the next heading of the same or a higher level; with no such heading it is a
//     "partial" with the outline only. Status "range"; `range` is always { type: "lines", start,
//     end[, heading] } so a reader needs one rule;
//   - no range and at most 2,000 lines: the whole file, "read";
//   - no range and over 2,000 lines: NOT skipped — the first 400 lines plus an outline, "partial".
// `bytes` is what the reader takes from the file; an outline is charged OUTLINE_HEADING_BYTES per
// heading (`outlineBytes`). The budget is spent in document order. An entry that does not fit what is
// left is read as "partial" (first 400 lines and outline) when THAT fits — only a whole file has such
// a form — and is "skipped-budget" when nothing fits; later entries are still considered, so a
// smaller one further down is read. Order never changes, and nothing is cut to fit except by the
// "partial" rule itself: a range is not shortened.
//
// `lines` counts a file's lines the way an editor does (a final newline does not start another
// line); the snapshot's `split('\n').length` is one more for a file that ends with a newline.
import fs from 'node:fs'
import path from 'node:path'
import { fenceFlags } from './parse.mjs'
import { validateHandoffPath } from './paths.mjs'

export const WHOLE_FILE_MAX_LINES = 2000
export const HEAD_LINES = 400
export const OUTLINE_HEADING_BYTES = 60
export const OUTLINE_MAX_LEVEL = 3
const OUTLINE_TEXT_MAX = 120
const MAX_PLAN_BYTES = 64 * 1024 * 1024
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/

// ---- one file, read once ---------------------------------------------------------------------

// -> { size, lines, offs, text(k), headings() } — offs[k] is the byte offset where line k+1 starts,
// offs[lines] the file size, so the bytes of lines a..b (1-based, inclusive) are offs[b] - offs[a-1].
function loadFile(file) {
  const buf = fs.readFileSync(file)
  const offs = [0]
  let i = -1
  while ((i = buf.indexOf(10, i + 1)) !== -1) offs.push(i + 1)
  if (offs[offs.length - 1] !== buf.length) offs.push(buf.length)
  const lines = offs.length - 1
  let heads = null
  return {
    size: buf.length,
    lines,
    offs,
    // Every Markdown heading outside a code fence: [{ line, level, text }]
    headings() {
      if (heads) return heads
      const texts = Array.from({ length: lines }, (_, k) => {
        const s = buf.toString('utf8', offs[k], offs[k + 1]).replace(/\r?\n$/, '')
        return k === 0 ? s.replace(/^﻿/, '') : s
      })
      const flags = fenceFlags(texts)
      heads = []
      texts.forEach((l, k) => {
        if (flags[k]) return
        const m = HEADING.exec(l)
        if (m && m[2]) heads.push({ line: k + 1, level: m[1].length, text: m[2] })
      })
      return heads
    },
  }
}

const outlineOf = (f) =>
  f
    .headings()
    .filter((h) => h.level <= OUTLINE_MAX_LEVEL)
    .map((h) => ({ line: h.line, level: h.level, text: h.text.slice(0, OUTLINE_TEXT_MAX) }))

// The first heading containing `hint` (case-insensitive) -> { start, end, heading } | null. A
// trailing parenthesis on the hint is a remark and is tried without when the whole hint finds nothing.
function findSection(f, hint) {
  const heads = f.headings()
  const find = (h) => {
    const needle = h.toLowerCase()
    return heads.findIndex((x) => x.text.toLowerCase().includes(needle))
  }
  let idx = find(hint)
  if (idx < 0) {
    const bare = hint.replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (bare && bare !== hint) idx = find(bare)
  }
  if (idx < 0) return null
  const h = heads[idx]
  const next = heads.slice(idx + 1).find((x) => x.level <= h.level)
  return { start: h.line, end: next ? next.line - 1 : f.lines, heading: h.text }
}

// ---- the forms an entry can take ------------------------------------------------------------------

const linesForm = (f, start, end, extra = {}, reason = null) => ({
  status: 'range',
  reason,
  range: { type: 'lines', start, end, ...extra },
  bytes: f.offs[end] - f.offs[start - 1],
  lines: end - start + 1,
})

function partialForm(f, reason, headOnly = true) {
  const outline = outlineOf(f)
  const end = headOnly ? Math.min(HEAD_LINES, f.lines) : 0
  return {
    status: 'partial',
    reason,
    range: end ? { type: 'lines', start: 1, end } : null,
    bytes: end ? f.offs[end] : 0,
    lines: end,
    outline,
    outlineBytes: outline.length * OUTLINE_HEADING_BYTES,
  }
}

// -> { primary, alt } — `alt` (a function, or null) builds the smaller form tried when `primary`
// does not fit the budget; only a whole file longer than HEAD_LINES has one.
function formsOf(entry, f) {
  const r = entry.range
  if (r && r.type === 'lines') {
    if (r.start > f.lines) return { primary: partialForm(f, `range starts after the end of the file (${f.lines} lines); outline only`, false), alt: null }
    const end = Math.min(r.end, f.lines)
    return { primary: linesForm(f, r.start, end, {}, end < r.end ? `range clipped to the file's ${f.lines} lines` : null), alt: null }
  }
  if (r && r.type === 'section') {
    const hit = findSection(f, r.heading)
    if (!hit) return { primary: partialForm(f, `heading "${r.heading}" not found; outline only`, false), alt: null }
    return { primary: linesForm(f, hit.start, hit.end, { heading: hit.heading }), alt: null }
  }
  if (f.lines > WHOLE_FILE_MAX_LINES) {
    return { primary: partialForm(f, `${f.lines} lines, over ${WHOLE_FILE_MAX_LINES}: first ${HEAD_LINES} lines and outline only`), alt: null }
  }
  const whole = { status: 'read', reason: null, range: null, bytes: f.size, lines: f.lines }
  const alt = f.lines > HEAD_LINES ? () => partialForm(f, `the whole file does not fit the remaining budget: first ${HEAD_LINES} lines and outline only`) : null
  return { primary: whole, alt }
}

const costOf = (form) => form.bytes + (form.outlineBytes || 0)

// ---- resolving an entry ----------------------------------------------------------------------------------

function realKey(p) {
  let r
  try {
    r = fs.realpathSync(p)
  } catch {
    r = path.resolve(p)
  }
  return process.platform === 'win32' ? r.toLowerCase() : r
}

const ABSOLUTE = /^([A-Za-z]:[\\/]|[\\/])/

// -> { done: entry } for an entry that needs no budget, or { base, forms } for one that does.
function resolveEntry(e, roots, docPath, docKey) {
  const base = { raw: e.raw, path: e.path ?? null, file: null, isFile: Boolean(e.isFile), self: Boolean(e.self), status: null, reason: null, range: null, bytes: 0, lines: 0, fileLines: null }
  const done = (status, reason, more = {}) => ({ done: { ...base, ...more, status, reason } })
  if (e.self) return done('read', 'the document itself (already read)', { path: null, file: docPath })
  if (!e.isFile) return done('skipped-invalid', 'not a file')
  const ok = validateHandoffPath(e.path, roots)
  if (!ok.ok) return done('skipped-invalid', ok.reason)
  if (!roots.length) return done('skipped-invalid', 'no repository root found for this document')
  const norm = e.path.replace(/\\/g, '/')
  const candidates = ABSOLUTE.test(e.path) ? [path.resolve(e.path)] : roots.map((r) => path.resolve(r, norm))
  let found = null
  let st = null
  for (const c of candidates) {
    try {
      st = fs.statSync(c)
      found = c
      break
    } catch {
      // try the next root
    }
  }
  if (!found) return done('skipped-missing', 'file not found')
  if (st.isDirectory()) return done('skipped-invalid', 'a directory, not a file', { file: found })
  if (!st.isFile()) return done('skipped-invalid', 'not a regular file', { file: found })
  if (docKey && realKey(found) === docKey) return done('read', 'the document itself (already read)', { file: found })
  if (st.size > MAX_PLAN_BYTES) return done('skipped-invalid', `file larger than ${MAX_PLAN_BYTES} bytes`, { file: found })
  let f
  try {
    f = loadFile(found)
  } catch (err) {
    return done('skipped-invalid', `cannot be read (${err.code || err.message})`, { file: found })
  }
  return { base: { ...base, file: found, fileLines: f.lines }, forms: formsOf(e, f) }
}

// ---- the plan ----------------------------------------------------------------------------------------------------

export function planReading(entries, roots, budgetBytes, docPath = null) {
  const rootList = (Array.isArray(roots) ? roots : [roots]).filter(Boolean).map((r) => path.resolve(r))
  const docKey = docPath ? realKey(docPath) : null
  const out = []
  let total = 0
  for (const e of entries) {
    const r = resolveEntry(e, rootList, docPath, docKey)
    if (r.done) {
      out.push(r.done)
      continue
    }
    const left = budgetBytes - total
    let pick = null
    if (costOf(r.forms.primary) <= left) pick = r.forms.primary
    else if (r.forms.alt) {
      const a = r.forms.alt()
      if (costOf(a) <= left) pick = a
    }
    if (!pick) {
      out.push({ ...r.base, status: 'skipped-budget', reason: `over the budget: needs ${costOf(r.forms.primary)} bytes, ${left} left` })
      continue
    }
    total += costOf(pick)
    const { status, reason, range, bytes, lines, outline, outlineBytes } = pick
    out.push({ ...r.base, status, reason, range, bytes, lines, ...(outline ? { outline, outlineBytes } : {}) })
  }
  return { entries: out, totalBytes: total, budget: budgetBytes }
}
