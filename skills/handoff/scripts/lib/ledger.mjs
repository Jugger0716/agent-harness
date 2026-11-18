// The Progress Ledger a new handoff document starts from: which earlier document it is read from,
// which Epic that ledger is about, and which of its rows are carried forward. The model does not read
// earlier documents for this any more — `generate` Step 1 item 5 runs the two commands built on this
// file (`latest-epic`, `ledger-carry`) and writes what they return.
//
// The carry rule (D5):
//   - a ledger carries the rows of ONE Epic; a row of another Epic is never carried;
//   - every UNFINISHED row of that Epic is carried in full. "Finished" is Status `done` or `dropped`;
//     everything else is unfinished — `in-progress`, `blocked`, `planned` and any value outside the
//     enum (a real document has `not-started`, `todo`, `done(partial)`): an unknown value must never
//     cost a row, so it counts as unfinished and is reported in `unknownStatusRows`;
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
// Which documents are looked at: the `*.md` files of ONE folder (no recursion) whose first line starts
// with `# HANDOFF —`, ordered newest first by `orderDocs` (paths.mjs), at most the newest
// SCAN_CAP of them — a file that is not a handoff document does not use up the cap. A folder that does
// not exist holds no document (the first handoff of a project is written into a folder that is not
// there yet); a path that is not a folder, or a document that cannot be read, is an InputError.
import fs from 'node:fs'
import path from 'node:path'
import { InputError } from './errors.mjs'
import { HANDOFF_PREFIX, parseHandoff, stripEmphasis } from './parse.mjs'
import { orderDocs } from './paths.mjs'

export const STATUSES = ['done', 'in-progress', 'blocked', 'planned', 'dropped']
const FINISHED = new Set(['done', 'dropped'])
export const KEEP_DONE = 5
export const SCAN_CAP = 20

export const isFinished = (status) => FINISHED.has(status)

// parse.mjs's ledger rows -> { rows: [{ epic, slice, status, evidence, notes }], droppedDone, unknownStatusRows }
// `epic` is the Epic to carry (read normalised, like the cells). Only that Epic's rows are looked at.
export function carryLedger(rows, epic, { keepDone = KEEP_DONE } = {}) {
  if (!Number.isInteger(keepDone) || keepDone < 0) throw new Error('carryLedger: keepDone must be a whole number, 0 or more')
  const want = stripEmphasis(epic)
  const mine = rows.filter((r) => (r.epic ?? '') === want)
  const finishedAt = []
  mine.forEach((r, i) => {
    if (isFinished(r.status)) finishedAt.push(i)
  })
  const keptFinished = new Set(finishedAt.slice(Math.max(0, finishedAt.length - keepDone)))
  const carried = mine.filter((r, i) => !isFinished(r.status) || keptFinished.has(i))
  return {
    rows: carried.map(({ epic: e, slice, status, evidence, notes }) => ({ epic: e, slice, status, evidence, notes })),
    droppedDone: finishedAt.length - keptFinished.size,
    unknownStatusRows: carried.filter((r) => !STATUSES.includes(r.status)).length,
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

// The handoff documents of `dir`, newest first, at most `cap` of them -> { name, file, text } one at a time,
// so a caller that finds what it wants stops reading.
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
    yield { name: d.name, file: path.resolve(d.file), text }
  }
}

const rowsOf = (text) => {
  const ledger = parseHandoff(text).ledger
  return ledger ? ledger.rows : []
}

// `latest-epic`: the Epic of the newest document that has a ledger with a row (its last row's Epic, normalised)
// and that document's path -> { epic, doc }; both null when no document has one.
export function latestEpic(dir) {
  for (const d of scanHandoffDocs(dir)) {
    const epic = epicOfRows(rowsOf(d.text))
    if (epic !== null) return { epic, doc: d.file }
  }
  return { epic: null, doc: null }
}

// `ledger-carry --doc`: the rows of one document -> { doc, rows, pointer, droppedDone, unknownStatusRows }
// `pointer` is the document's own file name — the value of the `Earlier rows:` line a new document writes when
// finished rows were left out. It is never read from an `Earlier rows:` line the document itself carries: the
// chain is "new document -> this document -> the one its own line names".
export function carryFromText(text, epic, file, opts) {
  return { doc: path.resolve(file), ...carryLedger(rowsOf(text), epic, opts), pointer: path.basename(file) }
}

// `ledger-carry --dir`: the newest document that has rows of this Epic, carried; no such document -> no rows and
// `doc` null (a new ledger starts).
export function carryFromDir(dir, epic, opts) {
  const want = stripEmphasis(epic)
  for (const d of scanHandoffDocs(dir)) {
    const rows = rowsOf(d.text)
    if (rows.some((r) => (r.epic ?? '') === want)) return { doc: d.file, ...carryLedger(rows, want, opts), pointer: d.name }
  }
  return { doc: null, rows: [], pointer: null, droppedDone: 0, unknownStatusRows: 0 }
}
