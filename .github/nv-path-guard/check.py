#!/usr/bin/env python3
"""Path-guard check for nv-* overlay branches.

Usage: check.py <base-branch> <head-sha>

Reads `.github/nv-path-guard/<base-branch>.txt`, treats each line as a
gitwildmatch pattern (same syntax as .gitignore), and fails if any file
changed between origin/<base-branch> and HEAD isn't matched by the allowlist.

Lines starting with # are comments. Blank lines ignored.
If the config file doesn't exist, emits a warning and exits 0 (not a failure).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pathspec


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check.py <base-branch> <head-sha>", file=sys.stderr)
        return 2

    base, head = sys.argv[1], sys.argv[2]
    config_path = Path(f".github/nv-path-guard/{base}.txt")

    if not config_path.exists():
        print(f"::warning::no path-guard config at {config_path}; skipping")
        return 0

    patterns = [
        line.strip()
        for line in config_path.read_text().splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not patterns:
        print(f"::warning::{config_path} has no patterns; skipping")
        return 0

    spec = pathspec.PathSpec.from_lines("gitwildmatch", patterns)

    # Use merge-base to match what GitHub shows as the PR diff.
    merge_base = subprocess.check_output(
        ["git", "merge-base", f"origin/{base}", head], text=True
    ).strip()
    changed = subprocess.check_output(
        ["git", "diff", "--name-only", merge_base, head], text=True
    ).splitlines()
    changed = [c for c in changed if c]

    violations = [f for f in changed if not spec.match_file(f)]

    if violations:
        print(
            f"::error::PR touches {len(violations)} file(s) outside {base}'s "
            f"owned-path allowlist:"
        )
        for f in violations:
            print(f"  {f}")
        print()
        print(f"Branch {base}'s allowlist lives at {config_path}.")
        print("If these files genuinely belong to this branch, update the allowlist.")
        print("If they belong on nv-main, retarget the PR there.")
        print("If the classification is wrong, open an issue rather than bypassing.")
        return 1

    print(f"ok: all {len(changed)} changed file(s) match {base}'s allowlist.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
