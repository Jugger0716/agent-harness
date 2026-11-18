// The Progress Ledger a new handoff document starts from: which earlier document it is read from,
// which Epic that ledger is about, and which of its rows are carried forward. The model does not read
// earlier documents for this any more — `generate` Step 1 item 5 runs the two commands built on this
// file (`latest-epic`, `ledger-carry`) and writes what they return.
//
// The carry rule (D5):
//   - a ledger carries the rows of ONE Epic; a row of another Epic is never carried;
//   - every UNFINISHED row of that Epic is carried in full. "Finished" is Status `done` or `dropped`;
//     everything else is unfinished — `in-progress`, `blocked`, `planned` and any value outside the
//     enum: an unknown value must never cost a row, so it counts as unfinished and is reported in
//     `unknownStatusRows`;
//   - of the finished rows only the most recent `keepDone` (default 5) are carried; `droppedDone`
//     says how many were left out. Rows keep the order they have in the document.
//   So the carried count is `unfinished + min(keepDone, finished)`: it is bounded only where the
//   unfinished rows are, and no row of work still to do is ever dropped.
//
// Cells: `epic` and `status` come out as `parse.mjs` reads them (one `**…**`/`__…__` pair, then one
// backtick pair, removed); `slice`, `evidence` and `notes` come out as written, trimmed (a missing
// column reads as null). The Epic given to a command is read the same way, so `` `ep` `` and `**ep**`
// name the Epic `ep`.
//
// A row whose Epic cell is present but EMPTY names no Epic, and is work all the same: it is carried as the
// requested Epic's — its `epic` filled in, the unfinished/finished rule applied as to any row — and counted in
// `unattributedRows`, so the person can check it. That holds only for an Epic the document NAMES in at least one
// row — an Epic it does not name gets no rows at all, so an empty `rows` always means "this document holds none
// of it" — and a blank row of a document that names several Epics is carried with each one asked for. A ledger
// with no Epic COLUMN names no Epic at all: nothing is carried from it. With `--dir`, the same rule picks the
// source: only a row that names the Epic makes a document the source, blank rows alone never do.
//
// The chain of earlier rows: a new document whose carry left finished rows out writes an `Earlier rows:
// <file name>` line under its table, naming the SOURCE document (`pointer`). A source that itself carries
// such a line is `chained`: the rows behind ITS line are still earlier than the new document, so the new
// document writes a line too — naming the source, never repeating the source's own line. `chained` is a fact
// about the source document: an `Earlier rows:` line (a value after the colon; bare or in bold) outside a
// code fence, in the document's `## Progress Ledger` section.
//
// Which documents are looked at: the `*.md` files of ONE folder (no recursion) whose first line starts
// with `# HANDOFF —`, ordered newest first by `orderDocs` (paths.mjs), at most the newest
// SCAN_CAP of them — a file that is not a handoff document does not use up the cap. A folder that does
// not exist holds no document (the first handoff of a project is written into a folder that is not
// there yet); a path that is not a folder, or a document that cannot be read, is an InputError.
import fs from 'node:fs'
import path from 'node:path'
import { InputError } from './errors.mjs'
import { HANDOFF_PREFIX, fenceFlags, findSections, parseHandoff, splitLines, stripEmphasis } from './parse.mjs'
import { orderDocs } from './paths.mjs'

export const STATUSES = ['done', 'in-progress', 'blocked', 'planned', 'dropped']
const FINISHED = new Set(['done', 'dropped'])
export const KEEP_DONE = 5
export const SCAN_CAP = 20

export const isFinished = (status) => FINISHED.has(status)

// parse.mjs's ledger rows -> { rows: [{ epic, slice, status, evidence, notes }], droppedDone, unknownStatusRows,
// unattributedRows }. `epic` is the Epic to carry (read normalised, like the cells). Only that Epic's rows are
// looked at — and, when some row names it, the rows whose Epic cell is empty (see above): they are carried as this
// Epic's, their `epic` filled in, and the carried ones are counted in `unattributedRows`.
export function carryLedger(rows, epic, { keepDone = KEEP_DONE } = {}) {
  if (!Number.isInteger(keepDone) || keepDone < 0) throw new Error('carryLedger: keepDone must be a whole number, 0 or more')
  const want = stripEmphasis(epic)
  const named = rows.some((r) => r.epic === want)
  const mine = rows.filter((r) => r.epic === want || (named && r.epic === ''))
  const finishedAt = []
  mine.forEach((r, i) => {
    if (isFinished(r.status)) finishedAt.push(i)
  })
  const keptFinished = new Set(finishedAt.slice(Math.max(0, finishedAt.length - keepDone)))
  const carried = mine.filter((r, i) => !isFinished(r.status) || keptFinished.has(i))
  return {
    rows: carried.map(({ epic: e, slice, status, evidence, notes }) => ({ epic: e === '' ? want : e, slice, status, evidence, notes })),
    droppedDone: finishedAt.length - keptFinished.size,
    unknownStatusRows: carried.filter((r) => !STATUSES.includes(r.status)).length,
    unattributedRows: carried.filter((r) => r.epic === '').length,
  }
}

// The Epic of a ledger: its last row's. A row with no Epic value cannot name one, so the last row that has
// one is used; null when no row has.
export function epicOfRows(rows) {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].epic) return rows[i].epic
  return null
}

// A leading BOM is ignored, as parse.mjs ignores it.
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)

// The handoff documents of `dir`, newest first, at most `cap` of them -> { name, file, text, mtimeMs } one at a time,
// so a caller that finds what it wants stops reading. (`list` and `latest` use it too: `list` with no cap, `latest` until
// the date changes.)
export function* scanHandoffDocs(dir, cap = SCAN_CAP) {
  let names
  try {
    names = fs.readdirSync(dir)
  } catch (e) {
    if (e.code === 'ENOENT') return
    throw new InputError(`cannot read folder ${dir}: ${e.code || e.message}`)
  }
  const files = []
  for (const name of names) {
    if (!/\.md$/i.test(name)) continue
    const file = path.join(dir, name)
    let st
    try {
      st = fs.statSync(file)
    } catch {
      continue
    }
    if (st.isFile()) files.push({ name, file, mtimeMs: st.mtimeMs })
  }
  let seen = 0
  for (const d of orderDocs(files)) {
    if (seen >= cap) return
    let text
    try {
      text = fs.readFileSync(d.file, 'utf8')
    } catch (e) {
      throw new InputError(`cannot read ${d.file}: ${e.code || e.message}`)
    }
    if (!stripBom(text).startsWith(HANDOFF_PREFIX)) continue
    seen++
    yield { name: d.name, file: path.resolve(d.file), text, mtimeMs: d.mtimeMs }
  }
}

const rowsOf = (text) => {
  const ledger = parseHandoff(text).ledger
  return ledger ? ledger.rows : []
}

// Does the document carry an `Earlier rows:` line (see the chain above)? Read with parse.mjs's own section and
// code-fence reading, so the line is looked for only in the first `## Progress Ledger` section, outside fences.
// A value that starts with `<` is the Step 2 template's own placeholder, copied and never filled in: no pointer.
const EARLIER_ROWS = /^\s*(?:\*\*|__)?\s*Earlier rows\s*:(?:\*\*|__)?\s*[^\s<]/i

function hasEarlierRowsLine(text) {
  const lines = splitLines(text)
  const flags = fenceFlags(lines)
  const sec = findSections(lines, flags).find((x) => x.name === 'Progress Ledger')
  if (!sec) return false
  for (let i = sec.start + 1; i < sec.end; i++) if (!flags[i] && EARLIER_ROWS.test(lines[i])) return true
  return false
}

// `latest-epic`: the Epic of the newest document that has a ledger with a row (its last row's Epic, normalised)
// and that document's path -> { epic, doc }; both null when no document has one. A row with no Epic cell cannot
// name an Epic, so the last row that has one is used; `next.mjs` and the corpus measurement take the literal last
// row's Epic, and the two differ only when that cell is empty.
export function latestEpic(dir) {
  for (const d of scanHandoffDocs(dir)) {
    const epic = epicOfRows(rowsOf(d.text))
    if (epic !== null) return { epic, doc: d.file }
  }
  return { epic: null, doc: null }
}

// `ledger-carry --doc`: the rows of one document -> { doc, rows, droppedDone, unknownStatusRows, unattributedRows, pointer, chained }
// `pointer` is the document's own file name — the value of the `Earlier rows:` line a new document writes when
// finished rows were left out or when this document is `chained`. It is never read from an `Earlier rows:` line the
// document itself carries: the chain is "new document -> this document -> the one its own line names".
export function carryFromText(text, epic, file, opts) {
  return { doc: path.resolve(file), ...carryLedger(rowsOf(text), epic, opts), pointer: path.basename(file), chained: hasEarlierRowsLine(text) }
}

// `ledger-carry --dir`: the newest document that has rows of this Epic, carried; no such document -> no rows and
// `doc` null (a new ledger starts).
export function carryFromDir(dir, epic, opts) {
  const want = stripEmphasis(epic)
  for (const d of scanHandoffDocs(dir)) {
    const rows = rowsOf(d.text)
    if (rows.some((r) => r.epic === want)) return { doc: d.file, ...carryLedger(rows, want, opts), pointer: d.name, chained: hasEarlierRowsLine(d.text) }
  }
  return { doc: null, rows: [], pointer: null, droppedDone: 0, unknownStatusRows: 0, unattributedRows: 0, chained: false }
}
