# /harness doctor — procedure (read on demand by `skills/harness/SKILL.md` §Sub-command: doctor)

> Orchestrator-inline procedure, not a sub-agent template: nothing here is dispatched. The
> contract sentence (read-only, no state.json, no branch, no Mode Gate, no sub-agent, no
> Workflow, no Session Boundary block) lives in the skill; this file is the item-by-item procedure.

`/harness doctor` — read-only environment diagnostic. No arguments, no `.harness/state.json`
(neither read nor written), no git branch, no Mode Gate resolution, no sub-agents, no Workflow
dispatch (orchestrator-inline). Nothing is written anywhere — not `.harness/`, not `docs/`, not
`.gitignore`, not either installed plugin copy.
It does **not** print the §Session Boundary block: doctor is not a session, so no boundary is crossed.
Every path it reads is a fixed constant or a value resolved at run time from `${CLAUDE_PLUGIN_ROOT}` and `git rev-parse --show-toplevel` — never a user-supplied argument.

Reached only through the read-only carve-out at the top of `skills/harness/SKILL.md` §Session Recovery.

**Known install locations.** Two, and only these two are fixed constants:
`~/.claude/plugins/marketplaces/agent-harness-marketplace/` and
`~/.claude/plugins/cache/agent-harness-marketplace/agent-harness/<version>/`, where `<version>` is
a directory name discovered at run time, never a constant written here. The cache path's
`agent-harness/` segment is load-bearing: drop it and the location never resolves, so items ① and
④ report `⚠` forever even in a healthy environment.

**Output contract.** Follow `templates/_shared/status_format.md` §Label rules and its open-label
rule, with the prefix `[harness doctor]`: labels English raw, values per the Preserved-English
Glossary and remediation in `user_lang`, one `✓` or `⚠` per item. doctor does not read
`.harness/state.json` and does not render that file's session status block.

**No lint checks this section's item-number citations** — `§Step 1.5 items 1–2`, `§Storage
Criteria`, `mode_gate.md` `rule 2`. They are prose pointers into other files, so a renumbering
upstream rots them silently and nothing turns red. Re-read the cited section whenever either file
changes.

① **Installed-copy CR contamination.** For each known install location, read every
`*.workflow.js` under it as bytes and count the occurrences of the byte `0x0D`; the verdict is that
count, not the output of a pattern search. Do not build the pattern with an ANSI-C quoted escape —
in this shell that argument reaches the process empty between invocations and every file matches.
Result contract, in this order: the location is absent or unreadable → `⚠`, degraded, never `✓`;
the location resolves but holds no `*.workflow.js` at all → `⚠`, an incomplete install; files are
present and the count is zero → `✓`; files are present and the count is non-zero → `⚠`,
contaminated.
Remediation differs by location, and which one applies is decided at run time, never asserted in
advance. Two tests decide it, in this order, and the first is **not sufficient on its own**:
(1) `git -C <location> rev-parse --is-inside-work-tree` prints exactly `true`, and
(2) `git -C <location> ls-files -- workflows/` prints at least one path. Test (1) alone answers
`true` for a copy that merely sits inside some unrelated repository — a plugin directory under a
version-controlled home directory does — and there those paths are untracked, so a checkout cannot
bring back what a delete removed. Where both hold, the work-tree repair `.gitattributes`
prescribes applies; where either fails, a fresh install of the plugin is the only remedy. A cache
version directory is judged by the same two tests rather than by an assumption about caches.
That repair removes the contaminated files and checks them out again. **Every command is anchored
to the location this item flagged, never to the current directory** — `/harness` runs in arbitrary
projects, so an unanchored `rm workflows/*.workflow.js` deletes the caller's own files while the
install copy stays contaminated:

```
rm <location>/workflows/*.workflow.js && git -C <location> checkout -- workflows/
```

Never offer `git add --renormalize` here. `.gitattributes` records that these index blobs are
already LF, so it is a no-op, and deleting the index first does not make it work — with no index
to match, the re-add stages the entire tree as deleted.

② **Workflow tool availability.** Report what this session's tool list shows, and say in the
output that the finding holds for this session only. Do not run an active probe: the condition
cited from `templates/_shared/mode_gate.md` rule 2 is an observational one, so probing it would
contradict the rule being reported. The tool being absent from that list is not a fault: print
`— (Workflow tool not offered this session)`, which is **not** a `⚠`. The tool being offered says
nothing about whether a plugin-root `scriptPath` launches — it does not (measured 2026-09-18);
segments launch from the `.harness/wf/` copy `templates/_shared/segment_launch.md` prescribes,
which this diagnostic never creates because it writes nothing. Say so in the row.

③ **git work tree.** Run `git rev-parse --is-inside-work-tree` and decide on whether stdout is
exactly `true` — not on the exit code, which is zero while `false` is printed inside a `.git/`
directory. `{CLAUDE_PLUGIN_ROOT}/skills/team-memory/SKILL.md` §Step 1.5 item 1 owns this rule; the
deciding clause is repeated here because item ⑤ reuses this item's answer — change it there first.
Not being a work tree is not a fault: print `— (not a git work tree)`, which is **not** a `⚠`,
exactly as ⑤ (iii) does with the same fact.

④ **Version and content drift**, on three axes, over the known install locations above.
   (a) Directory name against the `plugin.json` inside it, **for cache version directories only** —
   that is where the version is part of the name. The marketplace location carries no version in
   its directory name, so on this axis it prints `— (no version in the directory name)` and is not
   a mismatch; reading it as one makes ④ warn forever in a healthy environment. The source of truth
   is that `plugin.json` `$.version`, not the directory name. A directory whose name carries a
   **backup suffix** — a suffix beginning `.backup-` after the version string — is excluded from
   this axis and listed separately. Print the resolved value of
   `${CLAUDE_PLUGIN_ROOT}` as the running copy; if it is empty or cannot be resolved, print
   `— (plugin root unresolved)` and `⚠`.
   (b) Each install copy's `plugin.json` against the repository's `plugin.json`.
   (c) Content identity. The left-hand side is `git ls-files`, run from the tree root resolved by
   `git rev-parse --show-toplevel` — run from a subdirectory it lists only that subtree and every
   drift figure below shrinks silently. The right-hand side is the
   comparison copy's whole file set minus anything under `.git/` and under `.in_use/`; there is no
   whitelist of content directories, because a new top-level one would then go unseen. Do not
   enumerate the left-hand side from disk. Report three figures separately: how many files in the
   intersection differ in content; how many tracked files are missing from the install copy; and,
   as paths rather than a count, every path present only in the install copy that the two
   exclusions do not cover — that listing is the only signal that the exclusion list has aged.
   Classify each differing pair as EOL-only or genuinely different by removing `0x0D` and comparing
   again, because this repository normalises only some file types and a checkout made with
   `core.autocrlf=true` produces EOL-only differences in a copy that is otherwise in sync. Do not
   copy that attributes file's glob list into this document.
   **Choosing the comparison copy**, in order: (i) if `${CLAUDE_PLUGIN_ROOT}` resolved, compare that
   copy and mark it `(loaded copy)` — it is the one actually running; (ii) **in addition**, and not
   only when (i) failed, take the known install locations above — the marketplace copy, and those cache version directories whose
   `plugin.json` `$.version` equals the repository's, after excluding backup-suffixed names by the
   same rule axis (a) uses. If nothing matches, do not skip the comparison: compare against the
   candidate whose internal `plugin.json` `$.version` is highest by semver and print
   `— (no installed copy at the repository's version; compared <dirname>, whose plugin.json reports <version>)`.
   Do not choose by directory name — a copy whose name and contents disagree is a case this axis
   has actually met. A candidate whose `$.version` does not parse as semver is dropped from that
   choice and the fact is printed on one line. On a tie at the highest value, list them all and
   compare each. If more than one candidate matches, list them all and compare each rather than
   picking one. (iii) If the path from (i) is none of the paths from (ii), print `⚠` — the copy
   compared is not the copy running. (ii) is evaluated even when (i) resolved, precisely so (iii)
   has a set to compare against; making (ii) an `otherwise` branch leaves (iii) unreachable on
   every path.
   Axes (b) and (c) run **only when the current working tree is this plugin's own source
   repository**: the tree root holds `.claude-plugin/plugin.json` and its `$.name` equals the
   install copy's. Otherwise print `— (not the plugin source repo)`, which is **not** a `⚠`, and
   judge ④ on axis (a) alone. No count, file list, or version string is written into this document
   as a constant; every one of them is measured at run time and printed.

⑤ **Team-memory store ignore state.** (i) Apply the verdict rules of
`{CLAUDE_PLUGIN_ROOT}/skills/team-memory/SKILL.md` §Step 1.5 items 1–2, together with the
§Storage Criteria table that item 2 itself names, by name — do not restate the slug prefixes or
the category directory names, which is the part that drifts. (ii) That plugin-root path is the read
path, never a repository-relative one, because `/harness` runs in arbitrary projects; if the read
fails, narrow the probe to the store directory and its `README.md`, say in the output that it was
narrowed, and never report a narrowed verdict as `✓`. (iii) Argument-free form: reuse the work-tree
answer item ③ already produced instead of running item 1 again, and when it is not a work tree
print `— (not a git work tree)`, which is **not** a `⚠`. (iv) When it is one, anchor at the
repository root and run item 2's check over every built-in category the cited table lists — the
store directory, its `README.md`, each category directory, and one record-shaped path per category;
do not add `-q`, which fails with several paths. (v) doctor does not create any of those paths: as
that item states, the check matches patterns rather than the file system. (vi) Exit codes, as that
item defines them: `0` = at least one path is ignored → `⚠`; `1` = none → `✓`; `128` = undetermined
→ `⚠`. (vii) A `⚠` here is a report, not a gate — that item's "do not raise the gate" governs a
gate doctor does not have; items 3–6 of that section, which own the gate and the `.gitignore`
repair, do not apply here; and two limits stay uncovered and are printed with the verdict, namely a
user-defined category, which only `save` Step 1's own output can enumerate, and the *Known limit*
that item records for itself, an ignore pattern aimed at the free-form slug that follows a category
prefix.

⑥ **Project defaults.** Apply `templates/_shared/project_defaults.md` by name. Walk its three
sources in its own precedence order, treat the winning source as winning wholesale, and apply that
file's parse rule as that file scopes it rather than restating it here. Report which source won,
what the final resolved reading is, and on the same line that the sources below the winner were
ignored wholesale rather than merged. When no source declares anything — the common case — print
`— (no defaults declared in any source)`; that is **not** a `⚠`, and there is no winner to name.

### Example output

```
[harness doctor]
  ① Installed-copy CR   : ✓
  ② Workflow tool       : ✓  (tool list only — launch surface .harness/wf/ not exercised)
  ③ git work tree       : ✓
  ④ Install drift       : ⚠  <measured summary>
  ⑤ Memory store ignore : ⚠  <measured summary>
  ⑥ Project defaults    : ✓  <winning source>
```

A green ① or ④ says the copies on disk are current. It does not say the skill body this process is
running was loaded from them.
