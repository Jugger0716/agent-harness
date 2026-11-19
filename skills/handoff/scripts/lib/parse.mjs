// Handoff document parser — DATA EXTRACTION ONLY. It reads the text of one handoff document and
// returns what the document says; it never decides what the next step is, never touches the file
// system and never runs git. Rules that interpret the data (which slice comes next, which
// Reading Order entry is read) live in the commands built on top of it.
//
//   parseHandoff(text) -> {
//     header:   { title, date, project, branch, head, headRaw, dirtyRaw, dirtyPaths[], worktree,
//                 upstream }                         (a label the document lacks reads as null;
//                                                     see "Header lines" for worktree and dirtyPaths)
//     sections: { <name>: <body text> }               (level-2 headings outside code fences, in
//                                                     document order; see "Section names"; a
//                                                     null-prototype object, so any title is a key)
//     fixedLabels: { Skill, Task, Phase, Mode, Docs } | null   (from "## In Progress")
//     harness:  "record" | "none" | "absent"          (what `## In Progress` says about a harness task:
//                                                     the fixed-label record, a `Harness : none (…)`
//                                                     line, or neither — see "Harness record")
//     ledger:   { rows: [{ epic, epicRaw, slice, status, evidence, notes }] } | null
//     stepOne:  { text, candidates[], sliceLabel }    (Next Steps item 1)
//     readingOrder: [{ raw, path, range, isFile, self }]
//     doNotMissing: boolean   (the document has no `## Do NOT` section at all)
//     doNotRefOnly: boolean   (the section is only a pointer to another document — see "The Do NOT section")
//     doNotRef:     string | null   (the pointed-to document's path, when doNotRefOnly and the section names one)
//   }
//   parseHeader(text) -> the same `header`, read from the lines before the first section only.
//
// Every rule is applied in time linear in the document: a document is data from anywhere, and an expression that
// backtracks quadratically lets one long line stall every command that reads the folder (see "linear text helpers").
//
// Rules in force here:
//   - A document whose first line does not start with `# HANDOFF —` is refused (InputError). A
//     leading BOM is ignored; CRLF and LF read the same.
//   - Section names: an English heading is read by PREFIX, so `Definition of Done (v3 계획)` is
//     `Definition of Done`, and an HTML comment on the heading line is dropped. A heading the
//     contract does not name keeps its own text. When a name repeats, the first section wins.
//   - Code fences are tracked by character and length (a four-backtick fence may hold a
//     three-backtick one), so a `## ` line inside a fence is not a heading and a table inside one
//     is not the ledger.
//   - The ledger is the FIRST table of `## Progress Ledger`; columns are found by header name.
//     `status` and `epic` are read with one `**…**`/`__…__` pair and then one backtick pair
//     removed; `epicRaw` is the Epic cell as written, and `slice`, `evidence` and `notes` are
//     the cells as written (only trimmed).
//   - Header lines: `**Worktree:**` is the git top-level the document was written in (`n/a` reads as
//     null). `dirtyPaths` comes from `**Dirty files:**` (paths joined with `; `, a trailing `+N more`
//     is not a path); a document without that line is read from the legacy `**Dirty:**` value —
//     only a parenthesised list whose every item looks like a path (`3 files (a.js, b.js)`), because
//     a wrong path would raise a false "lost work" alarm; prose or a bare count gives [].
//   - Harness record: "record" when any of the five fixed labels is present (it wins when a
//     document carries both); else "none" for a `Harness : none` or `Harness : none (<reason>)`
//     line; else "absent" — a document written before either existed.
//   - The Do NOT section: `readDoNot` below says when it is only a pointer ("same as the previous handoff's Do NOT:
//     `docs/…/x.md`"), which the `generate` contract no longer allows and older documents have.
//   - Unknown fields are null, never absent.
//
// Everything exported besides `parseHandoff` is a building block that the corpus tools share.
import { InputError } from './errors.mjs'

export { InputError }

export const HANDOFF_PREFIX = '# HANDOFF —'

// ---- text and code fences -----------------------------------------------------------------------

export function splitLines(text) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/)
}

// flags[i] is true for a fence's opening line, its closing line and every line between them. `stop(i, flag)`, when
// given, ends the walk after line i (the flags after it stay false).
export function fenceFlags(lines, stop = null) {
  const flags = new Array(lines.length).fill(false)
  let open = null
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (open) {
      flags[i] = true
      const m = /^\s*(`{3,}|~{3,})\s*$/.exec(l)
      if (m && m[1][0] === open.ch && m[1].length >= open.len) open = null
    } else {
      // `/^\s*(`{3,}|~{3,})(.*)$/`: the rest of the line is the info string, and holds no character `.` does not match
      const m = /^\s*(`{3,}|~{3,})/.exec(l)
      const info = m ? l.slice(m[0].length) : ''
      // An info string on a backtick fence cannot hold a backtick (that is an inline span).
      if (m && !TERMINATOR.test(info) && !(m[1][0] === '`' && info.includes('`'))) {
        open = { ch: m[1][0], len: m[1].length }
        flags[i] = true
      }
    }
    if (stop && stop(i, flags[i])) break
  }
  return flags
}

const isBlank = (l) => l.trim() === ''

// ---- linear text helpers ------------------------------------------------------------------------
//
// A document is DATA from anywhere, so nothing here may take more than linear time on it. A regular expression with
// two quantifiers that can match the same characters next to each other (`\s*[-*]?\s*`, `(.*?)\s*$`, `\s+§.*$`
// tried at every start) backtracks quadratically — a 60 KB line of spaces cost seconds. The helpers below do what
// such an expression did, with the same result on every input, in one pass.

const isWs = (c) => /\s/.test(c)
// The characters `.` does not match (without the `s` flag).
const TERMINATOR = /[\n\r\u2028\u2029]/

// `text.replace(/<!--[\s\S]*?-->/g, by)`. Each `<!--` is closed by the first `-->` after it; once no `-->` follows a
// `<!--`, no later `<!--` can be closed either.
function replaceComments(text, by) {
  let out = ''
  let pos = 0
  for (;;) {
    const open = text.indexOf('<!--', pos)
    if (open < 0) break
    const close = text.indexOf('-->', open + 4)
    if (close < 0) break
    out += text.slice(pos, open) + by
    pos = close + 3
  }
  return out + text.slice(pos)
}

// `text.replace(/<!--.*?-->/g, '')`: the same, except that a comment never spans a character `.` does not match, so
// each piece between two such characters is handled on its own.
const stripLineComments = (text) =>
  text
    .split(/([\n\r\u2028\u2029])/)
    .map((piece, i) => (i % 2 ? piece : replaceComments(piece, '')))
    .join('')

// `text.replace(/\[[^\]]*\]\([^)]*\)/g, fn)` (a markdown link). The text of a link ends at the first `]` after its `[`,
// so every `[` before that `]` shares it; the target ends at the first `)`.
function replaceLinks(text, fn) {
  let out = ''
  let pos = 0
  for (;;) {
    const open = text.indexOf('[', pos)
    if (open < 0) break
    const close = text.indexOf(']', open + 1)
    if (close < 0) break
    if (text[close + 1] !== '(') {
      out += text.slice(pos, close + 1)
      pos = close + 1
      continue
    }
    const end = text.indexOf(')', close + 2)
    if (end < 0) break
    out += text.slice(pos, open) + fn()
    pos = end + 1
  }
  return out + text.slice(pos)
}

// Where `/\s+§<tail>$/` matches `s` -> the index the match starts at, and the `§`, or null. `tail` is `.*` when
// `spaceThenLine` is false (nothing after the `§` may be a character `.` does not match) and `\s*(.*)` when it is
// true (only the white space right after the `§` may hold one). The leftmost start is the white-space run before the
// first `§` that qualifies.
function sectionHintAt(s, spaceThenLine) {
  let last = -1
  for (let i = s.length - 1; i >= 0; i--) {
    if (TERMINATOR.test(s[i])) {
      last = i
      break
    }
  }
  let from = last + 1
  if (spaceThenLine && last >= 0) {
    // the `§` may sit before the last terminator when only white space lies between them
    let k = last
    while (k >= 0 && isWs(s[k])) k--
    from = Math.max(k, 0)
  }
  let q = s.indexOf('§', from)
  while (q !== -1 && !(q >= 1 && isWs(s[q - 1]))) q = s.indexOf('§', q + 1)
  if (q === -1) return null
  let start = q - 1
  while (start > 0 && isWs(s[start - 1])) start--
  return { start, at: q }
}

// `s.replace(/\s*\([^)]*\)$/, '')` — or, with `trailingSpace`, `s.replace(/\s*\([^)]*\)\s*$/, '')`: a remark in
// parentheses at the end is cut together with the white space before it. Only the `(` after the last `)` but one can
// open it; the leftmost such `(` gives the leftmost match.
export function cutParenRemark(s, trailingSpace = false) {
  let end = s.length - 1
  if (trailingSpace) while (end >= 0 && isWs(s[end])) end--
  if (end < 0 || s[end] !== ')') return s
  const before = s.lastIndexOf(')', end - 1)
  const open = s.indexOf('(', before + 1)
  if (open < 0 || open >= end) return s
  let start = open
  while (start > 0 && isWs(s[start - 1])) start--
  return s.slice(0, start)
}

// `s.replace(/\s*<wrapper>\s*$/, '')` for a fixed wrapper (`**`, `__` or a backtick): the wrapper is the last thing
// before the trailing white space, and is cut with the white space on both sides.
function cutTrailingWrapper(s, wrappers) {
  let end = s.length
  while (end > 0 && isWs(s[end - 1])) end--
  const w = wrappers.find((x) => s.slice(0, end).endsWith(x))
  if (w === undefined) return s
  let start = end - w.length
  while (start > 0 && isWs(s[start - 1])) start--
  return s.slice(0, start)
}

function trimBlankEdges(arr) {
  let a = 0
  let b = arr.length
  while (a < b && isBlank(arr[a])) a++
  while (b > a && isBlank(arr[b - 1])) b--
  return arr.slice(a, b)
}

// ---- sections ---------------------------------------------------------------------------------------

// The names the contract gives its headings, read by prefix (case-insensitive, word boundary).
const SECTION_NAMES = [
  ['Goal', /^Goal\b/i],
  ['Current State (verified)', /^Current State\b/i],
  ['In Progress', /^In Progress\b/i],
  ['Blockers / Risks', /^Blockers?\b/i],
  ['Next Steps', /^Next Steps\b/i],
  ['Definition of Done', /^Definition of Done\b/i],
  ['Reading Order', /^Reading Order\b/i],
  ['Do NOT', /^Do not\b/i],
  ['Progress Ledger', /^Progress Ledger\b/i],
  ['Resume', /^Resume\b/i],
]

export function sectionName(heading) {
  for (const [name, re] of SECTION_NAMES) if (re.test(heading)) return name
  return heading
}

// The name of a heading from its raw text (what follows `## `): HTML comments dropped, trimmed, read by prefix — the
// rule findSections applies, for a reader of another file (reading.mjs, the pointed-to Do NOT section).
export const headingName = (text) => sectionName(stripLineComments(text).trim())

// -> [{ heading, name, start, end }]: `start` is the heading's line index, `end` the index of the
// next level-2 heading (or the line count). The body is lines[start + 1 .. end).
export function findSections(lines, flags) {
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (flags[i] || !/^## (?!#)/.test(lines[i])) continue
    const heading = stripLineComments(lines[i].replace(/^## /, '')).trim()
    if (out.length) out[out.length - 1].end = i
    out.push({ heading, name: sectionName(heading), start: i, end: lines.length })
  }
  return out
}

// The first section with this canonical name -> { lines, flags } | null
function bodyOf(secs, lines, flags, name) {
  const s = secs.find((x) => x.name === name)
  return s ? { lines: lines.slice(s.start + 1, s.end), flags: flags.slice(s.start + 1, s.end) } : null
}

// ---- header ---------------------------------------------------------------------------------------------

const HEADER_LABEL = /\*\*([A-Za-z][A-Za-z ]*):\*\*/g

function readHeader(lines, flags, firstSection) {
  const raw = Object.create(null) // a label named `constructor` must be a label, not a lookup miss
  for (let i = 1; i < firstSection; i++) {
    if (flags[i]) continue
    const l = lines[i]
    const marks = [...l.matchAll(HEADER_LABEL)]
    marks.forEach((m, k) => {
      const name = m[1].trim().toLowerCase()
      const to = k + 1 < marks.length ? marks[k + 1].index : l.length
      if (!Object.hasOwn(raw, name)) raw[name] = l.slice(m.index + m[0].length, to).trim()
    })
  }
  const get = (k) => (Object.hasOwn(raw, k) ? raw[k] : null)
  const headRaw = get('head')
  let head = null
  const hm = headRaw === null ? null : /^`?([0-9a-f]{7,40})`?(?:\s+(.*))?$/.exec(headRaw)
  if (hm) head = hm[1]
  const dirtyRaw = get('dirty')
  const worktree = get('worktree')
  const dirtyFiles = get('dirty files')
  return {
    title: lines[0].slice(HANDOFF_PREFIX.length).trim(),
    date: get('date'),
    project: get('project'),
    branch: get('branch'),
    head,
    headRaw,
    dirtyRaw,
    dirtyPaths: dirtyFiles !== null ? pathsOfDirtyFiles(dirtyFiles) : pathsOfLegacyDirty(dirtyRaw),
    worktree: worktree === null || /^(n\/a|none|-)?$/i.test(worktree) ? null : stripTicks(worktree),
    upstream: get('upstream'),
  }
}

// `v.replace(/^`+|`+$/g, '').trim()`
function stripTicks(v) {
  let a = 0
  let b = v.length
  while (a < b && v[a] === '`') a++
  while (b > a && v[b - 1] === '`') b--
  return v.slice(a, b).trim()
}

// `a; b c; `x; y.txt`; +2 more` -> the paths. An item is either a backtick pair (its content is the path,
// whatever it holds — this is how a name that contains "; " is written; anything after the closing
// backtick up to the next separator is a remark and dropped) or plain text up to a semicolon followed by
// white space (so a path that holds a bare `;` stays whole). `+N more` / `none` / `clean` / `n/a` among the
// plain items are markers, not paths.
function pathsOfDirtyFiles(value) {
  const out = []
  const n = value.length
  // a `;` that ends the value is part of the last name: only "; " (a semicolon and white space) separates
  const isSeparator = (j) => value[j] === ';' && j + 1 < n && /\s/.test(value[j + 1])
  let i = 0
  while (i < n) {
    if (/\s/.test(value[i]) || value[i] === ';') {
      i++
      continue
    }
    const close = value[i] === '`' ? value.indexOf('`', i + 1) : -1
    let j = close > i ? close + 1 : i
    while (j < n && !isSeparator(j)) j++
    if (close > i) {
      if (close > i + 1) out.push(value.slice(i + 1, close))
    } else {
      const item = value.slice(i, j).trim()
      if (item !== '' && !/^\+\d+ more$/i.test(item) && !/^(none|clean|n\/a|-)$/i.test(item)) out.push(item)
    }
    i = j + 1
  }
  return out
}

// `3 files (src/a.js, `docs/b.md`)` -> the paths, when the value has a parenthesised list and EVERY
// item looks like a path; otherwise [].
function pathsOfLegacyDirty(value) {
  const m = value === null ? null : /\(([^()]*)\)/.exec(value)
  if (!m) return []
  // `m[1].split(/\s*[,;]\s*/)`: the white space next to a separator goes with it
  const parts = m[1].split(/[,;]/)
  const items = parts
    .map((p, i) => (i > 0 ? p.trimStart() : p))
    .map((p, i) => (i < parts.length - 1 ? p.trimEnd() : p))
    .map(stripTicks)
    .filter((p) => p !== '' && !/^(\+\d+ more|…|\.\.\.)$/i.test(p))
  return items.length > 0 && items.every(looksLikePath) ? items : []
}

// ---- fixed labels ------------------------------------------------------------------------------------------

export const FIXED_LABELS = ['Skill', 'Task', 'Phase', 'Mode', 'Docs']

// Label lines are read from the whole section, fenced or not (the contract's own example shows
// them in a fence, and a copy of it must still count). A label the section lacks reads as null;
// a label with no value reads as ''. No label at all -> null for the whole record.
function readFixedLabels(body) {
  if (!body) return null
  const out = {}
  let any = false
  for (const k of FIXED_LABELS) {
    out[k] = null
    // `^\s*[-*]?\s*(`?)<k>\s*:\s*(.*?)\s*$`, without its quadratic parts: the value is the rest of the line, trimmed,
    // and must hold no character `.` does not match
    const re = new RegExp('^\\s*(?:[-*]\\s*)?(`?)' + k + '\\s*:')
    for (const l of body.lines) {
      const m = re.exec(l)
      if (!m) continue
      let v = l.slice(m[0].length).trim()
      if (TERMINATOR.test(v)) continue
      if (m[1] && v.endsWith('`')) v = v.slice(0, -1).trimEnd()
      out[k] = v
      any = true
      break
    }
  }
  return any ? out : null
}

// ---- Harness record -----------------------------------------------------------------------------------------

// `Harness : none` or `Harness : none (<reason>)`, alone on its line (a list marker or one backtick
// pair around it is allowed). A sentence that merely starts with those words is not the line.
// It is `/^\s*[-*]?\s*`?Harness\s*:\s*none\s*(\([^\n]*\))?\s*`?\s*$/i`, read without its quadratic (and cubic) parts:
// after `none` comes white space, then either nothing but one optional backtick and white space, or a `(` whose LAST
// `)` closes it (no line feed between) with only that after it.
const HARNESS_NONE_HEAD = /^\s*(?:[-*]\s*)?`?Harness\s*:\s*none/i
const onlyTick = (s) => {
  const t = s.trim()
  return t === '' || t === '`'
}

function isHarnessNoneLine(l) {
  const m = HARNESS_NONE_HEAD.exec(l)
  if (!m) return false
  const rest = l.slice(m[0].length)
  if (onlyTick(rest)) return true
  const r = rest.trimStart()
  if (r[0] !== '(') return false
  const close = r.lastIndexOf(')')
  return close > 0 && !r.slice(1, close).includes('\n') && onlyTick(r.slice(close + 1))
}

function readHarness(body, fixedLabels) {
  if (fixedLabels) return 'record'
  if (body && body.lines.some(isHarnessNoneLine)) return 'none'
  return 'absent'
}

// ---- Progress Ledger --------------------------------------------------------------------------------------------

// `**x**` / `__x__`, then a backtick pair, removed; trimmed.
export function stripEmphasis(cell) {
  let v = (cell || '').trim()
  let m
  if ((m = v.match(/^\*\*(.*)\*\*$/)) || (m = v.match(/^__(.*)__$/))) v = m[1].trim()
  if ((m = v.match(/^`(.*)`$/))) v = m[1].trim()
  return v
}

const tableCells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim())
// `/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/`, cell by cell: one leading and one trailing `|` dropped, then every
// cell is `:?-+:?` in white space
function isSeparatorRow(l) {
  let s = l.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').every((c) => /^\s*:?-+:?\s*$/.test(c))
}

// The first run of consecutive `|` lines outside code fences.
function firstTable(body) {
  const run = []
  for (let i = 0; i < body.lines.length; i++) {
    if (!body.flags[i] && /^\s*\|/.test(body.lines[i])) run.push(body.lines[i])
    else if (run.length) break
  }
  return run
}

const LEDGER_COLUMNS = ['epic', 'slice', 'status', 'evidence', 'notes']

function readLedger(body) {
  if (!body) return null
  const tbl = firstTable(body)
  if (tbl.length < 2) return { rows: [] }
  const header = tableCells(tbl[0]).map((h) => stripEmphasis(h).toLowerCase())
  const at = Object.fromEntries(LEDGER_COLUMNS.map((c) => [c, header.indexOf(c)]))
  const data = tbl.slice(isSeparatorRow(tbl[1]) ? 2 : 1)
  const rows = data.map((r) => {
    const c = tableCells(r)
    const cell = (name) => (at[name] < 0 ? null : c[at[name]] === undefined ? '' : c[at[name]])
    const epicRaw = cell('epic')
    const status = cell('status')
    return {
      epic: epicRaw === null ? null : stripEmphasis(epicRaw),
      epicRaw,
      slice: cell('slice'),
      status: status === null ? null : stripEmphasis(status),
      evidence: cell('evidence'),
      notes: cell('notes'),
    }
  })
  return { rows }
}

// ---- Next Steps item 1 ---------------------------------------------------------------------------------------------

const ITEM_MARKER = /^(\s*)(\d+[.)]|[-*])(\s+)/

// Item 1 is the `1.` / `1)` item; a Next Steps list that has none is read from its first list
// item (a bullet list has no number, but its first bullet is what a reader takes as step one).
// The item runs to the next list item that is not nested under it (indented less than its
// content), skipping lines inside code fences. -> the item's lines with the marker dropped from
// the first line, or null.
function stepOneLines(body) {
  if (!body) return null
  const { lines, flags } = body
  const find = (re) => lines.findIndex((l, i) => !flags[i] && re.test(l))
  let start = find(/^\s{0,3}1[.)]\s/)
  if (start < 0) start = find(/^\s{0,3}(\d+[.)]|[-*])\s/)
  if (start < 0) return null
  const m = ITEM_MARKER.exec(lines[start])
  const contentAt = m[1].length + m[2].length + (m[3].length > 4 ? 1 : m[3].length)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (flags[i]) continue
    const n = ITEM_MARKER.exec(lines[i])
    if (n && n[1].length < contentAt) {
      end = i
      break
    }
  }
  const item = lines.slice(start, end)
  item[0] = item[0].slice(m[0].length)
  return trimBlankEdges(item)
}

// A label line: `Slice : <value>`, optionally after a list marker and wrapped in bold or a
// backtick (`**Slice : x**`, `**Slice :** x`, `` `Slice : x` ``). The word must be followed by
// the colon: `**Slice A is confirmed**` is prose, not a label. The value is kept as written
// (its own backticks stay); only the wrapper that belongs to the label is removed.
// It is `/^\s*(?:(?:\d+[.)]|[-*])\s+)?(\*\*|__)?(`)?\s*Slice\s*:\s*(.*)$/`, read in parts so that the white space
// before `Slice` is never split between two quantifiers: all leading white space, then a list marker with all the
// white space after it (or no marker), then the wrapper and `Slice :`; the value is the rest of the line, which holds
// no character `.` does not match.
const SLICE_MARKER = /(?:\d+[.)]|[-*])\s+/y
const SLICE_HEAD = /(\*\*|__)?(`)?\s*Slice\s*:/y

function sliceLabelOf(l) {
  let p0 = 0
  while (p0 < l.length && isWs(l[p0])) p0++
  const starts = []
  SLICE_MARKER.lastIndex = p0
  if (SLICE_MARKER.exec(l)) starts.push(SLICE_MARKER.lastIndex)
  starts.push(p0)
  for (const p of starts) {
    SLICE_HEAD.lastIndex = p
    const m = SLICE_HEAD.exec(l)
    if (!m) continue
    const value = l.slice(SLICE_HEAD.lastIndex).trimStart()
    // every way in reaches the same `Slice :`, so a value that cannot be read ends the line
    return TERMINATOR.test(value) ? null : { bold: m[1], tick: m[2], value }
  }
  return null
}

function readSliceLabel(itemLines) {
  for (const l of itemLines) {
    const m = sliceLabelOf(l)
    if (!m) continue
    let v = m.value.trim()
    if (m.bold) v = cutTrailingWrapper(v.replace(/^(\*\*|__)\s*/, ''), ['**', '__'])
    if (m.tick) v = cutTrailingWrapper(v, ['`'])
    v = v.trim()
    if (v) return v
  }
  return null
}

function readStepOne(body) {
  const item = stepOneLines(body)
  if (!item) return { text: '', candidates: [], sliceLabel: null }
  // Every backtick-quoted token that starts with `/`; no filtering (that is the `next` command's).
  const candidates = []
  for (const l of item) for (const m of l.matchAll(/`([^`]+)`/g)) if (m[1].startsWith('/')) candidates.push(m[1])
  return { text: item.join('\n'), candidates, sliceLabel: readSliceLabel(item) }
}

// ---- Reading Order -----------------------------------------------------------------------------------------------------

const LIST_ITEM = /^\s{0,3}(\d+[.)]|[-*])\s/

// A trailing hint is stripped before the path test and before resolving: ` §heading`, a trailing
// `(...)`, then `:12-34` / `#L12-L34`. (The corpus snapshot and this parser share this function.)
// (It is `.replace(/\s+§.*$/, '').replace(/\s*\([^)]*\)$/, '').replace(/[:#]L?\d+(-L?\d+)?$/, '')`, the first two done
// in one pass each.)
export function stripHint(token) {
  const sec = sectionHintAt(token, false)
  return cutParenRemark(sec ? token.slice(0, sec.start) : token).replace(/[:#]L?\d+(-L?\d+)?$/, '')
}

// No whitespace, no glob character, and either a path separator or a file-extension ending.
// (A version string such as `v9.0.1` passes the extension test; that is known and kept, because
// the corpus baseline was measured with this very rule.)
export function looksLikePath(p) {
  return p.length > 0 && !/\s/.test(p) && !/[*{]/.test(p) && (/[/\\]/.test(p) || /\.[A-Za-z0-9]+$/.test(p))
}

// The two range forms a Reading Order entry may carry: `path:START-END` (lines) and
// `path §heading text` (a section). A token with both reads as the line range; `:START` alone,
// `#L…` and a reversed range are hints, not ranges. -> { type, … } | null
export function parseRange(token) {
  let rest = token
  let heading = null
  // `/\s+§\s*(.*)$/` and `.replace(/\s*\([^)]*\)$/, '')`, each in one pass
  const sec = sectionHintAt(rest, true)
  if (sec) {
    heading = rest.slice(sec.at + 1).trim()
    rest = rest.slice(0, sec.start)
  }
  rest = cutParenRemark(rest)
  const m = /:(\d+)-(\d+)$/.exec(rest)
  if (m && +m[1] >= 1 && +m[1] <= +m[2]) return { type: 'lines', start: +m[1], end: +m[2] }
  if (heading) return { type: 'section', heading }
  return null
}

// One entry per list item of the section, in order:
//   - an item that starts with `이 문서` is the document itself (self: true, no path);
//   - otherwise the entry is the FIRST backtick-quoted token that looks like a path (a label, a
//     command or a heading before it is passed over): raw = the token as written, path = the
//     token without its hint, range = the D4 range form or null, isFile = true;
//   - an item with no such token is kept as a non-file entry (raw = the item text, isFile false).
// `isFile` is a statement about the SHAPE of the token; whether the file exists, is a folder or
// is readable is for the reader to find out.
export function readingOrderEntries(body) {
  const out = []
  if (!body) return out
  body.lines.forEach((l, i) => {
    if (body.flags[i] || !LIST_ITEM.test(l)) return
    if (/^\s{0,3}(\d+[.)]|[-*])\s+이 문서/.test(l)) {
      out.push({ raw: '이 문서', path: null, range: null, isFile: false, self: true })
      return
    }
    for (const m of l.matchAll(/`([^`]+)`/g)) {
      const raw = m[1].trim()
      const p = stripHint(raw)
      if (looksLikePath(p)) {
        out.push({ raw, path: p, range: parseRange(raw), isFile: true, self: false })
        return
      }
    }
    out.push({ raw: l.replace(LIST_ITEM, '').trim(), path: null, range: null, isFile: false, self: false })
  })
  return out
}

// The Reading Order entries of ANY text — no `# HANDOFF —` check — for the corpus snapshot tool,
// which must read the same entries the helper reads.
export function readingOrderOf(text) {
  const lines = splitLines(text)
  const flags = fenceFlags(lines)
  return readingOrderEntries(bodyOf(findSections(lines, flags), lines, flags, 'Reading Order'))
}

// ---- the Do NOT section: a pointer to another document ------------------------------------------------------------------------

// A document written before the contract required the section in full may carry it only as a reference to an earlier
// document: "same as the previous handoff's Do NOT: `docs/harness/handoff/x.md`". A resume that reads only this
// document loses the guardrails. `doNotRefOnly` says the section is such a pointer. The test is a heuristic with one
// documented direction of error: it answers true for a section that is short and refers to something, and never
// for an empty or missing section (that is `doNotMissing`, a separate problem), a rich section, or a guardrail that
// merely names a file. A wrong "true" costs one extra read of the pointed-to section (the briefing prints it with the
// document's own lines), a wrong "false" is the state before this field existed.
//
// The section is a pointer when ALL THREE hold:
//   1. a reference word occurs outside the reference anchors — one of CARRY below (same, see, carry/carried/inherit…,
//      previous, prior, earlier, unchanged; 이전, 직전, 동일, 승계, 참조, 그대로), so a guardrail that names a file
//      ("Do not edit `docs/spec.md`") is not a pointer;
//   2. it names a document: a reference anchor (a `.md` path in backticks, a markdown link) or one of the words of
//      DOCUMENT (handoff, document, 핸드오프, 문서) — so "동일 브랜치 push 금지" is a guardrail, not a pointer;
//   3. what is left of the section is shorter than POINTER_OWN_TEXT_MAX letters and digits once the reference anchors
//      (HTML comments, links, URLs, and backtick spans that are a `.md` path), the reference words and the filler words
//      of FILLER (articles, prepositions, "handoff", "document", "Do NOT" itself, …) are removed. A guardrail written
//      in a backtick pair that is not a `.md` path stays and counts.
// `doNotRef` is the first anchor in text order: the first backtick token that, with its trailing hint removed, looks
// like a path and ends in `.md`. A markdown link is not followed (conservative: a link-only pointer is still a pointer,
// with no path); null when the section is not a pointer or names no such path. The path is DATA: the caller validates it
// with the Reading Order's rule (reading-plan) before anything is read.
const CARRY = String.raw`\b(?:same|see|carry|carries|carried|carrying|inherit|inherits|inherited|previous|prior|earlier|unchanged)\b|이전|직전|동일|승계|참조|그대로`
const FILLER = String.raw`\b(?:a|an|as|the|of|in|on|at|to|from|with|its|it|this|that|these|those|and|or|is|are|be|over|all|still|apply|applies|valid|keep|kept|handoffs?|documents?|docs?|sections?|list|do|not|s)\b|핸드오프|문서|섹션|목록|전부|모두|유효|유지|적용`
const DOCUMENT = String.raw`\b(?:handoffs?|documents?)\b|핸드오프|문서`
const POINTER_OWN_TEXT_MAX = 12

// A backtick token that is a reference anchor -> its path without the hint; null otherwise.
function anchorPath(token) {
  const p = stripHint(token.trim())
  return looksLikePath(p) && /\.md$/i.test(p) ? p : null
}

export function readDoNot(body) {
  if (body === undefined) return { missing: true, refOnly: false, ref: null }
  const text = replaceComments(body, ' ')
  let ref = null
  let anchored = false
  const spans = text.replace(/`([^`\n]*)`/g, (_, tok) => {
    const a = anchorPath(tok)
    if (a !== null && ref === null) ref = a
    anchored ||= a !== null
    return a === null ? ` ${tok} ` : ' '
  })
  const rest = replaceLinks(spans, () => {
    anchored = true
    return ' '
  }).replace(/https?:\/\/\S+/g, ' ')
  const refers = new RegExp(CARRY, 'i').test(rest)
  const namesDocument = anchored || new RegExp(DOCUMENT, 'i').test(rest)
  const own = rest.replace(new RegExp(CARRY, 'gi'), ' ').replace(new RegExp(FILLER, 'gi'), ' ').replace(/[^\p{L}\p{N}]/gu, '')
  const refOnly = refers && namesDocument && own.length < POINTER_OWN_TEXT_MAX
  return { missing: false, refOnly, ref: refOnly ? ref : null }
}

// ---- the whole document -------------------------------------------------------------------------------------------------------

// The header alone — what `parseHandoff(text).header` is — read from the lines before the first section only, so
// `list` and `latest`, which need nothing else, never parse a body.
export function parseHeader(text) {
  const lines = splitLines(text)
  if (!lines[0].startsWith(HANDOFF_PREFIX)) {
    throw new InputError(`not a handoff document: the first line must start with "${HANDOFF_PREFIX}"`)
  }
  let first = lines.length
  const flags = fenceFlags(lines, (i, fenced) => {
    if (fenced || !/^## (?!#)/.test(lines[i])) return false
    first = i
    return true
  })
  return readHeader(lines, flags, first)
}

export function parseHandoff(text) {
  const lines = splitLines(text)
  if (!lines[0].startsWith(HANDOFF_PREFIX)) {
    throw new InputError(`not a handoff document: the first line must start with "${HANDOFF_PREFIX}"`)
  }
  const flags = fenceFlags(lines)
  const secs = findSections(lines, flags)

  // No prototype: a section titled `toString` or `__proto__` is an ordinary key.
  const sections = Object.create(null)
  for (const s of secs) {
    if (!Object.hasOwn(sections, s.name)) sections[s.name] = trimBlankEdges(lines.slice(s.start + 1, s.end)).join('\n')
  }
  const body = (name) => bodyOf(secs, lines, flags, name)
  const fixedLabels = readFixedLabels(body('In Progress'))
  const doNot = readDoNot(sections['Do NOT'])

  return {
    header: readHeader(lines, flags, secs.length ? secs[0].start : lines.length),
    sections,
    fixedLabels,
    harness: readHarness(body('In Progress'), fixedLabels),
    ledger: readLedger(body('Progress Ledger')),
    stepOne: readStepOne(body('Next Steps')),
    readingOrder: readingOrderEntries(body('Reading Order')),
    doNotMissing: doNot.missing,
    doNotRefOnly: doNot.refOnly,
    doNotRef: doNot.ref,
  }
}
