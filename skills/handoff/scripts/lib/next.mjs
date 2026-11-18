// The `Next :` derivation and the command candidates of a resume briefing. It reads the result of
// parseHandoff() (lib/parse.mjs) and nothing else: never the file system, never git. What the rules
// mean for the briefing is written once, in templates/handoff/resume.md Step 5; this file is the
// code the contract points at.
//
//   deriveNext(parsed, { stateRelevant }) -> {
//     slice:    the `Next :` value, or null when the answer is an ambiguity;
//     source:   "label" | "in-progress" | "docs" | "step-one";
//     ambiguous: [slice, ...] — the `Slice` of each in-progress row when the label is absent and two
//                or more rows are in progress, else [];
//     commandCandidates: [token, ...] — see below,
//   }
//
// The value comes from the first tier that has one:
//   1. label        the `Slice :` label line of Next Steps item 1 (read without a ledger too);
//   2. in-progress  else, when EXACTLY ONE row of the document's Epic — the Epic of the LAST ledger
//                   row — has Status `in-progress`, that row's `Slice`. Two or more is an ambiguity:
//                   nothing is picked, `slice` is null, `ambiguous` lists the rows, `source` is
//                   "step-one" (item 1 is what the briefing prints). A last row that is `done` is
//                   never the next slice;
//   3. docs         else, only when `stateRelevant` is true, the last path segment of the recorded
//                   `Docs` value (one trailing `/` dropped first);
//   4. step-one     else Next Steps item 1 verbatim (`stepOne.text`; '' when the document has none).
// A `Slice` cell and a label value are used with ONE wrapping `**…**` / `__…__` pair and then ONE
// backtick pair removed (parse.mjs's stripEmphasis, which already reads the Status and Epic cells).
// A missing value — no `Slice` column, an empty cell, a label that is only a wrapper — is "no value":
// that tier does not answer and the next one is tried. A single in-progress row without a value is
// not an ambiguity; two in-progress rows are one, and a row without a value keeps its place in
// `ambiguous` as ''.
//
// `commandCandidates` is every backtick token of Next Steps item 1 that has the SHAPE of a slash
// command, in text order, byte for byte (no trimming, no de-duplication): `/`, a name that starts
// with a lowercase letter and is made of [a-z0-9:-], then the end of the token or a space and its
// arguments. `/dev/null`, `/usr/bin/x` and `/C:/x` are therefore not commands, while a command whose
// ARGUMENTS hold a path is one token. The self call (`/handoff`, also plugin-qualified) is dropped.
// Whether item 1 presents a token as the command to run or only mentions it ("these slices are not
// `/harness` tasks") is a reading of prose and stays with the caller; this file never decides it.
import { stripEmphasis } from './parse.mjs'

const clean = (cell) => stripEmphasis(cell === null || cell === undefined ? '' : cell)

// The text after the last `/`, once a single trailing `/` is dropped; null when nothing is left.
function docsSegment(docs) {
  if (typeof docs !== 'string') return null
  const d = docs.trim().replace(/\/$/, '')
  const seg = d.slice(d.lastIndexOf('/') + 1)
  return seg === '' ? null : seg
}

const COMMAND_SHAPE = /^\/([a-z][a-z0-9:-]*)(?: .*)?$/

// `/handoff` and `/<plugin>:handoff`; the name is matched whole, so `/handoff-notes` is not it.
const isSelfCall = (name) => name === 'handoff' || name.endsWith(':handoff')

// tokens: parse's `stepOne.candidates` (every backtick token of item 1 that starts with `/`).
export function commandCandidatesOf(tokens) {
  return tokens.filter((t) => {
    const m = COMMAND_SHAPE.exec(t)
    return m !== null && !isSelfCall(m[1])
  })
}

export function deriveNext(parsed, { stateRelevant = false } = {}) {
  const commandCandidates = commandCandidatesOf(parsed.stepOne.candidates)
  const answer = (slice, source, ambiguous = []) => ({ slice, source, ambiguous, commandCandidates })

  const label = clean(parsed.stepOne.sliceLabel)
  if (label !== '') return answer(label, 'label')

  const rows = parsed.ledger ? parsed.ledger.rows : []
  if (rows.length) {
    const epic = rows[rows.length - 1].epic
    const live = rows.filter((r) => r.epic === epic && r.status === 'in-progress')
    if (live.length >= 2) return answer(null, 'step-one', live.map((r) => clean(r.slice)))
    if (live.length === 1 && clean(live[0].slice) !== '') return answer(clean(live[0].slice), 'in-progress')
  }

  if (stateRelevant) {
    const seg = docsSegment(parsed.fixedLabels ? parsed.fixedLabels.Docs : null)
    if (seg !== null) return answer(seg, 'docs')
  }

  return answer(parsed.stepOne.text, 'step-one')
}
