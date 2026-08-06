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

import sys
from pathlib import Path

try:
    import pathspec
except ModuleNotFoundError:  # pragma: no cover - environment guard
    print(
        "::error::the `pathspec` package is required to evaluate path ownership "
        "(the same matcher CI's path-guard uses). Install it: pip install pathspec",
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
