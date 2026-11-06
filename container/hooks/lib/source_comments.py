"""Source-comment rules behind gate-source-comments.sh (run as `python3 source_comments.py`).

A source comment documents the code as it stands. Maintainers refuse comments that carry
process or history (issue and PR numbers, "before this change", "fixes #N") and comments
that spread deprecated terminology (`ConstRef` for what the IR calls a `borrow in`). A rule
in the prompt does not change what an agent writes into a comment; a refusal at commit time
does, so the rules are enforced here, on the `git commit` that would record the comment.

Reads the PreToolUse hook JSON on stdin (tool_input.command, cwd), finds the lines the commit
would add (`git diff --cached -U0`, or `git diff -U0 HEAD` for `git commit -a`), keeps the
added lines of source files (C, C++, CUDA, Slang, Lua by extension) that are comments, and
checks each comment's text:

  reference   `#1234`, `issues/1234`, `pull/1234`, `PR 1234`, `issue 1234`
  history     "before this change", "previously", "used to", "historically", "this PR", "fixes #"
  deprecated  `ConstRef`, "const ref"

Exit 0 = allow (nothing added, no source file, no finding). Exit 2 = deny, with one line on
stderr naming each file:line and its rule, and what to do instead. Text the hook cannot read
(a commit built by another program, a repository git cannot open) is allowed: the gate checks
what it can see and never guesses. SOURCE_COMMENT_GATE=0 disables it; SOURCE_COMMENT_EXTS
(comma-separated, e.g. `.cpp,.h`) overrides the file set; SOURCE_COMMENT_SKIP_PREFIXES (comma-separated
path prefixes, default `tests/,test/,external/`) overrides the trees left unchecked.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys

DEFAULT_EXTS = {".c", ".cc", ".cpp", ".cxx", ".cu", ".cuh", ".h", ".hpp", ".hxx", ".inl", ".slang", ".lua"}
MAX_REPORTED = 8
# A regression test names the issue it covers by convention, so test trees are not checked.
DEFAULT_SKIP_PREFIXES = ("tests/", "test/", "external/")

REFERENCE_RE = re.compile(
    r"(?<![\w/])#\d{3,}\b|\b(?:issues|pull)/\d+\b|\b(?:PR|pull request|issue)\s*#?\s*\d{3,}\b", re.IGNORECASE
)
HISTORY_RE = re.compile(
    r"\bbefore this (?:change|fix|patch|commit)\b|\bpreviously\b|\bused to\b|\bhistorically\b|\bthis PR\b|\bfixes\s*#", re.IGNORECASE
)
DEPRECATED_RE = re.compile(r"\bConstRef\b|\bconst[ -]ref\b", re.IGNORECASE)
RULES = (("issue or PR reference", REFERENCE_RE), ("history", HISTORY_RE), ("deprecated term", DEPRECATED_RE))

GIT_COMMIT_RE = re.compile(r"(?:^|[^\w./-])git(?:\s+-C\s+(\S+))?\s+commit(?:\s|$)")


def source_exts() -> set[str]:
    raw = os.environ.get("SOURCE_COMMENT_EXTS")
    if not raw:
        return DEFAULT_EXTS
    return {e.strip() if e.strip().startswith(".") else "." + e.strip() for e in raw.split(",") if e.strip()}


def skip_prefixes() -> tuple[str, ...]:
    raw = os.environ.get("SOURCE_COMMENT_SKIP_PREFIXES")
    if raw is None:
        return DEFAULT_SKIP_PREFIXES
    return tuple(p.strip() for p in raw.split(",") if p.strip())


def commit_invocation(command: str) -> tuple[bool, str | None, bool, list[str]]:
    """(is a git commit, -C directory, commits the whole working tree (-a), explicit pathspecs)."""
    m = GIT_COMMIT_RE.search(command)
    if not m:
        return False, None, False, []
    # Only the first command of a chain carries the commit's arguments.
    tail = re.split(r"(?<!\\)(?:&&|\|\||;|\|)", command[m.end():], 1)[0]
    try:
        args = shlex.split(tail)
    except ValueError:
        args = tail.split()
    takes_value = {"-m", "--message", "-F", "--file", "--author", "--date", "-t", "--template", "-c", "-C",
                   "--fixup", "--squash", "--reuse-message", "--reedit-message", "--cleanup", "--trailer",
                   "--pathspec-from-file"}
    all_tree = False
    paths: list[str] = []
    after_dashdash = False
    skip = False
    for a in args:
        if skip:
            skip = False
            continue
        if after_dashdash:
            paths.append(a)
            continue
        if a == "--":
            after_dashdash = True
            continue
        if a.startswith("--"):
            if a == "--all":
                all_tree = True
            elif a in takes_value:
                skip = True
            continue
        if a.startswith("-") and len(a) > 1:
            cluster = a[1:]
            if "a" in cluster:
                all_tree = True
            for j, ch in enumerate(cluster):
                if ch in "mFtcC":
                    skip = j == len(cluster) - 1
                    break
            continue
        paths.append(a)
    return True, m.group(1), all_tree, paths


def added_lines(repo: str, all_tree: bool, paths: list[str]) -> list[tuple[str, int, str]] | None:
    """(path, new line number, text) for every added line, or None when git cannot answer."""
    cmd = ["git", "-C", repo, "diff", "-U0", "--no-color", "--no-ext-diff"]
    if all_tree or paths:
        cmd.append("HEAD")
    else:
        cmd.append("--cached")
    if paths:
        cmd += ["--"] + paths
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=10, check=False)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    rows: list[tuple[str, int, str]] = []
    path = None
    line = 0
    for raw in out.stdout.splitlines():
        if raw.startswith("+++ "):
            target = raw[4:].strip()
            path = None if target == "/dev/null" else target.removeprefix("b/")
        elif raw.startswith("@@"):
            m = re.search(r"\+(\d+)(?:,(\d+))?", raw)
            line = int(m.group(1)) if m else 0
        elif raw.startswith("+") and not raw.startswith("+++"):
            if path is not None:
                rows.append((path, line, raw[1:]))
            line += 1
        elif raw.startswith(("-", "\\")):
            continue
        else:
            line += 1
    return rows


def comment_text(line: str, in_block: bool) -> tuple[str, bool]:
    """The comment part of one source line and whether a block comment is open after it."""
    text = []
    i = 0
    n = len(line)
    while i < n:
        if in_block:
            end = line.find("*/", i)
            if end < 0:
                text.append(line[i:])
                return " ".join(text), True
            text.append(line[i:end])
            i = end + 2
            in_block = False
            continue
        if line.startswith("//", i):
            text.append(line[i + 2:])
            return " ".join(text), False
        if line.startswith("/*", i):
            in_block = True
            i += 2
            continue
        if line[i] in "\"'":
            quote = line[i]
            i += 1
            while i < n and line[i] != quote:
                i += 2 if line[i] == "\\" else 1
            i += 1
            continue
        i += 1
    return " ".join(text), in_block


def lua_comment(line: str) -> str:
    m = re.search(r"--(.*)$", line)
    return m.group(1) if m else ""


def findings(rows: list[tuple[str, int, str]], exts: set[str], skipped: tuple[str, ...] = DEFAULT_SKIP_PREFIXES) -> list[tuple[str, int, str]]:
    out: list[tuple[str, int, str]] = []
    block_state: dict[str, bool] = {}
    for path, line, text in rows:
        ext = os.path.splitext(path)[1].lower()
        if ext not in exts or path.startswith(skipped):
            continue
        if ext == ".lua":
            comment = lua_comment(text)
        else:
            comment, block_state[path] = comment_text(text, block_state.get(path, False))
        if not comment.strip():
            continue
        for name, rx in RULES:
            if rx.search(comment):
                out.append((path, line, name))
                break
    return out


def main() -> int:
    if os.environ.get("SOURCE_COMMENT_GATE", "1") == "0":
        return 0
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if payload.get("tool_name") != "Bash":
        return 0
    command = str((payload.get("tool_input") or {}).get("command") or "")
    is_commit, c_dir, all_tree, paths = commit_invocation(command)
    if not is_commit:
        return 0
    repo = payload.get("cwd") or os.getcwd()
    if c_dir:
        repo = c_dir if os.path.isabs(c_dir) else os.path.join(repo, c_dir)
    rows = added_lines(repo, all_tree, paths)
    if not rows:
        return 0
    hits = findings(rows, source_exts(), skip_prefixes())
    if not hits:
        return 0
    shown = "; ".join(f"{p}:{n} ({r})" for p, n, r in hits[:MAX_REPORTED])
    more = f" and {len(hits) - MAX_REPORTED} more" if len(hits) > MAX_REPORTED else ""
    sys.stderr.write(
        f"[gate-source-comments.sh]: SOURCE COMMENT RULES: {len(hits)} added comment line(s) carry process or a deprecated term: "
        f"{shown}{more}. A comment documents the code as it stands: keep issue and PR numbers and history in the commit "
        f"message and the PR description, and say `borrow in`, not ConstRef. Fix the comments, re-stage, and commit again.\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
