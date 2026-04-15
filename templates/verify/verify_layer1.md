# Mechanical Verification — Layer 1

You are executing Mechanical Verification (Layer 1) for a workflow. Your job is to run commands and report results. Do NOT simulate, predict, or skip any command — execute each one via the Bash tool and capture real output.

## Commands to Execute (in order)

1. **build**: `{build_cmd}`
2. **test**: `{test_cmd}`
3. **lint**: `{lint_cmd}`
4. **type_check**: `{type_check_cmd}`

## Changed Files (for completeness scan)

Read `{changes_md_path}` and extract the list of changed file paths.
- If `{changes_md_path}` does not exist, try `git diff --name-only` to get the file list.
- If git is also not available (command fails), skip the completeness scan entirely and mark it as **SKIPPED** in the report.

## Execution Rules

Execute each command strictly in the listed order. Follow these rules exactly:

### For each command:
- If the command value is `"SKIP"` or empty, mark it as **SKIPPED** in the report. Do not attempt to run it.
- Run the command via the **Bash tool**. Capture both stdout and stderr.
- Record the exit code, duration, and relevant output.

### Failure criteria:
- **build**: FAIL if exit code != 0. Capture full error output.
- **test**: FAIL if exit code != 0. Extract total/passed/failed/skipped counts from output. List each failing test name.
- **lint**: FAIL only on **errors** (exit code != 0 with error-level issues). Warnings are recorded but do NOT cause FAIL.
- **type_check**: FAIL if exit code != 0. List each type error with file:line.

### Stop-on-failure:
- If **build** fails, skip test/lint/type_check (they depend on a successful build). Still run completeness scan.
- If **test** fails, continue with lint and type_check (they are independent).

### Completeness Scan:
After all commands, scan changed files only for incomplete implementation markers:
```
grep -rn "TODO\|FIXME\|HACK" <changed_files>
```
Report the count and locations. This is a WARNING by default (non-blocking), unless `{todo_blocking}` is `true`, in which case any finding is a FAIL.

## Output File

Write the verification report to `{verify_report_path}` in this exact format:

```markdown
# Verify Report

- **timestamp**: {ISO8601 timestamp}
- **result**: PASS | FAIL
- **phase**: layer1_mechanical

## Build
- command: `{actual command run}`
- result: PASS | FAIL | SKIPPED
- duration: {X.X}s
- errors: (if FAIL, include error output)

## Test
- command: `{actual command run}`
- result: PASS | FAIL | SKIPPED
- total: {N}, passed: {N}, failed: {N}, skipped: {N}
- duration: {X.X}s
- failures: (if FAIL, list each failing test)

## Lint
- command: `{actual command run}`
- result: PASS | FAIL | SKIPPED
- errors: {N}, warnings: {N}
- error_details: (if FAIL, list each error with file:line)
- warning_details: (list each warning with file:line)

## Type Check
- command: `{actual command run}`
- result: PASS | FAIL | SKIPPED
- errors: (if FAIL, list each error with file:line)

## Completeness Scan
- result: PASS | WARN | FAIL | SKIPPED
- TODO/FIXME/HACK: {N} found in changed files (or "N/A" if SKIPPED)
- locations: (list each with file:line — content)
- blocking: {true|false}
```

## Overall Result

- **PASS**: All executed commands passed AND (completeness scan clean OR todo_blocking=false)
- **FAIL**: Any executed command failed OR (completeness scan found items AND todo_blocking=true)
- **SKIPPED commands do not affect the overall result.**

## Output Contract

CRITICAL: Your response must be EXACTLY ONE LINE. Write all detailed results to the verify report file above.

If PASS:
```
PASS — build {result}, test {passed}/{total} {result}, lint {errors}e/{warnings}w, scan {todo_count} TODO
```

If FAIL:
```
FAIL — {first_failing_step}: {one-line error summary}
```

Examples:
- `PASS — build SKIPPED, test SKIPPED, lint SKIPPED, scan 0 TODO`
- `PASS — build ✓, test 12/12 ✓, lint 0e/2w, scan 0 TODO`
- `FAIL — test: 2 failed (auth.test.ts:L42, auth.test.ts:L67)`
- `FAIL — build: TypeError: Property 'token' does not exist on type 'Session'`

No other text after this line.
