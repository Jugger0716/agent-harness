// Reading plan — which Reading Order entries `/handoff resume` reads, in what form, and how many
// bytes that is. It looks at the files (size, lines, headings) and decides; it never prints a file's
// content, and the caller reads exactly what the plan says.
//
//   planReading(entries, roots, budgetBytes, docPath?) -> {
//     entries: [{ raw, path, file, isFile, self, status, reason, range, bytes, lines, fileLines,
//                 outline?, outlineBytes?, truncated? }],  (one per input entry, same order; the three
//                                                           outline fields come with a "partial")
//     totalBytes (the bytes charged: each entry's bytes + outlineBytes), budget
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
//   - a file whose REAL location (links and junctions followed) is outside every allowed root:
//     "skipped-invalid", reason "link leaves the repository" (condition 4 of paths.mjs); one whose real location
//     relative to that root has a `.git` segment (a link inside the repository that leads into `.git/`):
//     "skipped-invalid", reason "link leads into .git/" (condition 3, applied again to the real path);
//   - an entry past the first MAX_PLAN_ENTRIES (200): "skipped-invalid", nothing looked at;
//   - a range hint: only that range. `path:START-END` reads those lines (the end is clipped to the
//     file; a start past the end is a "partial" with the outline only). `path §Foo` reads the first
//     section whose heading contains `Foo` (case-insensitive, headings inside code fences do not
//     count) up to the next heading of the same or a higher level; with no such heading it is a
//     "partial" with the outline only. Status "range"; `range` is always { type: "lines", start,
//     end[, heading] } so a reader needs one rule;
//   - a trailing hint that is none of those (a reversed or empty range, `:42`, `#L10-L20`, an
//     empty `§`) is ignored and the whole file is read; the entry's reason says "range hint
//     ignored". A remark in parentheses is not a hint;
//   - no range and at most 2,000 lines: the whole file, "read";
//   - no range and over 2,000 lines: NOT skipped — the first 400 lines plus an outline, "partial".
// `bytes` is what the reader takes from the file; an outline is charged OUTLINE_HEADING_BYTES per
// heading returned (`outlineBytes`). An outline lists the level 1-3 headings of a Markdown file
// (`.md`, `.markdown`; a `# ` line in any other file is a comment, so such a file has none), at
// most OUTLINE_MAX_ENTRIES of them — `truncated` is true when there were more. The budget is spent in document order. An entry that does not fit what is
// left is read as "partial" (first 400 lines and outline) when THAT fits — only a whole file has such
// a form — and is "skipped-budget" when nothing fits; later entries are still considered, so a
// smaller one further down is read. Order never changes, and nothing is cut to fit except by the
// "partial" rule itself: a range is not shortened. A file several entries name is read once (kept by real path).
//
// `lines` counts a file's lines the way an editor does (a final newline does not start another
// line); the snapshot's `split('\n').length` is one more for a file that ends with a newline.
import fs from 'node:fs'
import path from 'node:path'
import { cutParenRemark, fenceFlags, headingName } from './parse.mjs'
import { isGitSegment, validateHandoffPath } from './paths.mjs'

export const WHOLE_FILE_MAX_LINES = 2000
export const HEAD_LINES = 400
export const OUTLINE_HEADING_BYTES = 60
export const OUTLINE_MAX_LEVEL = 3
export const OUTLINE_MAX_ENTRIES = 200
const OUTLINE_TEXT_MAX = 120
const MAX_PLAN_BYTES = 64 * 1024 * 1024
export const MAX_PLAN_ENTRIES = 200
// `/^(#{1,6})[ \t]+(.*?)[ \t]*$/`, with the trailing blanks cut by hand: the lazy text and the blanks after it took
// quadratic time on a heading with a long run of spaces inside it.
const HEADING = /^(#{1,6})[ \t]+(.*)$/
function trimBlanksEnd(s) {
  let end = s.length
  while (end > 0 && (s[end - 1] === ' ' || s[end - 1] === '\t')) end--
  return s.slice(0, end)
}

// Headings are read in Markdown files only.
export const isMarkdownPath = (p) => /\.(md|markdown)$/i.test(p)

// ---- one file, read once ---------------------------------------------------------------------

// -> { size, lines, offs, text(k), headings() } — offs[k] is the byte offset where line k+1 starts,
// offs[lines] the file size, so the bytes of lines a..b (1-based, inclusive) are offs[b] - offs[a-1].
function loadFile(file) {
  const markdown = isMarkdownPath(file)
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
      if (!markdown) return (heads = [])
      const texts = Array.from({ length: lines }, (_, k) => {
        const s = buf.toString('utf8', offs[k], offs[k + 1]).replace(/\r?\n$/, '')
        return k === 0 ? s.replace(/^\uFEFF/, '') : s
      })
      const flags = fenceFlags(texts)
      heads = []
      texts.forEach((l, k) => {
        if (flags[k]) return
        const m = HEADING.exec(l)
        const text = m ? trimBlanksEnd(m[2]) : ''
        if (text) heads.push({ line: k + 1, level: m[1].length, text })
      })
      return heads
    },
  }
}

// -> { outline, truncated }
function outlineOf(f) {
  const all = f.headings().filter((h) => h.level <= OUTLINE_MAX_LEVEL)
  const outline = all.slice(0, OUTLINE_MAX_ENTRIES).map((h) => ({ line: h.line, level: h.level, text: h.text.slice(0, OUTLINE_TEXT_MAX) }))
  return { outline, truncated: all.length > outline.length }
}

// The first heading containing `hint` (case-insensitive) -> { start, end, heading } | null. A
// trailing parenthesis on the hint is a remark and is tried without when the whole hint finds nothing.
// `doNot` (the pointer entry `reading-plan` adds for a pointer-only Do NOT section) asks for the section parse.mjs
// itself would read as `Do NOT`: the first LEVEL-2 heading whose text, HTML comments dropped, starts with "Do not" —
// never a title or a deeper heading that merely contains the words ("Do nothing yet").
function findSection(f, hint, doNot = false) {
  const heads = f.headings()
  const find = (h) => {
    const needle = h.toLowerCase()
    return heads.findIndex((x) => x.text.toLowerCase().includes(needle))
  }
  let idx = doNot ? heads.findIndex((x) => x.level === 2 && headingName(x.text) === 'Do NOT') : find(hint)
  if (idx < 0 && !doNot) {
    const bare = cutParenRemark(hint, true).trim() // `hint.replace(/\s*\([^)]*\)\s*$/, '')`, in one pass
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
  const { outline, truncated } = outlineOf(f)
  const end = headOnly ? Math.min(HEAD_LINES, f.lines) : 0
  return {
    status: 'partial',
    reason,
    range: end ? { type: 'lines', start: 1, end } : null,
    bytes: end ? f.offs[end] : 0,
    lines: end,
    outline,
    outlineBytes: outline.length * OUTLINE_HEADING_BYTES,
    truncated,
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
    const hit = findSection(f, r.heading, r.doNot === true)
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

// The real path (links and junctions followed); the path as resolved when it cannot be read.
function realPath(p) {
  try {
    return fs.realpathSync.native(p)
  } catch {
    return path.resolve(p)
  }
}

function isInside(root, p) {
  const rel = path.relative(root, p)
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)
}

// A trailing hint that is not one of the two range forms (a reversed or empty range, `:42`,
// `#L10-L20`, an empty `§`) is dropped by the parser and the whole file is read; say so. A remark
// in parentheses is not a hint.
function ignoredHint(e) {
  if (e.range || typeof e.raw !== 'string' || typeof e.path !== 'string' || !e.raw.startsWith(e.path)) return false
  const rest = e.raw.slice(e.path.length).trim()
  return rest !== '' && !/^\([^)]*\)$/.test(rest)
}

// -> { done: entry } for an entry that needs no budget, or { base, forms } for one that does.
const baseOf = (e) => ({ raw: e.raw, path: e.path ?? null, file: null, isFile: Boolean(e.isFile), self: Boolean(e.self), status: null, reason: null, range: null, bytes: 0, lines: 0, fileLines: null })

function resolveEntry(e, roots, rootReals, docPath, docKey, cache) {
  const base = baseOf(e)
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
  const real = realPath(found)
  const inside = rootReals.filter((r) => isInside(r, real))
  if (!inside.length) return done('skipped-invalid', 'link leaves the repository', { file: found })
  // condition 3 again, on the real path: a link inside the repository can lead into `.git/` (its `config` may hold a
  // remote URL with credentials) under a path that names no `.git` segment
  if (inside.some((r) => path.relative(r, real).split(path.sep).some(isGitSegment))) return done('skipped-invalid', 'link leads into .git/', { file: found })
  const key = realKey(found)
  if (docKey && key === docKey) return done('read', 'the document itself (already read)', { file: found })
  if (st.size > MAX_PLAN_BYTES) return done('skipped-invalid', `file larger than ${MAX_PLAN_BYTES} bytes`, { file: found })
  const f = cache.load(key, found)
  if (f.error) return done('skipped-invalid', `cannot be read (${f.error.code || f.error.message})`, { file: found })
  return { base: { ...base, file: found, fileLines: f.lines }, forms: formsOf(e, f) }
}

// A file named by several entries is read once: loaded files are kept by real path while what is kept stays within
// MAX_PLAN_BYTES (a file past that is loaded again for each entry that names it, as before). A load that fails is kept too.
function fileCache() {
  const kept = new Map()
  let bytes = 0
  return {
    load(key, file) {
      if (kept.has(key)) return kept.get(key)
      let f
      try {
        f = loadFile(file)
      } catch (error) {
        f = { error }
      }
      const size = f.error ? 0 : f.size
      if (bytes + size <= MAX_PLAN_BYTES) {
        kept.set(key, f)
        bytes += size
      }
      return f
    },
  }
}

// ---- the plan ----------------------------------------------------------------------------------------------------

export function planReading(entries, roots, budgetBytes, docPath = null) {
  const rootList = (Array.isArray(roots) ? roots : [roots]).filter(Boolean).map((r) => path.resolve(r))
  const rootReals = rootList.map(realPath)
  const docKey = docPath ? realKey(docPath) : null
  const cache = fileCache()
  const out = []
  let total = 0
  for (const e of entries) {
    if (out.length >= MAX_PLAN_ENTRIES) {
      out.push({ ...baseOf(e), status: 'skipped-invalid', reason: `beyond the first ${MAX_PLAN_ENTRIES} entries — not planned` })
      continue
    }
    const r = resolveEntry(e, rootList, rootReals, docPath, docKey, cache)
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
    const { status, range, bytes, lines, outline, outlineBytes, truncated } = pick
    const reason = ignoredHint(e) ? (pick.reason ? `${pick.reason}; range hint ignored` : 'range hint ignored') : pick.reason
    out.push({ ...r.base, status, reason, range, bytes, lines, ...(outline ? { outline, outlineBytes, truncated } : {}) })
  }
  return { entries: out, totalBytes: total, budget: budgetBytes }
}
