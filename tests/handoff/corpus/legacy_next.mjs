// The CURRENT (9.0.1) `Next :` derivation, reproduced from the contract text so that before/after
// numbers can be taken against it. This is a TEST-SIDE file on purpose: the rule it implements is
// the one the handoff diet replaces, and it must not ship in skills/handoff/scripts/.
//
// Source of truth: the 9.0.1 contract text — "`Next :` derivation — three-tier fallback" in
// §Sub-command: resume, Step 5 of skills/handoff/SKILL.md, which the contract split moved to
// templates/handoff/resume.md and the label-first rule then replaced (`git log -S"three-tier
// fallback"` finds the commits) — and generate Step 1 items 4 and 5 for the label and the ledger
// columns:
//
//   1. A NON-EMPTY Progress Ledger table. Its Epic is the Epic cell of its LAST row, read as
//      written (normalising the Epic cell is a deferred item in 9.0.1). Among that Epic's rows:
//        in-progress  the `Slice` of the LAST row whose `Status` — after stripping one `**`/`__`
//                     pair and then one backtick pair — is `in-progress`;
//        label        else the value of the `Slice :` label line of Next Steps item 1;
//        last-row     else the `Slice` of the Epic's LAST row, whatever its Status.
//      A `Slice` or label value wrapped in ONE backtick pair loses exactly that pair; unbalanced
//      backticks leave it untouched. Nothing else is stripped.
//   2. docs      else the last segment of the `Docs :` value in the In Progress fixed-label block
//                (one trailing `/` dropped first, then the text after the final `/`).
//   3. step-one  else Next Steps item 1 verbatim.
//
// Judgement calls (the contract is silent; each is fixed here so a run is repeatable):
//   - Item 1 and the label are whatever parse.mjs reads — the `1.` item, else the first bullet;
//     a label wrapped in bold (`**Slice : x**`) counts, `**Slice A …**` does not.
//   - A `Docs :` line counts when it is the only fixed label present, and a value that is empty
//     counts as "not recorded".
//   - The label is used only inside tier 1 (the contract nests it there): a label in a document
//     without a ledger is never read.
//   - A ledger without a `Slice` column gives every row a null slice, which is "no value": a row
//     that cannot name a slice does not answer, and the derivation moves on to the next tier
//     (an EMPTY cell is a value as written, and answers with '').
//
// `deriveLegacyNext(parsed)` takes the result of parseHandoff() and returns { slice, source } with
// source one of "in-progress" | "label" | "last-row" | "docs" | "step-one". `legacyTiers(parsed)`
// lists every tier's candidate (null when a tier does not apply) for the corpus metrics.

// One outer backtick pair is Markdown, not part of the value. A missing cell (null) stays null.
function unwrapBackticks(v) {
  if (v === null || v === undefined) return null
  return v.length >= 2 && v.startsWith('`') && v.endsWith('`') ? v.slice(1, -1) : v
}

function lastSegment(docs) {
  const d = docs.endsWith('/') ? docs.slice(0, -1) : docs
  return d.slice(d.lastIndexOf('/') + 1)
}

export function legacyTiers(parsed) {
  const rows = parsed.ledger ? parsed.ledger.rows : []
  const ledger = rows.length > 0
  const labelRaw = parsed.stepOne.sliceLabel
  const docsRaw = parsed.fixedLabels ? parsed.fixedLabels.Docs : null
  const t = {
    ledger,
    inProgress: null,
    label: labelRaw === null ? null : unwrapBackticks(labelRaw),
    lastRow: null,
    docs: docsRaw ? lastSegment(docsRaw) : null,
    stepOne: parsed.stepOne.text,
  }
  if (ledger) {
    const epic = rows[rows.length - 1].epicRaw
    const mine = rows.filter((r) => r.epicRaw === epic)
    const ip = mine.filter((r) => r.status === 'in-progress')
    if (ip.length) t.inProgress = unwrapBackticks(ip[ip.length - 1].slice)
    t.lastRow = unwrapBackticks(mine[mine.length - 1].slice)
  }
  return t
}

export function deriveLegacyNext(parsed) {
  const t = legacyTiers(parsed)
  if (t.ledger) {
    if (t.inProgress !== null) return { slice: t.inProgress, source: 'in-progress' }
    if (t.label !== null) return { slice: t.label, source: 'label' }
    if (t.lastRow !== null) return { slice: t.lastRow, source: 'last-row' }
  }
  if (t.docs !== null) return { slice: t.docs, source: 'docs' }
  return { slice: t.stepOne, source: 'step-one' }
}
