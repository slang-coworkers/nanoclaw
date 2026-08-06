#!/usr/bin/env python3
"""Shared gitwildmatch ownership matching for every nv-path-guard consumer.

WHY THIS IS ITS OWN MODULE

`.github/nv-path-guard/<branch>.txt` is the single source of truth for which paths
a branch owns, but it had two readers that did not agree:

  - CI's path-guard (check.py) evaluates it with `pathspec`, which sees ONLY the
    patterns in that file.
  - scripts/check-nv-owned-drift.sh evaluated it with
    `git -c core.excludesFile=<list> check-ignore`, which ALSO consults the repo's
    own `.gitignore` files, `.git/info/exclude`, and the user's global excludes.

So any path an ambient ignore rule happened to match was classified "owned" by the
drift check even when no line in `nv-main.txt` matched it — a strictly broader
ownership set than CI's, from the same file. The two answers diverged silently,
which is exactly what an ownership source of truth must never do.

This module is the one implementation. check.py imports it; the shell verifier
shells out to the CLI below. Both therefore see the allowlist and nothing else.

CLI:
    ownership.py <allowlist-file>      candidate paths on stdin, owned ones on stdout

Exit codes:
    0  matched (an empty result is a valid answer — "nothing here is owned")
    2  allowlist missing, unreadable, or carrying no patterns; or pathspec absent
"""
from __future__ import annotations

import os
import subprocess
import sys
import venv
from pathlib import Path

# ── pathspec, self-provisioned ────────────────────────────────────────────────
# This module MUST NOT depend on a CI step to install its matcher, and the reason
# is structural rather than convenience.
#
# Sibling-branch CI composes: the job runs the workflow file from the PR's OWN
# branch, then merges nv-main into the tree and tests the composed state. Every
# nv-main-owned file therefore reaches the test run — except one. GitHub Actions
# has already read and started `.github/workflows/ci.yml` before the compose step
# executes, so that single file can never compose itself.
#
# Consequence: a test added on nv-main travels to nv-dashboard/nv-slang PRs, while
# the CI step it needs does not. That is exactly what happened — a `pip install
# pathspec` step added on nv-main alongside this module's tests, and every
# sibling-branch PR then failed on six assertions unrelated to its own change.
#
# So we provision the matcher ourselves. Reimplementing gitwildmatch was rejected:
# this module exists BECAUSE two readers of the same allowlist disagreed, and a
# hand-rolled matcher would be a third dialect — the original bug wearing a hat.
_BOOTSTRAP_ENV = "NV_PATH_GUARD_NO_BOOTSTRAP"


def _venv_site_packages(root: Path) -> Path | None:
    """The site-packages of a venv, without assuming a Python version in the path."""
    for lib in (root / "lib").glob("python*/site-packages"):
        return lib
    win = root / "Lib" / "site-packages"  # Windows layout
    return win if win.is_dir() else None


def _provision_pathspec() -> bool:
    """Create (or reuse) a cached venv holding pathspec, and put it on sys.path.

    Returns True when `import pathspec` will now succeed. Never raises: every
    failure path returns False so the caller can fail CLOSED with a real message
    rather than proceeding without a matcher.
    """
    if os.environ.get(_BOOTSTRAP_ENV):
        return False  # deliberately disabled (air-gapped runners, policy)
    cache_root = Path(os.environ.get("XDG_CACHE_HOME") or (Path.home() / ".cache"))
    root = cache_root / "nv-path-guard" / "pathspec-venv"
    try:
        site = _venv_site_packages(root)
        if site is None:
            venv.create(root, with_pip=True, clear=False)
            site = _venv_site_packages(root)
        if site is None:
            return False
        if not any(site.glob("pathspec*")):
            py = root / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            # Quiet, but NOT silent on failure — check=True surfaces a real error.
            subprocess.run(
                [str(py), "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "pathspec"],
                check=True,
                capture_output=True,
            )
        sys.path.insert(0, str(site))
        return True
    except (OSError, subprocess.SubprocessError):
        return False


try:
    import pathspec
except ModuleNotFoundError:  # pragma: no cover - environment guard
    if _provision_pathspec():
        import pathspec  # noqa: F811  — now importable from the provisioned venv
    else:
        print(
            "::error::the `pathspec` package is required to evaluate path ownership "
            "(the same matcher CI's path-guard uses), and it could not be provisioned "
            f"automatically. Install it (pip install pathspec), or unset {_BOOTSTRAP_ENV} "
            "if bootstrapping was disabled deliberately.",
            file=sys.stderr,
        )
        sys.exit(2)


def load_patterns(config_path: Path) -> list[str]:
    """Allowlist lines that carry a pattern. `#` comments and blanks are dropped."""
    return [
        line.strip()
        for line in config_path.read_text().splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def build_spec(patterns: list[str]) -> "pathspec.PathSpec":
    """gitwildmatch — .gitignore syntax, and NOTHING but the patterns given."""
    return pathspec.PathSpec.from_lines("gitwildmatch", patterns)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: ownership.py <allowlist-file>  (candidate paths on stdin)", file=sys.stderr)
        return 2

    config = Path(sys.argv[1])
    if not config.is_file():
        print(f"::error::ownership allowlist not found: {config}", file=sys.stderr)
        return 2

    try:
        patterns = load_patterns(config)
    except OSError as e:
        print(f"::error::cannot read ownership allowlist {config}: {e}", file=sys.stderr)
        return 2

    # An allowlist with no patterns owns nothing. Returning "no drift" on that input
    # is indistinguishable from a real green, so callers get a non-zero instead.
    if not patterns:
        print(f"::error::ownership allowlist {config} has no patterns", file=sys.stderr)
        return 2

    spec = build_spec(patterns)
    for line in sys.stdin.read().splitlines():
        if line and spec.match_file(line):
            print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
