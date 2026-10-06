"""PR-description length check behind gate-pr-description.sh (run as `python3 pr_description.py`).

Squash merges copy the PR description into git log, so the description stays
short: every section (a line starting with a bold label such as `**Summary.**`,
or a `## Heading`) holds at most PR_DESCRIPTION_MAX_SECTION_LINES non-empty lines
including the label line (default 2), the whole description holds at most
PR_DESCRIPTION_MAX_CHARS characters (default 1000), and it carries no Markdown
table. A trailing `<sub>…</sub>` disclaimer and `Fixes|Closes|Resolves #N` lines
are not counted. The full explanation belongs in the explanation comment
(/explain-diff-html), not here.

Reads the PreToolUse hook JSON on stdin. Finds every `gh pr create`, `gh pr edit`
and `gh api …/pulls[/N]` in the Bash command that sets a description, resolves
the text (inline, heredoc, `$(cat <<EOF …)`, `$(cat /abs/file)`, or a file — one
this same command writes with `cat > FILE <<EOF` counts), and checks it.

Exit 0 = allow (nothing to check, or within limits). Exit 2 = deny, with one line
on stderr saying what is over, or that the text could not be read.
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
CD_RE = re.compile(r"(?:^|[;&|(]\s*)cd\s+['\"]?(/[^\s'\";&|)]+)")
SEPARATORS = {";", ";;", "&", "&&", "|", "||", "|&", "\n"}

DISCLAIMER_RE = re.compile(r"^\s*<sub>.*</sub>\s*$", re.IGNORECASE)
CLOSING_RE = re.compile(r"^\s*(fix(es|ed)?|close[sd]?|resolve[sd]?)\b.*(#\d+|/issues/\d+)", re.IGNORECASE)
BOLD_LABEL_RE = re.compile(r"^\s*(\*\*|__)\s*(?P<label>[^*_\n]{1,80}?)\s*[.:]?\s*\1[.:]?(\s|$)")
HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(?P<label>.+?)\s*#*\s*$")
TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")


class Unreadable(Exception):
    pass


def env_int(name: str, default: int) -> int:
    v = os.environ.get(name, "")
    return int(v) if v.isdigit() and int(v) > 0 else default


def limits() -> tuple[int, int]:
    return env_int("PR_DESCRIPTION_MAX_CHARS", 1000), env_int("PR_DESCRIPTION_MAX_SECTION_LINES", 2)


# ── the rules ────────────────────────────────────────────────────────────────

def section_label(line: str) -> str | None:
    m = BOLD_LABEL_RE.match(line) or HEADING_RE.match(line)
    return m.group("label").strip().rstrip(".:") if m else None


def check_body(body: str, max_chars: int, max_lines: int) -> list[str]:
    """Everything over the limits, as short phrases; empty when the body is fine."""
    lines = [ln for ln in body.replace("\r\n", "\n").split("\n")
             if not DISCLAIMER_RE.match(ln) and not CLOSING_RE.match(ln)]
    problems: list[str] = []
    sections: list[list] = []
    for ln in lines:
        if not ln.strip():
            continue
        label = section_label(ln)
        if label is not None:
            sections.append([label, 1])
        elif sections:
            sections[-1][1] += 1
    for label, n in sections:
        if n > max_lines:
            problems.append(f"{label} has {n} lines, max {max_lines}")
    if any(TABLE_SEP_RE.match(ln) for ln in lines) and any(TABLE_ROW_RE.match(ln) for ln in lines):
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


def segments(tokens: list[str]) -> list[list[str]]:
    segs: list[list[str]] = [[]]
    for t in tokens:
        if t in SEPARATORS or (t and set(t) <= set(";&|\n")):
            segs.append([])
        else:
            segs[-1].append(t)
    return [s for s in segs if s]


class Reader:
    def __init__(self, cmd: str, cwd: str):
        self.cmd, self.docs = split_heredocs(cmd)
        self.cwd = cwd
        m = CD_RE.search(self.cmd)
        self.cd = m.group(1) if m else ""
        self.written: dict[str, str] = {}
        for rx in WRITE_RES:
            for m in rx.finditer(self.cmd):
                a, b = m.group(1), m.group(2)
                path, idx = (b, a) if a.isdigit() and not b.isdigit() else (a, b)
                self.written[path] = self.docs[int(idx)]

    def text(self, value: str) -> str:
        """An inline --body / -f body= value."""
        m = CAT_HEREDOC_RE.match(value)
        if m:
            return self.docs[int(m.group(1))]
        m = CAT_FILE_RE.match(value)
        if m:
            return self.file(m.group(1))
        if "$" in value or "`" in value:
            raise Unreadable("it is built by the shell at run time")
        if PLACEHOLDER_RE.search(value):
            raise Unreadable("it mixes a heredoc into the value")
        return value

    def file(self, ref: str, segment: list[str] | None = None) -> str:
        if ref in ("-", "/dev/stdin"):
            for tok in segment or []:
                m = PLACEHOLDER_RE.fullmatch(tok)
                if m:
                    return self.docs[int(m.group(1))]
            raise Unreadable("it is read from stdin, not from a heredoc on the same command")
        if "$" in ref or "`" in ref:
            raise Unreadable(f"the path {ref} is built by the shell at run time")
        if ref.startswith("~/"):
            ref = os.path.join(os.path.expanduser("~"), ref[2:])
        if ref in self.written:
            return self.written[ref]
        candidates = [ref] if ref.startswith("/") else [os.path.join(b, ref) for b in (self.cd, self.cwd) if b.startswith("/")]
        for c in candidates:
            if c in self.written:
                return self.written[c]
            if os.path.isfile(c):
                with open(c, encoding="utf-8", errors="replace") as fh:
                    return fh.read()
        raise Unreadable(f"the file {ref} can't be read from here")


def flag_value(args: list[str], i: int, names: tuple[str, ...]) -> tuple[str | None, int]:
    """(value, next index) when args[i] is one of names (as `--x v` or `--x=v`)."""
    a = args[i]
    for n in names:
        if a == n and i + 1 < len(args):
            return args[i + 1], i + 2
        if n.startswith("--") and a.startswith(n + "="):
            return a[len(n) + 1:], i + 1
    return None, i + 1


def bodies(reader: Reader) -> list[tuple[str, str]]:
    """(what, body) for every description this command sets."""
    found: list[tuple[str, str]] = []
    for seg in segments(tokenize(reader.cmd)):
        for gi, tok in enumerate(seg):
            if tok != "gh" and not tok.endswith("/gh"):
                continue
            rest = seg[gi + 1:]
            if len(rest) >= 2 and rest[0] == "pr" and rest[1] in ("create", "edit"):
                what = f"gh pr {rest[1]}"
                body = None
                i = 2
                while i < len(rest):
                    v, j = flag_value(rest, i, ("--body", "-b"))
                    if v is not None:
                        body, i = reader.text(v), j
                        continue
                    v, j = flag_value(rest, i, ("--body-file", "-F"))
                    if v is not None:
                        body, i = reader.file(v, seg), j
                        continue
                    i += 1
                if body is not None:
                    found.append((what, body))
            elif rest and rest[0] == "api":
                args = rest[1:]
                endpoint = next((a for a in args if not a.startswith("-") and "/" in a), "")
                if not re.search(r"(^|/)pulls(/\d+)?/?$", endpoint.split("?")[0]):
                    continue
                body = None
                i = 0
                while i < len(args):
                    a = args[i]
                    if a in ("-f", "--raw-field", "-F", "--field") and i + 1 < len(args):
                        key, _, val = args[i + 1].partition("=")
                        if key == "body":
                            if a in ("-F", "--field") and val.startswith("@"):
                                body = reader.file(val[1:], seg)
                            else:
                                body = reader.text(val)
                        i += 2
                        continue
                    if a == "--input" and i + 1 < len(args):
                        raw = reader.file(args[i + 1], seg)
                        try:
                            data = json.loads(raw)
                        except ValueError:
                            raise Unreadable("its --input is not JSON")
                        if isinstance(data, dict) and isinstance(data.get("body"), str):
                            body = data["body"]
                        i += 2
                        continue
                    i += 1
                if body is not None:
                    found.append(("gh api …/pulls", body))
    return found


def main() -> int:
    if os.environ.get("PR_DESCRIPTION_GATE", "1") == "0":
        return 0
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        return 0
    if hook.get("tool_name") != "Bash":
        return 0
    cmd = str((hook.get("tool_input") or {}).get("command") or "")
    max_chars, max_lines = limits()
    try:
        found = bodies(Reader(cmd, str(hook.get("cwd") or "")))
    except Unreadable as e:
        print(f"PR DESCRIPTION CHECK: can't read the description this command sets ({e}) — write it to a file "
              "in an earlier step and pass --body-file <absolute path>.", file=sys.stderr)
        return 2
    except ValueError:
        # shlex could not split the command (e.g. unbalanced quotes): the shell would reject it too.
        return 0
    for what, body in found:
        problems = check_body(body, max_chars, max_lines)
        if problems:
            print(f"PR DESCRIPTION TOO LONG for {what}: {'; '.join(problems)} — move details, tables and open "
                  f"questions to the explanation comment (/explain-diff-html); keep each section to {max_lines} "
                  f"lines and the whole description under {max_chars:,} chars.", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
