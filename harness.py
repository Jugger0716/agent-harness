#!/usr/bin/env python3
"""Agent Harness - 3-Phase development workflow for Claude Code."""

import argparse
import sys


def cmd_init(args):
    """Initialize ~/.agent-harness/ directory."""
    print("[init] Not yet implemented")


def cmd_repo(args):
    """Manage registered repositories."""
    print(f"[repo {args.repo_action}] Not yet implemented")


def cmd_run(args):
    """Start a new harness task."""
    print("[run] Not yet implemented")


def cmd_next(args):
    """Advance to the next phase."""
    print("[next] Not yet implemented")


def cmd_status(args):
    """Show current harness status."""
    print("[status] Not yet implemented")


def main():
    parser = argparse.ArgumentParser(
        prog="harness",
        description="Agent Harness - 3-Phase development workflow for Claude Code"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init
    subparsers.add_parser("init", help="Initialize harness config directory")

    # repo
    repo_parser = subparsers.add_parser("repo", help="Manage repositories")
    repo_sub = repo_parser.add_subparsers(dest="repo_action", required=True)

    repo_add = repo_sub.add_parser("add", help="Register a repository")
    repo_add.add_argument("--name", required=True, help="Repository name")
    repo_add.add_argument("--path", required=True, help="Absolute path to repository")
    repo_add.add_argument("--lang", required=True, help="Primary language (python, java, csharp, typescript, etc.)")
    repo_add.add_argument("--test-cmd", default=None, help="Test command (e.g., 'pytest', './gradlew test')")
    repo_add.add_argument("--build-cmd", default=None, help="Build command (e.g., './gradlew build')")
    repo_add.add_argument("--default-scope", default=None, help="Default file scope pattern")

    repo_sub.add_parser("list", help="List registered repositories")

    repo_update = repo_sub.add_parser("update", help="Update a repository")
    repo_update.add_argument("name", help="Repository name")
    repo_update.add_argument("--path", default=None)
    repo_update.add_argument("--lang", default=None)
    repo_update.add_argument("--test-cmd", default=None)
    repo_update.add_argument("--build-cmd", default=None)
    repo_update.add_argument("--default-scope", default=None)

    repo_rm = repo_sub.add_parser("remove", help="Remove a repository")
    repo_rm.add_argument("name", help="Repository name")

    # run
    run_parser = subparsers.add_parser("run", help="Start a new task")
    run_group = run_parser.add_mutually_exclusive_group(required=True)
    run_group.add_argument("--repo", help="Registered repository name")
    run_group.add_argument("--repo-path", help="Direct path to repository")
    run_parser.add_argument("--task", required=True, help="Task description")
    run_parser.add_argument("--lang", default=None, help="Language (required with --repo-path)")
    run_parser.add_argument("--scope", default=None, help="File scope pattern")
    run_parser.add_argument("--max-rounds", type=int, default=3, help="Max build/QA rounds (default: 3)")
    run_parser.add_argument("--max-files", type=int, default=20, help="Max files to modify (default: 20)")
    run_parser.add_argument("--dry-run", action="store_true", help="Planner only, no code changes")

    # next
    next_parser = subparsers.add_parser("next", help="Advance to next phase")
    next_parser.add_argument("--repo-path", default=None, help="Path to repo with active .harness/")

    # status
    status_parser = subparsers.add_parser("status", help="Show current task status")
    status_parser.add_argument("--repo-path", default=None, help="Path to repo with active .harness/")

    args = parser.parse_args()
    commands = {
        "init": cmd_init,
        "repo": cmd_repo,
        "run": cmd_run,
        "next": cmd_next,
        "status": cmd_status,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
