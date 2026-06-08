# Detection Tables — Shared (single source)

Auto-detect project language and commands. Scan the working directory.

## Language / Test / Build

| File | Language | Test Command | Build Command |
|------|----------|-------------|---------------|
| `build.gradle(.kts)` | java | `./gradlew test` | `./gradlew build` |
| `pom.xml` | java | `mvn test` | `mvn compile` |
| `pyproject.toml` / `setup.py` | python | `pytest` | (none) |
| `package.json` | typescript | `npm test` | `npm run build` |
| `*.csproj` | csharp | `dotnet test` | `dotnet build` |
| `go.mod` | go | `go test ./...` | `go build ./...` |
| `Cargo.toml` | rust | `cargo test` | `cargo build` |

If none match, set language to "unknown", test/build commands to null.

## Lint (skip if `--lint-cmd` provided)

Check in order, stop at first match:

| # | Detection | Condition | lint_cmd |
|---|-----------|-----------|----------|
| 1 | Read `package.json` | `scripts.lint` key exists | `npm run lint` |
| 2 | Glob | `.eslintrc*` / `eslint.config.*` exists | `npx eslint .` |
| 3 | Read `pyproject.toml` | `[tool.ruff]` section exists | `ruff check .` |
| 4 | Glob+Read | `.pylintrc` exists OR `pyproject.toml` has `[tool.pylint]` | `pylint {scope}` |
| 5 | Glob | `.golangci.yml` / `.golangci.yaml` exists | `golangci-lint run` |
| 6 | Glob | `Cargo.toml` exists | `cargo clippy` |

If none match → `null` (SKIPPED during verify).

## Type-check (skip if `--type-check-cmd` provided)

Check in order, stop at first match:

| # | Detection | Condition | type_check_cmd |
|---|-----------|-----------|----------------|
| 1 | Glob | `tsconfig.json` exists | `npx tsc --noEmit` |
| 2 | Glob+Read | `mypy.ini` exists OR `pyproject.toml` has `[tool.mypy]` | `mypy .` |
| 3 | Glob+Read | `pyrightconfig.json` exists OR `pyproject.toml` has `[tool.pyright]` | `pyright` |
| 4-6 | — | `*.csproj` / `go.mod` / `Cargo.toml` | null (build includes type-check) |

If none match → `null` (SKIPPED during verify).
