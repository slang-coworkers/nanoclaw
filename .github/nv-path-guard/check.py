#!/usr/bin/env python3
"""Path-guard check for nv-* overlay branches.

Usage: check.py <base-branch> <head-sha>

Reads `.github/nv-path-guard/<base-branch>.txt`, treats each line as a
gitwildmatch pattern (same syntax as .gitignore), and fails if any file
changed between origin/<base-branch> and HEAD isn't matched by the allowlist.

Lines starting with # are comments. Blank lines ignored.
If the config file doesn't exist, emits a warning and exits 0 (not a failure).

Pattern loading and matching live in `ownership.py` so this and
`scripts/check-nv-owned-drift.sh` cannot drift apart about what a branch owns.

Exit codes:
    0  every changed file is inside the allowlist (or no guard is configured)
    1  the PR touches files outside the allowlist
    2  ownership could not be evaluated — never treated as "allowed"
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from ownership import OwnershipError, build_spec, load_patterns


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check.py <base-branch> <head-sha>", file=sys.stderr)
        return 2

    base, head = sys.argv[1], sys.argv[2]
    config_path = Path(f".github/nv-path-guard/{base}.txt")

    # RESIDUAL, deliberate: a branch with no allowlist has no guard configured,
    # and this workflow only runs on the five branches that all carry one. An
    # allowlist that EXISTS but cannot be used is a different thing entirely —
    # that is a broken guard, and it fails closed below.
    if not config_path.exists():
        print(f"::warning::no path-guard config at {config_path}; skipping")
        return 0

    try:
        patterns = load_patterns(config_path)
    except OwnershipError as e:
        print(f"::error::{e}")
        return 2

    # An allowlist that is present but carries no patterns owns nothing, so every
    # changed file is outside it. Reporting "ok, skipping" there is the exact
    # greenwash this guard exists to prevent: an emptied allowlist would wave
    # through the PR that emptied it.
    if not patterns:
        print(
            f"::error::{config_path} exists but carries no patterns, so ownership "
            f"cannot be evaluated. Restore it rather than bypassing this check."
        )
        return 2

    # Use merge-base to match what GitHub shows as the PR diff.
    merge_base = subprocess.check_output(
        ["git", "merge-base", f"origin/{base}", head], text=True
    ).strip()
    changed = subprocess.check_output(
        ["git", "diff", "--name-only", merge_base, head], text=True
    ).splitlines()
    changed = [c for c in changed if c]

    # One batched call for the whole diff, not one subprocess per file.
    try:
        with build_spec(patterns) as spec:
            owned = spec.match_files(changed)
    except OwnershipError as e:
        print(f"::error::{e}")
        return 2

    violations = [f for f in changed if f not in owned]

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
