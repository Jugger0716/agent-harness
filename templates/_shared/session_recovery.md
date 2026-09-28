# Session Recovery — shared procedure (single source)

> Cited by name from `skills/harness/SKILL.md` §Session Recovery and
> `skills/harness-build/SKILL.md` §Session Recovery. Those files own what is skill-specific: the
> entry carve-outs, the `docs_path` drift check, and the phase jump table that decides which step
> a Resume lands on. Everything below is identical for both and is defined ONCE, here.
>
> Item numbering is shared: a citing skill may insert its own items (6.5, and its jump table under
> item 7's **Resume** action) without renumbering these.

Cross-session continuity uses the `state.json` phase machine below. Workflow `runId`s are recorded in `state.runs` for audit; `resumeFromRunId` is **same-session only** — across sessions, re-run the segment.

Before starting a new task, check whether `.harness/state.json` exists:

1. **Read state.json and route on `skill` and `version` together BEFORE anything else in this section.** Find the matching row, carry out its route, and do NOT continue to Step 1 before doing so.
   <!-- SYNC-WITH: templates/_shared/session_conflict.md §Gate Procedure -->

   | `skill` | `version` | route |
   |---|---|---|
   | present, `!= "harness"` | any | **Session Conflict gate** (below) |
   | absent | `"3.0"` | **Session Conflict gate** — a v3 file is `version "3.0"` AND `skill: "harness"` (`skills/harness/SKILL.md` §Orchestrator Contract); one with no `skill` is not a well-formed /harness session |
   | absent | missing or non-`"3.0"` | **item 2's legacy branch** — do NOT gate; gating it would make item 2 unreachable |
   | `"harness"` | any | **no gate** — continue to item 2. This is the normal resume: every state.json `/harness` writes carries `skill: "harness"` from its first write (`skills/harness/SKILL.md` §Step 1 item 7), so do not stop at rows 1–2 |

   **Session Conflict gate** — rows 1–2 only. Never fall through to this skill's §Fresh Start, which would overwrite the other session ungated. Ask via AskUserQuestion (in `user_lang`): header "Session Conflict"; question "A `/{skill|'unknown'}` session exists in this directory (task: `{task}`, phase: `{phase}`, docs: `{docs_path}`). Starting a new session here will delete it. Delete it and start?"; options "Delete and start" / "Delete .harness/ and proceed with this skill's §Fresh Start", "Cancel" / "Keep existing session and halt". "Cancel" → halt before any directory creation, `git checkout -b`, or state.json write. "Delete and start" → delete `.harness/`, then §Fresh Start. A session that cannot present an interactive prompt (headless / cron / sub-agent) → halt, never a silent overwrite. Substitute every `{...}` from the conflicting session's own state.json. Full procedure: `templates/_shared/session_conflict.md` §Gate Procedure, cited by name.

2. **`version`:** missing, `"2.0"` or any non-`"3.0"` → pre-harness `/workflow` session. Print per OLC `[harness] Pre-harness session detected (v{version|1}) — created by /workflow. Restart recommended; legacy resume is not supported.` and ask (in `user_lang`): header "Session", question "Pre-harness session found. Restart fresh or stop?", options "Restart" / "Delete .harness/ and start fresh", "Stop" / "Keep files and halt". No Resume option (no silent migration). `"3.0"` → continue.
3. Print status in standard format, prefixed `[harness] Previous session detected.`
4. Restore `model_config`; apply it to every later sub-agent launch and Workflow `args.models`.
5. Restore `conventions`. If it starts with `"file:"` and the file is missing, set `conventions → null` (Step 1.5 re-runs on resume).
6. If `has_git` is absent, re-detect and store it. Re-resolve §Mode Gate (the new session may lack the Workflow tool or the opt-in) and update `path_resolved`; do NOT re-fire §Ambiguity Prompt — reuse the stored `mode` + `path_resolved`, and only the workflow→inline downgrade may change `path_resolved`.

7. **Resume-suppression check** (priority order, evaluated before any question in this item renders):
   - **(a) Epic residue** — `state.epic.boundaries != null AND state.phase == "completed"`: do not offer "Resume" (`completed` is not epic-exit-only — `skills/harness-build/SKILL.md` §Step 7 "If PASS" writes it before Step 8 starts — so this check stays narrowed to the epic case). Print one disclosure line (in `user_lang`), then ask with the header below, question "[harness] Epic session residue detected. Restart or stop?", options `{"Restart" / "Delete .harness/ and start fresh", "Stop" / "Delete .harness/ and halt"}` — no "Resume", no "View state only". This is the 3rd defense layer behind `skills/harness-build/SKILL.md` §Step 3.6's `phase → "completed"`-before-delete ordering: a failed delete there leaves exactly this state.

   - **(b)** A citing skill may insert its own additional suppression check here — `/harness`'s `docs_path` drift check is one, and it is defined in that skill, not here.
   - Otherwise ask via AskUserQuestion (in `user_lang`): header "Session"; question "[harness] Previous session detected. [standard status]. Resume, restart, stop, or view state only?"; options "Resume" / "Continue from {phase}", "Restart" / "Delete .harness/ and start fresh", "Stop" / "Delete .harness/ and halt", "View state only" / "Print the recorded session state and halt — `.harness/` is NOT deleted (unlike the usual Stop). Calling `/harness` again re-renders this gate."

   Actions:
   - **Resume**: first run the Safety Guard re-validation — read `docs_path` directly from state.json (**never recompute from `cli_flags.output_dir`**, which is audit/record only) and run `validate_path(docs_path, kind=output_dir)`; on failure print `[harness] ⚠ Recovered docs_path failed validation: <path>` and treat as Restart. Then jump to the state matching `phase` (segments are re-RUN, never runId-resumed, across sessions):
     - *— the citing skill's own phase jump table belongs HERE, between the Safety Guard and the
       actions below. `skills/harness/SKILL.md` and `skills/harness-build/SKILL.md` each define
       their own; neither is restated in this file. —*
   - **Restart**: delete `.harness/` and proceed to this skill's §Fresh Start.
   - **Stop**: delete `.harness/` and halt.
   - **View state only** (offered ONLY by the "Otherwise" branch above — neither (a) nor a citing skill's own (b) offers it): print the standard status block (§Standard Status Format, by name — its `Path` row already carries `path_resolved`) plus the fields it lacks: `docs_path`, `verify.layer1_retries`, `verify.layer2_retries`, `autofix.applied`, whether `epic.boundaries` is set (`set` / `not set`, never its content), `plan_critic.applied` + `plan_critic.counts`, `spec_stamp` + `plan_critic.spec_stamp_at_critic` in full (two small integer pairs — the only surface on which a wrong stale / not-stale verdict can be diagnosed; `lines` can be checked with `wc -l`, `generation` has no outside counterpart), and `gate.approved` when present. A field state.json does not carry prints `(none recorded)` — never invented. If state.json fails to parse, print only its path and the parse error, then halt. This action writes nothing and halts; calling `/harness` again re-renders the gate.
