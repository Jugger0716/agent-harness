# Segment launch — copy the script under the working directory, launch, delete the copy (single source)

> Cited by name from every `Workflow { scriptPath: … }` site in `skills/*/SKILL.md` and
> `templates/harness/*.md`, and from `templates/_shared/mode_gate.md` rules 2 and 3. Apply it at
> every Workflow call — the dispatch sites say so in the imperative. Nothing here changes which
> segment runs or what it receives; it changes only WHERE the script is read from, and adds one
> deletion: the copy this procedure itself creates.

## Why a copy

The `Workflow` tool accepts a `scriptPath` only when it is a path the tool itself returned, or a
file under the working directory or a directory the user added to the session. An installed
plugin's `${CLAUDE_PLUGIN_ROOT}/workflows/` is neither, and the call is refused with
`scriptPath must be a script path this tool returned, or a file you can already read`. Measured
2026-09-18 in the plugin repository (its `design/harness-prompt-diet/PROBE.md`, fifth probe §Observed
sequence — run B item 3, and finding 1): the plugin-root path was refused twice in one run,
opening the file with the Read tool first did not lift the refusal, and the run fell back to
INLINE with the banner — visibly, not silently. A zero-agent probe script placed at
`.harness/wf/probe.workflow.js` then launched on the first try via that repository-relative path.
No WORKFLOW-path run from an installed copy is recorded in the plugin repository's `design/`
probe records; the successful segment runs its CHANGELOG and ROADMAP record by `runId` do not
record their launch path. The checkout's own `workflows/` directory played no part in the
fallback and is not a launch surface: a dispatch site never carries a repository-relative
`workflows/…` path, because that resolves only inside the plugin's own checkout.

**Correction, appended 2026-09-28:** the "no WORKFLOW-path run from an installed copy" sentence
above was true when written and is not any more. The sixth probe in that same `PROBE.md` ran
`harness.plan` (three agents) and `harness.critic` (one agent) from `.harness/wf/` copies of the
installed plugin in one `/harness --mode standard` session: both launched on the first attempt,
ran to completion and returned schema-valid results, and the copy was gone after each. No other
segment has been measured launching this way.

## Procedure (every launch — first launch, retry and re-run alike)

0. Confirm `${CLAUDE_PLUGIN_ROOT}` resolves to a non-empty value and that
   `${CLAUDE_PLUGIN_ROOT}/workflows/<skill>.<segment>.workflow.js` exists. Either check failing
   is a launch failure (§Failure) — `templates/harness/doctor.md` item ④ already treats an
   unresolved root as a diagnosable condition, and a `cp` from an empty root would fail anyway.
   `${CLAUDE_PLUGIN_ROOT}` names a value here, not a shell variable to rely on: in the sixth
   probe (the plugin repository's `design/harness-prompt-diet/PROBE.md`, 2026-09-28) it was
   unset in the session's `Bash` tool, so taken literally this step's non-empty check fails on
   every launch (and step 2's `cp` would read from `/workflows/…`). Substitute the literal root
   before running steps 0–2: the directory Claude Code reports as the invoking skill's base
   directory, minus its last two components — `skills/` and the invoking skill's own directory,
   which is not always the script's `<skill>` prefix (`/harness-build` launches `harness.build`).
1. `mkdir -p .harness/wf` — `.harness/` is the directory every launching skill already creates
   or touches (a stateless skill declares it session-scoped audit space; that declaration is not
   weakened, because step 4 removes what this procedure adds).
2. `cp "${CLAUDE_PLUGIN_ROOT}/workflows/<skill>.<segment>.workflow.js" .harness/wf/` — overwrite
   unconditionally, then confirm the copy exists. `cp` preserves whatever bytes the source has:
   an LF source stays LF, and a CR-contaminated installed copy (the condition
   `templates/harness/doctor.md` item ① exists to detect) is copied CR-contaminated, which the
   permission layer then refuses — §Failure routes that to INLINE, and item ①'s remediation is
   the fix, not anything in this file.
3. Launch with the repository-relative path: `scriptPath: ".harness/wf/<skill>.<segment>.workflow.js"`.
   `args` are unchanged — the script is byte-identical to the shipped one.
4. **Delete `.harness/wf/` as soon as the `Workflow` call has returned** — success, engine error
   or refusal alike. The copy is launch-scoped: a retry or re-run performs steps 0–3 again, and
   no launching skill performs a `runId` resume at all (`resumeFromRunId` appears in the skills
   only as a same-session audit note or a prohibition), so no later step needs the file. This
   deletion is what keeps the skills' existing cleanup steps
   true — `codebase-audit`, `deep-review` and `study` remove `.harness/` only "if empty", and
   `/debug` has no end-of-session cleanup at all; a copy left behind would defeat the first three
   and leak in the fourth.
   **"Has returned" — here and in every dispatch site's "once this call returns" — means the run
   has finished.** The `Workflow` tool answers a launch at once with a task id and runs the
   script in the background, so for an accepted launch the moment to delete is the run's
   completion notification — its result or its engine error — never the task-id answer; for a
   refused launch it is the refusal itself. The same sixth probe deleted each copy only after the
   completion notification; whether the engine re-reads the script after launch was not
   measured, which is why the earlier moment is not allowed. For the same reason, and because
   this step removes the whole directory, do not start a second launch before the first run's
   completion notification.

The dispatch sites write the plugin-root path beside the `.harness/wf/` one so the shipped file is
still named at the point of use; the copy is a launch mechanism, not a second source.

## Failure

A failed step 0 or 2 (unresolved root, missing source, no `Bash` tool, `cp` error, `.harness/`
not writable, copy absent afterwards) is a **launch failure** and takes
`templates/_shared/mode_gate.md` rule 3's graceful fallback — INLINE, with the banner. So does a
refusal of the `.harness/wf/` path itself, which would mean the working directory is not what the
session believes it is. Neither is a permission denial; rule 3's denial branch is for
`Permission to use Workflow has been denied.` only. Step 4 runs on every one of these outcomes too.

## In a repository that does not ignore `.harness/`

This repository's `.gitignore` covers `.harness/`; a target repository may not. There the copy is
an untracked file for the window between steps 2 and 4 — for an accepted launch that is the whole
background run (minutes, in the sixth probe), closed by its completion notification, and never
longer, because step 4 is unconditional — and `/ship`'s pre-commit check for `.harness/` files in
the staging list (`skills/ship/SKILL.md`) is the existing net for anything a crashed session leaves
behind.

## What this does not do

- It does not make `/harness doctor` launch anything — item ② keeps reporting the tool's presence
  from the session's tool list, because doctor writes nothing, and this file's copy is a write.
- It does not change what any skill's own cleanup step deletes: the copy is removed by step 4,
  inside the launching step, before those cleanup steps run (`/spec`'s cleanup sentence now
  names `wf/` in its enumeration, which changes the wording, not the deletion).
- It does not apply to `/harness-gate`, which holds neither `Bash` nor `Workflow` and launches
  nothing.
