#!/usr/bin/env python3
"""
Verify that .claude-plugin/plugin.json and .claude-plugin/marketplace.json agree
on the plugin description, the keyword set, and the version string.

Checked:
  1. Plugin description -- plugin.json `$.description` vs the marketplace entry's
     `$.plugins[i].description`. The entry is located by NAME (its `name` must equal
     plugin.json's `name`), not by index: a positional join would silently compare the
     wrong entry the day a second plugin is listed.
  2. Keywords -- plugin.json `$.keywords` vs that same entry's `$.keywords`, compared as
     SETS. Order is presentation, not contract; a set comparison also reports the two
     directions of drift separately instead of one opaque inequality.
  3. Version -- the three key paths must all carry the same string: plugin.json
     `$.version`, marketplace.json `$.metadata.version`, and marketplace.json
     `$.plugins[*].version` (EVERY element, using CLAUDE.md's own notation). A bump that
     edits only the first two is incomplete, and that is the failure this check exists for.

Deliberately NOT checked. JSON carries no comments, so each exclusion is recorded here with
its reason:
  - `$.metadata.description` in marketplace.json is a SHORTER, marketplace-facing summary.
    It is intentionally not the plugin description and must not be forced to match it.
  - `$.owner` in marketplace.json is value policy, not a sync contract: what goes in the
    owner name or address is the maintainer's decision, so this script has no opinion on it.
  - `$.author` IS carried by both files, with identical values today, and is still not
    compared: like `$.owner` it is maintainer identity rather than a sync contract. Read this
    as a known gap, not as an impossibility -- if it should be enforced, add a check here
    rather than assuming one already runs.

`$.name` is absent from that list because it is not an exclusion: it is the key this script
joins the two files on, so a mismatch surfaces as exit 2 rather than passing unnoticed.

Both manifests are opened with an EXPLICIT utf-8 encoding. On Windows the interpreter
default is cp949 and both files contain U+2192 (the arrow in "Plan -> Generate -> Verify
-> Evaluate"), so an implicit-encoding read raises UnicodeDecodeError on a developer
machine while passing on the Linux CI runner -- a platform-split failure worth one keyword.

Exit codes:
  0  All three checks agree.
  1  Drift detected in at least one check.
  2  A manifest is missing, is not valid JSON, lacks a required key, or lists no plugin
     entry whose name matches plugin.json.

Usage:
  python scripts/verify_manifest_sync.py
  python scripts/verify_manifest_sync.py --version

Intended invocation: run manually and on push/PR via .github/workflows/lint.yml
(pre-commit hook wiring is still a later-phase TODO).

Defined contract: see CLAUDE.md section "Important Notes" (the three key paths) and its
section "Tech Stack" (the manifest row).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_VERSION = "1.0.0"

PLUGIN_JSON = ".claude-plugin/plugin.json"
MARKETPLACE_JSON = ".claude-plugin/marketplace.json"


def load(repo_root: Path, rel: str) -> dict:
    path = repo_root / rel
    if not path.exists():
        print(f"[verify_manifest_sync] {rel}: file does not exist", file=sys.stderr)
        sys.exit(2)
    try:
        # Explicit encoding: see the module docstring (cp949 default vs U+2192).
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        print(f"[verify_manifest_sync] {rel}: cannot be parsed -- {exc}", file=sys.stderr)
        sys.exit(2)
    if not isinstance(data, dict):
        print(f"[verify_manifest_sync] {rel}: top level is not an object", file=sys.stderr)
        sys.exit(2)
    return data


def require(data: dict, where: str, key: str):
    if key not in data:
        print(f"[verify_manifest_sync] {where}: required key {key!r} is missing",
              file=sys.stderr)
        sys.exit(2)
    return data[key]


def find_entry(market: dict, name: str) -> dict:
    plugins = require(market, MARKETPLACE_JSON, "plugins")
    if not isinstance(plugins, list) or not plugins:
        print(f"[verify_manifest_sync] {MARKETPLACE_JSON}: plugins is not a non-empty list",
              file=sys.stderr)
        sys.exit(2)
    for entry in plugins:
        if isinstance(entry, dict) and entry.get("name") == name:
            return entry
    listed = ", ".join(repr(e.get("name")) for e in plugins if isinstance(e, dict))
    print(f"[verify_manifest_sync] {MARKETPLACE_JSON}: no plugins entry named {name!r} "
          f"(names present: {listed})", file=sys.stderr)
    sys.exit(2)


def check_description(plugin: dict, entry: dict) -> int:
    want = require(plugin, PLUGIN_JSON, "description")
    got = require(entry, f"{MARKETPLACE_JSON} plugins entry", "description")
    if want == got:
        print(f"[verify_manifest_sync] OK: description matches ({len(want)} chars)")
        return 0
    print("[verify_manifest_sync] FAIL: description drift", file=sys.stderr)
    print(f"  plugin.json      ({len(want)} chars): {want}", file=sys.stderr)
    print(f"  marketplace.json ({len(got)} chars): {got}", file=sys.stderr)
    return 1


def check_keywords(plugin: dict, entry: dict) -> int:
    want = require(plugin, PLUGIN_JSON, "keywords")
    got = require(entry, f"{MARKETPLACE_JSON} plugins entry", "keywords")
    if not isinstance(want, list) or not isinstance(got, list):
        print("[verify_manifest_sync] keywords: both values must be arrays", file=sys.stderr)
        sys.exit(2)
    want_set, got_set = set(want), set(got)
    missing = [k for k in want if k not in got_set]
    unexpected = [k for k in got if k not in want_set]
    if not missing and not unexpected:
        print(f"[verify_manifest_sync] OK: keywords match as sets ({len(want_set)} keywords)")
        return 0
    print("[verify_manifest_sync] FAIL: keywords drift", file=sys.stderr)
    if missing:
        print(f"  in plugin.json, missing from marketplace.json: {missing}", file=sys.stderr)
    if unexpected:
        print(f"  in marketplace.json, absent from plugin.json: {unexpected}", file=sys.stderr)
    return 1


def check_version(plugin: dict, market: dict) -> int:
    # The three key paths, named as CLAUDE.md names them.
    sites = [(f"{PLUGIN_JSON} $.version", require(plugin, PLUGIN_JSON, "version"))]
    metadata = require(market, MARKETPLACE_JSON, "metadata")
    if not isinstance(metadata, dict):
        print(f"[verify_manifest_sync] {MARKETPLACE_JSON}: metadata is not an object",
              file=sys.stderr)
        sys.exit(2)
    sites.append((f"{MARKETPLACE_JSON} $.metadata.version",
                  require(metadata, f"{MARKETPLACE_JSON} metadata", "version")))
    for i, entry in enumerate(market["plugins"]):
        sites.append((f"{MARKETPLACE_JSON} $.plugins[{i}].version",
                      require(entry, f"{MARKETPLACE_JSON} plugins entry {i}", "version")))

    distinct = {v for _, v in sites}
    if len(distinct) == 1:
        print(f"[verify_manifest_sync] OK: version {next(iter(distinct))} at all "
              f"{len(sites)} key path(s)")
        return 0
    print("[verify_manifest_sync] FAIL: version drift across key paths", file=sys.stderr)
    for where, value in sites:
        print(f"  {value!r:12}  {where}", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify plugin.json / marketplace.json field sync."
    )
    parser.add_argument(
        "--version", action="version", version=f"verify_manifest_sync {SCRIPT_VERSION}"
    )
    parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    plugin = load(repo_root, PLUGIN_JSON)
    market = load(repo_root, MARKETPLACE_JSON)
    entry = find_entry(market, require(plugin, PLUGIN_JSON, "name"))

    rc = 0
    for result in (check_description(plugin, entry),
                   check_keywords(plugin, entry),
                   check_version(plugin, market)):
        if result == 1:
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())
