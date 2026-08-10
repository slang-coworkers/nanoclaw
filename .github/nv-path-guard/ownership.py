#!/usr/bin/env python3
"""Shared gitwildmatch ownership matching for every nv-path-guard consumer.

WHY THIS IS ITS OWN MODULE

`.github/nv-path-guard/<branch>.txt` is the single source of truth for which paths
a branch owns, but it had two readers that did not agree:

  - CI's path-guard (check.py) evaluated it with the `pathspec` PyPI package,
    which sees ONLY the patterns in that file.
  - scripts/check-nv-owned-drift.sh evaluated it with
    `git -c core.excludesFile=<list> check-ignore` run IN THE PROJECT REPO, which
    ALSO consults the repo's own `.gitignore` files, `.git/info/exclude`, and the
    user's global excludes.

So any path an ambient ignore rule happened to match was classified "owned" by the
drift check even when no line in `nv-main.txt` matched it — a strictly broader
ownership set than CI's, from the same file. The two answers diverged silently,
which is exactly what an ownership source of truth must never do.

WHY GIT, IN AN EMPTY REPO, RATHER THAN A PACKAGE

The first fix picked one implementation (`pathspec`) and pointed both readers at
it. That removed the divergence but bought a dependency: a guard that decides
what a branch may change now had to fetch a package from a registry at the moment
it ran, including in CI. Installing `pathspec` was arbitrary code execution on the
critical path of the thing that authorizes changes.

The ambient-leak bug was never git's fault — it was WHERE git ran. Run it in a
freshly-initialised, empty, isolated repo and every leak source is gone by
construction:

  * empty repo, `--template=`  → no `.gitignore` anywhere to be found
  * truncated `.git/info/exclude` → no per-clone ambient list
  * `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL=/dev/null`, redirected
    `HOME`/`XDG_CONFIG_HOME`, and every inherited `GIT_*` var dropped
                              → no system/global/env `core.excludesFile`,
                                and no inherited GIT_DIR pointing us elsewhere
  * `-c core.excludesFile=<allowlist>` → the allowlist, and nothing else
  * `-c core.ignoreCase=false` → LOAD-BEARING. `git init` writes
    `core.ignoreCase=true` on a case-insensitive filesystem (macOS), which makes
    `Case/**` also own `case/x`. Unpinned, this matcher would answer differently
    on a developer's Mac than in Linux CI — the same silent divergence in a new
    costume.

That removes the package, pip, the venv, the cache, the lockfile and the network
in one move. It also replaces a REIMPLEMENTATION of gitwildmatch with git's own
engine, so the second dialect that caused the original bug stops existing.

EQUIVALENCE, AND ITS LIMIT

git and pathspec were compared before the swap: identical on 1,196 paths across
nv-main.txt / nv-dashboard.txt / nv-slang.txt, and on 11,843 nv-main candidates.
That corpus is necessary but NOT sufficient — real tracked paths never exercise
hard gitignore syntax. A 23-case adversarial corpus (ordered negation, `**`,
rooted, directory-only, escaped `!`/`#`, character classes, trailing
spaces/backslashes, case) found exactly one behavioural difference, and git is
the correct side of it:

    docs/**
    !docs/private/**

git reports `docs/private/s.md` as owned; pathspec reports it as not owned.
`docs/**` matches the DIRECTORY `docs/private`, and git documents that "it is not
possible to re-include a file if a parent directory of that file is excluded".
pathspec has no such rule and just takes the last matching pattern. No allowlist
in this repo uses negation today, so nothing changes in practice — but git's
answer is now the contract, and ownership_matcher.test.ts pins it.

CLI:
    ownership.py <allowlist-file>       candidates on stdin, owned ones on stdout
    ownership.py -0 <allowlist-file>    NUL-delimited in AND out (use this)

`-0` is what production callers use, because a path may legally contain a
newline. Line mode remains the default so that a caller composed from an older
branch keeps working instead of handing this a single newline-riddled blob that
matches nothing and reads as "nothing is owned".

Exit codes:
    0  matched — an EMPTY result is a valid answer ("nothing here is owned")
    2  cannot answer: allowlist missing, unreadable, or carrying no patterns;
       git unavailable or failing. Never "allowed" by default.

Note `git check-ignore` exits 1 when nothing matched. That is a successful
answer, not an error, and is mapped to 0 here.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import weakref
from pathlib import Path
from typing import Iterable

__all__ = ["OwnershipError", "OwnershipSpec", "build_spec", "load_patterns"]


class OwnershipError(RuntimeError):
    """Ownership could not be determined.

    Every raise site is a "no answer" condition, never a "not owned" one. Callers
    must fail closed on it: a guard that cannot evaluate ownership and reports
    success is worse than no guard, because everyone believes it.
    """


def _isolated_env(home: Path) -> dict[str, str]:
    """An environment in which git can see no ignore rules but the ones we pass.

    Every inherited `GIT_*` variable is dropped rather than a hand-picked few:
    `GIT_DIR`/`GIT_WORK_TREE`/`GIT_INDEX_FILE` would silently redirect us back
    into a real repo (this module can run from a git hook), and enumerating the
    dangerous ones is a list that rots. PATH and the rest of the environment are
    preserved so git itself is still findable.
    """
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env["GIT_CONFIG_NOSYSTEM"] = "1"  # no /etc/gitconfig
    env["GIT_CONFIG_GLOBAL"] = os.devnull  # no ~/.gitconfig (git >= 2.32)
    env["HOME"] = str(home)  # ...and no ~/.gitconfig on older git either
    env["XDG_CONFIG_HOME"] = str(home)  # no ~/.config/git/{config,ignore}
    return env


class OwnershipSpec:
    """A compiled allowlist, evaluated by git inside a private empty repo.

    The repo is created once and reused for every query, so matching a thousand
    candidates is one subprocess rather than a thousand. Usable as a context
    manager; otherwise the temporary directory is removed when the object is
    collected.
    """

    def __init__(self, patterns: list[str]) -> None:
        # An allowlist with no patterns owns nothing, and "owns nothing" is
        # indistinguishable from a clean result at every call site. Refuse.
        if not patterns:
            raise OwnershipError(
                "ownership allowlist carries no patterns — every path would be "
                "judged unowned and every comparison would trivially pass"
            )
        self._root = Path(tempfile.mkdtemp(prefix="nv-ownership-"))
        self._cleanup = weakref.finalize(self, shutil.rmtree, str(self._root), True)
        try:
            self._env = _isolated_env(self._root)
            self._repo = self._root / "repo"
            self._repo.mkdir()
            # `--template=` keeps git from copying a template .git/info/exclude in.
            self._git(["init", "-q", "--template=", str(self._repo)], cwd=self._root)
            info = self._repo / ".git" / "info"
            info.mkdir(parents=True, exist_ok=True)
            info.joinpath("exclude").write_bytes(b"")  # belt and braces
            self._allowlist = self._root / "allowlist"
            self._allowlist.write_bytes(
                b"".join(_fsencode(p) + b"\n" for p in patterns)
            )
        except BaseException:
            self.close()
            raise

    # -- lifecycle ---------------------------------------------------------

    def close(self) -> None:
        self._cleanup()

    def __enter__(self) -> "OwnershipSpec":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    # -- matching ----------------------------------------------------------

    def match_files(self, paths: Iterable[str]) -> set[str]:
        """The subset of `paths` the allowlist owns. One git call, whole batch."""
        wanted = [p for p in paths if p]
        if not wanted:
            return set()
        result = self._git(
            [
                "-C",
                str(self._repo),
                "-c",
                "core.ignoreCase=false",
                "-c",
                f"core.excludesFile={self._allowlist}",
                "check-ignore",
                "-z",
                "--no-index",
                "--stdin",
            ],
            stdin=b"".join(_fsencode(p) + b"\0" for p in wanted),
            # 1 == "nothing matched", which is an answer, not a failure. Anything
            # else (128: a path outside the repo, a broken repo) is NOT an answer.
            ok=(0, 1),
        )
        return {_fsdecode(b) for b in result.stdout.split(b"\0") if b}

    def match_file(self, path: str) -> bool:
        """One path. Prefer `match_files` for batches — this is a subprocess."""
        return bool(path) and path in self.match_files([path])

    # -- plumbing ----------------------------------------------------------

    def _git(
        self,
        args: list[str],
        *,
        stdin: bytes | None = None,
        cwd: Path | None = None,
        ok: tuple[int, ...] = (0,),
    ) -> "subprocess.CompletedProcess[bytes]":
        try:
            proc = subprocess.run(
                ["git", *args],
                input=stdin,
                capture_output=True,
                cwd=str(cwd) if cwd else None,
                env=self._env,
            )
        except OSError as e:
            raise OwnershipError(
                f"cannot run git, so path ownership cannot be evaluated: {e}"
            ) from e
        if proc.returncode not in ok:
            detail = proc.stderr.decode("utf-8", "replace").strip() or "(no output)"
            raise OwnershipError(
                f"git {args[0] if args else ''} failed "
                f"(exit {proc.returncode}): {detail}"
            )
        return proc


def _fsencode(text: str) -> bytes:
    """Path/pattern text to bytes, round-tripping bytes that are not valid UTF-8."""
    return text.encode("utf-8", "surrogateescape")


def _fsdecode(raw: bytes) -> str:
    return raw.decode("utf-8", "surrogateescape")


def load_patterns(config_path: Path) -> list[str]:
    """Allowlist lines that carry a pattern. `#` comments and blanks are dropped.

    Lines are returned VERBATIM apart from the line terminator. They are not
    `.strip()`ed: in gitignore syntax leading whitespace is part of the pattern
    and a backslash-escaped trailing space is significant, so stripping would
    quietly rewrite `foo\\ ` into the malformed `foo\\`. Every allowlist in this
    repo is already flush-left with no trailing whitespace (ownership_matcher.
    test.ts asserts it stays that way), so this is faithfulness, not a change.
    """
    try:
        raw = config_path.read_bytes()
    except OSError as e:
        raise OwnershipError(f"cannot read ownership allowlist {config_path}: {e}") from e
    lines = _fsdecode(raw).splitlines()
    return [
        line.rstrip("\r")  # tolerate CRLF checkouts
        for line in lines
        if line.strip() and not line.lstrip().startswith("#")
    ]


def build_spec(patterns: list[str]) -> OwnershipSpec:
    """gitwildmatch — .gitignore syntax, and NOTHING but the patterns given."""
    return OwnershipSpec(patterns)


def main(argv: list[str]) -> int:
    args = argv[1:]
    nul = False
    if args and args[0] in ("-0", "--stdin0"):
        nul = True
        args = args[1:]
    if len(args) != 1:
        print(
            "usage: ownership.py [-0] <allowlist-file>  (candidate paths on stdin)",
            file=sys.stderr,
        )
        return 2

    config = Path(args[0])
    if not config.is_file():
        print(f"::error::ownership allowlist not found: {config}", file=sys.stderr)
        return 2

    raw = sys.stdin.buffer.read()
    sep = b"\0" if nul else b"\n"
    candidates = [_fsdecode(c.rstrip(b"\r") if sep == b"\n" else c) for c in raw.split(sep)]

    try:
        patterns = load_patterns(config)
        with build_spec(patterns) as spec:
            owned = spec.match_files(candidates)
    except OwnershipError as e:
        print(f"::error::{e} (allowlist: {config})", file=sys.stderr)
        return 2

    # Emit in input order, deduplicated — callers read this as a list, and a
    # set's iteration order would make the output non-reproducible.
    seen: set[str] = set()
    out = sys.stdout.buffer
    for c in candidates:
        if c in owned and c not in seen:
            seen.add(c)
            out.write(_fsencode(c) + (b"\0" if nul else b"\n"))
    out.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
