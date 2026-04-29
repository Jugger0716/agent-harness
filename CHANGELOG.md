# Changelog

All notable changes to agent-harness are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## [8.2.0] — 2026-04-29

### Fixed

- **fix(ship): align `.harness/` cleanup Safety Guard with `/workflow` parity** — Add explicit symlink-escape verification (`Path('.harness').resolve() ⊆ Path.cwd().resolve()`, unconditional), insert "Display target before delete" step that prints the exact absolute path, route every validation failure through ABORT with a translated user warning, and specify symlink-vs-target deletion semantics in Item 5 (`is_symlink()` short-circuit removes the link itself, regular directories use `follow_symlinks=False`). Adds a `Path(...)` pseudocode-portability note for cross-platform agent execution. Resolves residual gap S1 and review #7 (PARTIAL).
- **fix(ship): bound tag-name regex length to strict 254 characters** — Change `tag_name` validation from `^v?[0-9a-zA-Z][0-9a-zA-Z._-]*$` to `^(v[0-9a-zA-Z][0-9a-zA-Z._-]{0,252}|[0-9a-zA-Z][0-9a-zA-Z._-]{0,253})$` to reject pathological tag inputs (e.g. 10k-char strings). Alternation form enforces a strict 254-char hard cap regardless of optional `v` prefix (the simpler `^v?[0-9a-zA-Z][0-9a-zA-Z._-]{0,253}$` would have allowed 255 chars when `v` is present). Resolves residual gap S2 and review N-8 (length bound only; consecutive-dot / trailing-dot hardening deferred).
