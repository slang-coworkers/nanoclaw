"""PR-description length check behind gate-pr-description.sh (run as `python3 pr_description.py`).

Squash merges copy the PR description into git log, so the description stays
short: every section (a line starting with a bold label such as `**Summary.**`,
or a `## Heading`) holds at most PR_DESCRIPTION_MAX_SECTION_LINES non-empty lines
including the label line (default 2), the whole description holds at most
PR_DESCRIPTION_MAX_CHARS characters (default 1000), and it carries no Markdown
table. A final `<sub>…</sub>` disclaimer line and exact `Fixes|Closes|Resolves #N`
lines are not counted. The full explanation belongs in the explanation comment
(/explain-diff-html), not here.

Reads the PreToolUse hook JSON on stdin. Finds every `gh pr create`, `gh pr edit`
and `gh api …/pulls[/N]` in the Bash command that sets a description, resolves
the text (inline, heredoc, `$(cat <<EOF …)`, `$(cat FILE)`, a file — one this same
command writes with `cat > FILE <<EOF` counts — or stdin from a heredoc), and
checks it. A `gh pr create` that takes its description from anywhere else
(--fill*, --template, --editor, --recover, a prompt) is refused: that text can't
be checked here.

Exit 0 = allow (nothing to check, or within limits). Exit 2 = deny, with one line
on stderr saying what is over, or that the text could not be read. `--quiet`
prints nothing (gate-critique-on-deliver.sh uses it to step aside for a
description this gate refuses).
"""

from __future__ import annotations

import json
import os
import re
import shlex
import sys

HEREDOC_RE = re.compile(r"(?<!<)<<(?!<)(-?)[ \t]*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2")
PLACEHOLDER = "__NCHD{}__"
PLACEHOLDER_RE = re.compile(r"__NCHD(\d+)__")
CAT_HEREDOC_RE = re.compile(r"^\$\(\s*cat\s+(?:-\s+)?__NCHD(\d+)__\s*\)$", re.DOTALL)
CAT_FILE_RE = re.compile(r"^\$\(\s*(?:cat\s+|<\s*)['\"]?([^'\"\s()$`]+)['\"]?\s*\)$", re.DOTALL)
WRITE_RES = (
    re.compile(r"\bcat\s*>>?\s*['\"]?([^\s'\";&|<>]+)['\"]?\s*__NCHD(\d+)__"),
    re.compile(r"\bcat\s+__NCHD(\d+)__\s*>>?\s*['\"]?([^\s'\";&|<>]+)"),
    re.compile(r"\btee\s+(?:-a\s+)?['\"]?([^\s'\";&|<>]+)['\"]?\s*__NCHD(\d+)__"),
    re.compile(r"\btee\s+(?:-a\s+)?__NCHD(\d+)__\s+['\"]?([^\s'\";&|<>]+)"),
)
# Any other write to a path in the same command: a redirection, tee, cp/mv target.
REDIRECT_TARGET_RE = re.compile(r"(?:^|[^<&0-9])\d?>>?\|?\s*['\"]?([^\s'\";&|<>()]+)")
TEE_RE = re.compile(r"\btee\s+((?:-a\s+)?(?:['\"]?[^\s'\";&|<>()]+['\"]?\s*)+)")
CD_RE = re.compile(r"(?:^|[;&|(]\s*)cd\s+['\"]?([^\s'\";&|)]+)")
SEPARATORS = {";", ";;", "&", "&&", "|", "||", "|&", "\n"}

ISSUE_REF = r"(?:(?:[\w.-]+/[\w.-]+)?#\d+|https://github\.com/[\w.-]+/[\w.-]+/(?:issues|pull)/\d+)"
CLOSING_WORD = r"(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)"
CLOSING_RE = re.compile(
    rf"^\s*{CLOSING_WORD}\s*:?\s+{ISSUE_REF}(?:\s*(?:,|and)\s*(?:{CLOSING_WORD}\s*:?\s+)?{ISSUE_REF})*\s*\.?\s*$",
    re.IGNORECASE,
)
DISCLAIMER_RE = re.compile(r"^\s*<sub>.*</sub>\s*$", re.IGNORECASE)
BOLD_LABEL_RE = re.compile(r"^\s*(\*\*|__)\s*(?P<label>[^*_\n]{1,80}?)\s*[.:]?\s*\1[.:]?(\s|$)")
HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(?P<label>.+?)\s*#*\s*$")
# A table's delimiter row, with or without outer pipes: `|---|:--:|` or `--- | ---`.
TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$")

PR_FLAGS_WITH_VALUE = {
    "-t", "--title", "-b", "--body", "-F", "--body-file", "-B", "--base", "-H", "--head", "-a", "--assignee",
    "-l", "--label", "-m", "--milestone", "-p", "--project", "-r", "--reviewer", "-R", "--repo", "-T",
    "--template", "--recover", "--add-assignee", "--remove-assignee", "--add-label", "--remove-label",
    "--add-project", "--remove-project", "--add-reviewer", "--remove-reviewer",
}
API_FLAGS_WITH_VALUE = {
    "-X", "--method", "-H", "--header", "-f", "--raw-field", "-F", "--field", "--input", "-q", "--jq",
    "-t", "--template", "--hostname", "-p", "--preview", "--cache",
}
PULLS_ENDPOINT_RE = re.compile(r"(^|/)repos/[^/]+/[^/]+/pulls(/\d+)?/?$")


class Unreadable(Exception):
    pass


def env_int(name: str, default: int) -> int:
    v = os.environ.get(name, "")
    return int(v) if v.isdigit() and int(v) > 0 else default


def limits() -> tuple[int, int]:
    return env_int("PR_DESCRIPTION_MAX_CHARS", 1000), env_int("PR_DESCRIPTION_MAX_SECTION_LINES", 2)


# ── the rules (mirrored in explain-diff-html/scripts/upsert_pr_body.py) ──────

def counted_lines(body: str) -> list[str]:
    """The body's lines minus a final `<sub>` disclaimer and exact closing-keyword lines."""
    lines = body.replace("\r\n", "\n").split("\n")
    last = max((i for i, ln in enumerate(lines) if ln.strip()), default=-1)
    if last >= 0 and DISCLAIMER_RE.match(lines[last]):
        lines = lines[:last] + lines[last + 1:]
    return [ln for ln in lines if not CLOSING_RE.match(ln)]


def has_table(lines: list[str]) -> bool:
    prev = ""
    for ln in lines:
        if ln.strip() and "|" in ln and "-" in ln and TABLE_SEP_RE.match(ln) and "|" in prev:
            return True
        if ln.strip():
            prev = ln
    return False


def check_body(body: str, max_chars: int, max_lines: int) -> list[str]:
    """Everything over the limits, as short phrases; empty when the body is fine."""
    lines = counted_lines(body)
    problems: list[str] = []
    sections: list[list] = []
    for ln in lines:
        if not ln.strip():
            continue
        m = BOLD_LABEL_RE.match(ln) or HEADING_RE.match(ln)
        if m:
            sections.append([m.group("label").strip().rstrip(".:"), 1])
        elif sections:
            sections[-1][1] += 1
    for label, n in sections:
        if n > max_lines:
            problems.append(f"{label} has {n} lines, max {max_lines}")
    if has_table(lines):
        problems.append("it contains a table")
    total = len("\n".join(lines).strip())
    if total > max_chars:
        problems.append(f"total {total:,} chars, max {max_chars:,}")
    return problems


# ── reading the command ──────────────────────────────────────────────────────

def split_heredocs(cmd: str) -> tuple[str, list[str]]:
    """Command with each heredoc body removed and its `<<EOF` replaced by a placeholder."""
    out: list[str] = []
    docs: list[str] = []
    pending: list[tuple[int, str, bool, list[str]]] = []
    for line in cmd.split("\n"):
        if pending:
            idx, delim, dash, buf = pending[0]
            if (line.lstrip("\t") if dash else line) == delim:
                docs[idx] = "\n".join(buf) + ("\n" if buf else "")
                pending.pop(0)
            else:
                buf.append(line.lstrip("\t") if dash else line)
            continue

        def repl(m: re.Match) -> str:
            docs.append("")
            pending.append((len(docs) - 1, m.group(3), m.group(1) == "-", []))
            return " " + PLACEHOLDER.format(len(docs) - 1) + " "

        out.append(HEREDOC_RE.sub(repl, line))
    for idx, _d, _dash, buf in pending:  # unterminated: what followed is the body
        docs[idx] = "\n".join(buf)
    return "\n".join(out), docs


def tokenize(cmd: str) -> list[str]:
    lex = shlex.shlex(cmd.replace("\\\n", " "), posix=True, punctuation_chars=";&|\n")
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    return list(lex)


def segments(tokens: list[str]) -> list[tuple[str, list[str]]]:
    """(separator before it, words) for each simple command."""
    segs: list[tuple[str, list[str]]] = [("", [])]
    for t in tokens:
        if t in SEPARATORS or (t and set(t) <= set(";&|\n")):
            segs.append((t, []))
        else:
            segs[-1][1].append(t)
    return [s for s in segs if s[1]]


class Reader:
    def __init__(self, cmd: str, cwd: str):
        self.cmd, self.docs = split_heredocs(cmd)
        self.cwd = cwd
        self.cd = ""
        m = CD_RE.search(self.cmd)
        if m:
            target = m.group(1)
            if target.startswith("/"):
                self.cd = target
            elif cwd.startswith("/"):
                self.cd = os.path.normpath(os.path.join(cwd, target))
        self.written: dict[str, str] = {}
        for rx in WRITE_RES:
            for m in rx.finditer(self.cmd):
                a, b = m.group(1), m.group(2)
                path, idx = (b, a) if a.isdigit() and not b.isdigit() else (a, b)
                self.written[self.abspath(path) or path] = self.docs[int(idx)]
        # Every other path this command writes: reading it now would read stale text.
        self.overwritten: set[str] = set()
        for m in REDIRECT_TARGET_RE.finditer(self.cmd):
            self.overwritten.add(self.abspath(m.group(1)) or m.group(1))
        for m in TEE_RE.finditer(self.cmd):
            for p in shlex.split(m.group(1)):
                if p != "-a" and not PLACEHOLDER_RE.fullmatch(p):
                    self.overwritten.add(self.abspath(p) or p)

    def abspath(self, ref: str) -> str:
        if ref.startswith("~/"):
            return os.path.join(os.path.expanduser("~"), ref[2:])
        if ref.startswith("/"):
            return ref
        base = self.cd or self.cwd
        return os.path.normpath(os.path.join(base, ref)) if base.startswith("/") else ""

    def literal_in_single_quotes(self, value: str) -> bool:
        return f"'{value}'" in self.cmd

    def text(self, value: str) -> str:
        """An inline --body / -f body= value."""
        m = CAT_HEREDOC_RE.match(value)
        if m:
            return self.docs[int(m.group(1))]
        m = CAT_FILE_RE.match(value)
        if m:
            return self.file(m.group(1))
        if ("$" in value or "`" in value) and not self.literal_in_single_quotes(value):
            raise Unreadable("it is built by the shell at run time")
        if PLACEHOLDER_RE.search(value):
            raise Unreadable("it mixes a heredoc into the value")
        return value

    def stdin(self, segs: list[tuple[str, list[str]]], i: int) -> str:
        """Text a segment reads on stdin: its own heredoc, or a piped `cat <<EOF`."""
        for tok in segs[i][1]:
            m = PLACEHOLDER_RE.fullmatch(tok)
            if m:
                return self.docs[int(m.group(1))]
        if i > 0 and segs[i][0] in ("|", "|&"):
            prev = segs[i - 1][1]
            if prev and prev[0] == "cat":
                docs = [PLACEHOLDER_RE.fullmatch(t) for t in prev[1:]]
                if len(prev) >= 2 and all(d is not None or t == "-" for d, t in zip(docs, prev[1:])):
                    found = [d for d in docs if d is not None]
                    if len(found) == 1:
                        return self.docs[int(found[0].group(1))]
        raise Unreadable("it is read from stdin, not from a heredoc on the same command")

    def file(self, ref: str, segs: list | None = None, i: int = 0) -> str:
        if ref in ("-", "/dev/stdin"):
            return self.stdin(segs or [("", [])], i)
        if "$" in ref or "`" in ref:
            raise Unreadable(f"the path {ref} is built by the shell at run time")
        path = self.abspath(ref)
        for key in (path, ref):
            if key and key in self.written:
                return self.written[key]
        if path and path in self.overwritten or ref in self.overwritten:
            raise Unreadable(f"this same command writes {ref} before using it — write the file in an earlier step")
        if path and os.path.isfile(path):
            with open(path, encoding="utf-8", errors="replace") as fh:
                return fh.read()
        raise Unreadable(f"the file {ref} can't be read from here")


def parse_flags(args: list[str], with_value: set[str]) -> tuple[list[tuple[str, str | None]], list[str]]:
    """(flags as (name, value), positionals); handles `--x v`, `--x=v` and `-xv` for value flags."""
    flags: list[tuple[str, str | None]] = []
    pos: list[str] = []
    i = 0
    while i < len(args):
        a = args[i]
        if a.startswith("--") and "=" in a:
            name, _, val = a.partition("=")
            flags.append((name, val))
        elif a in with_value:
            flags.append((a, args[i + 1] if i + 1 < len(args) else ""))
            i += 1
        elif a.startswith("-") and not a.startswith("--") and len(a) > 2 and a[:2] in with_value:
            flags.append((a[:2], a[2:]))
        elif a.startswith("-") and a != "-":
            flags.append((a, None))
        else:
            pos.append(a)
        i += 1
    return flags, pos


def gh_pr_body(reader: Reader, segs: list, si: int, verb: str, args: list[str]) -> str | None:
    flags, _ = parse_flags(args, PR_FLAGS_WITH_VALUE)
    names = {n for n, _ in flags}
    if names & {"-h", "--help"}:
        return None
    body = None
    for name, val in flags:
        if name in ("-b", "--body"):
            body = reader.text(val or "")
        elif name in ("-F", "--body-file"):
            body = reader.file(val or "", segs, si)
    if body is None and verb == "create":
        how = sorted(names & {"--fill", "-f", "--fill-first", "--fill-verbose", "-T", "--template", "-e",
                              "--editor", "--recover", "-w", "--web"})
        raise Unreadable(f"gh pr create takes its description from {', '.join(how) if how else 'a prompt'}, "
                         "which can't be checked here")
    return body


def gh_api_body(reader: Reader, segs: list, si: int, args: list[str]) -> str | None:
    flags, pos = parse_flags(args, API_FLAGS_WITH_VALUE)
    endpoint = (pos[0] if pos else "").split("?")[0]
    if not PULLS_ENDPOINT_RE.search(endpoint):
        return None
    body = None
    for name, val in flags:
        if name == "--input":
            raw = reader.file(val or "", segs, si)
            try:
                data = json.loads(raw)
            except ValueError:
                raise Unreadable("its --input is not JSON") from None
            if isinstance(data, dict) and isinstance(data.get("body"), str):
                return data["body"]  # --input is the request body; fields become query params
            return None
        if name in ("-f", "--raw-field", "-F", "--field") and val is not None:
            key, _, v = val.partition("=")
            if key == "body":
                if name in ("-F", "--field") and v.startswith("@"):
                    body = reader.file(v[1:], segs, si)
                else:
                    body = reader.text(v)
    return body


def bodies(reader: Reader) -> list[tuple[str, str]]:
    """(what, body) for every description this command sets."""
    found: list[tuple[str, str]] = []
    segs = segments(tokenize(reader.cmd))
    for si, (_sep, seg) in enumerate(segs):
        gi = command_word(seg)
        if gi is None or (seg[gi] != "gh" and not seg[gi].endswith("/gh")):
            continue
        rest = [t for t in seg[gi + 1:] if not PLACEHOLDER_RE.fullmatch(t)]
        if len(rest) >= 2 and rest[0] == "pr" and rest[1] in ("create", "edit"):
            body = gh_pr_body(reader, segs, si, rest[1], rest[2:])
            if body is not None:
                found.append((f"gh pr {rest[1]}", body))
        elif rest and rest[0] == "api":
            body = gh_api_body(reader, segs, si, rest[1:])
            if body is not None:
                found.append(("gh api …/pulls", body))
    return found


def command_word(seg: list[str]) -> int | None:
    """Index of the command a simple command runs, past `VAR=x`, env/command/exec/time/nohup/sudo prefixes."""
    i = 0
    while i < len(seg):
        w = seg[i]
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", w, re.DOTALL) or w in ("env", "command", "exec", "time",
                                                                          "nohup", "sudo"):
            i += 1
            continue
        if w == "timeout":
            i += 2
            continue
        return i
    return None


def main(argv: list[str]) -> int:
    quiet = "--quiet" in argv
    if os.environ.get("PR_DESCRIPTION_GATE", "1") == "0":
        return 0
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        return 0
    if hook.get("tool_name") != "Bash":
        return 0
    cmd = (hook.get("tool_input") or {}).get("command") or ""
    if isinstance(cmd, list):
        cmd = cmd[2] if len(cmd) >= 3 and cmd[1] in ("-c", "-lc") else shlex.join(str(c) for c in cmd)
    max_chars, max_lines = limits()
    try:
        found = bodies(Reader(str(cmd), str(hook.get("cwd") or "")))
    except Unreadable as e:
        if not quiet:
            print(f"PR DESCRIPTION CHECK: can't read the description this command sets ({e}) — write it to a file "
                  "in an earlier step and pass --body-file <absolute path>.", file=sys.stderr)
        return 2
    except ValueError:
        # shlex could not split the command (e.g. unbalanced quotes): the shell would reject it too.
        return 0
    for what, body in found:
        problems = check_body(body, max_chars, max_lines)
        if problems:
            if not quiet:
                print(f"PR DESCRIPTION TOO LONG for {what}: {'; '.join(problems)} — move details, tables and open "
                      f"questions to the explanation comment (/explain-diff-html); keep each section to {max_lines} "
                      f"lines and the whole description under {max_chars:,} chars.", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
