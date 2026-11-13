# Path Validator (single source)

> Orchestrator-internal conceptual function, cited by name from `skills/harness/SKILL.md`,
> `skills/harness-gate/SKILL.md` and `skills/harness-build/SKILL.md` §Path Validator. Those files
> list their own call sites; this file defines the function and nothing else.

```
validate_path(path, kind) where kind ∈ {output_dir, file_reference, diff_target}

  0. (kind == output_dir only) Empty string → halt "output-dir cannot be empty."
  1. Normalize: \ → / (OS-independent). UNC (\\server\share or //server/share) → halt
     "UNC paths are not allowed."
  2. Absolute path: ^/ or ^[A-Za-z]:/ → halt "output-dir must be a relative path."
  3. Segment-level ..: path.split("/") — any segment == ".." → halt
     "output-dir must not contain '..'." (exact segment match, never substring).
  4. kind-specific:
     - output_dir:
         First segment (path.split("/")[0], trailing slash stripped first) ∈
         {memory, spec, planner, generator, evaluator, verify, harness, .harness}
         → halt "output-dir value starts with a reserved directory name."
         Special case: if the first segment == "docs", the SECOND segment MUST == "harness"
         → otherwise halt "output-dir under docs/ must be docs/harness/...".
         Rationale: the default output_base is docs/harness, so
         docs/harness/<slug>/ is the only legitimate docs/... override; any other
         docs/<other>/ override is rejected to keep writes inside the harness namespace.
     - file_reference (failing_files_list, cold-review inputs, cold finding.file):
         (a) relative path, (b) no .. segment, (c) inside repo_path,
         (d) outside .harness/, docs/harness/*, memory/, .git/.
     - diff_target (unified diff `--- a/` / `+++ b/` headers):
         file_reference conditions + inside the scope filter.
  5. On failure: return the specific halt message describing the violation.
```

**Attack vector → step mapping.** Each row is a real rejection, not an illustration.

| Attack vector | Blocked at step |
|---|---|
| `--output-dir .harness` | 4 (`kind=output_dir`, reserved first segment) |
| `--output-dir memory/foo` | 4 (reserved first segment) |
| `--output-dir docs/../../etc` | 3 (segment `..` rejection) |
| `--output-dir \\server\share` | 1 (normalization + UNC rejection) |
| `--output-dir /absolute/path` | 2 (absolute path rejection) |
| `--output-dir ` (empty) | 0 (empty string, `kind=output_dir`) |
