"""GitHub comment-body check behind gate-github-comment-body.sh (run as `python3 github_comment_body.py`).

A GitHub write is refused when the text it would post is broken in one of two ways:

  a file name   The whole body is `@` and a path. gh reads a file only for -F/--body-file
                (gh issue|pr comment|review|create|edit), for `gh api -F/--field key=@<path>`
                and for `gh api --input <path>`. -b/--body and `gh api -f/--raw-field` send
                their value as it is, so `--body "@/tmp/c.md"` posts the text "@/tmp/c.md".
                Source: cli/cli v2.102.0 (the agent image's GH_VERSION), pkg/cmd/api/fields.go
                (`magicFieldValue` reads "@<path>" for -F only; -f keeps the raw string) and
                pkg/cmd/{issue,pr}/*/ (`--body-file` goes through cmdutil.ReadFile, `--body` is
                used as given).
  frontmatter   The body starts with a YAML frontmatter block: a `---` line, `key: value`
                lines and a closing `---` line. That is a memo file posted as it is; GitHub
                shows the block as text.

Reads the PreToolUse hook JSON on stdin and checks every body the call would send:

  Bash  `gh issue|pr comment|review|create|edit` (-b/--body, -F/--body-file), and `gh api` to
        an issue, pull request, comment or review endpoint (-f/-F body=…, --input JSON with
        body and comments[].body). Variables set earlier in the same command (`N=1`,
        `BODY="$(cat f.md)"`) are read, and so is a `jq … --arg b "$BODY" '{body: $b}'` pipe
        into `--input -`.
  MCP   GitHub MCP comment and review tools: body and comments[].body.

Command parsing (heredocs, $(cat …), --body-file, files this same command writes) is shared
with the PR description gate: this module imports pr_description.py from the same directory.

Exit 0 = allow (nothing to check, text that cannot be read here, or a body that is fine).
Exit 2 = deny, with one line on stderr naming the problem and the form that works. The gate
refuses only what it can read: a body built at run time from somewhere it cannot see passes.
"""

from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pr_description as pd  # command parsing shared with the description gate

# gh subcommands that post or set a body: -b/--body is the text, -F/--body-file a file to read.
GH_BODY_VERBS = {"issue": {"comment", "create", "edit"}, "pr": {"comment", "review", "create", "edit"}}
# `gh pr review -a/-c/-r` are booleans (approve, comment, request changes), so the comment and
# review verbs take only these values; create and edit take the description gate's set.
COMMENT_FLAGS_WITH_VALUE = {"-b", "--body", "-F", "--body-file", "-R", "--repo"}

# REST endpoints whose payload `body` is posted text: create or edit an issue or pull request,
# an issue or PR conversation comment, an inline review comment or a reply to one, a review
# (create, update, submit), and editing a comment by id. {owner}/{repo} placeholders match.
BODY_ENDPOINT_RE = re.compile(
    r"(?:^|/)repos/[^/]+/[^/]+/(?:"
    r"(?:issues|pulls)(?:/\d+)?"
    r"|(?:issues|pulls)/comments/\d+"
    r"|issues/\d+/comments"
    r"|pulls/\d+/comments(?:/\d+/replies)?"
    r"|pulls/\d+/reviews(?:/\d+(?:/events)?)?"
    r")/?$"
)
VAR_RE = re.compile(r"\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))")
ASSIGNMENT_RE = re.compile(r"^([A-Za-z_]\w*)=(.*)$", re.DOTALL)
# The `body` key of a jq object constructor and what it takes: `$name` or `.` (the raw input).
JQ_BODY_RE = re.compile(r"""(?:^|[{,])\s*["']?body["']?\s*:\s*(\$[A-Za-z_]\w*|\.)\s*(?=[,}])""")
FRONTMATTER_KEY_RE = re.compile(r"^[A-Za-z_][\w-]*\s*:(\s|$)")
FILE_EXT_RE = re.compile(r"\.[A-Za-z0-9]{1,8}$")


class Reader(pd.Reader):
    """The description gate's command reader, plus variables set in the same command and jq pipes.

    Consider this command, which posted a memo with its frontmatter on top:

        N=14468; REPO=shader-slang/slang
        BODY="$(cat memory/issues/comment-14468.md)"
        jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --input -

    The endpoint and the body exist only through the assignments and the jq pipe, so the reader
    keeps the value of every assignment it can read and builds the JSON the jq filter emits.
    """

    def __init__(self, cmd: str, cwd: str):
        super().__init__(cmd, cwd)
        self.vars: dict[str, str] = {}
        self.segs = pd.segments(pd.tokenize(self.cmd))
        for _sep, seg in self.segs:
            gi = pd.command_word(seg)
            if gi is not None and seg[gi] != "export":
                continue
            for word in seg:
                m = ASSIGNMENT_RE.match(word)
                if not m:
                    continue
                try:
                    self.vars[m.group(1)] = self.text(m.group(2))
                except pd.Unreadable:
                    self.vars.pop(m.group(1), None)

    def expand(self, value: str) -> str:
        """`value` with each `$NAME` / `${NAME}` replaced by its value from this command."""
        if "`" in value or "$(" in value or pd.PLACEHOLDER_RE.search(value):
            raise pd.Unreadable("it is built by the shell at run time")
        if "$" in VAR_RE.sub("", value):
            raise pd.Unreadable("it uses a shell expansion this gate does not read")

        def sub(m: re.Match) -> str:
            name = m.group(1) or m.group(2)
            if name not in self.vars:
                raise pd.Unreadable(f"${name} is set outside this command")
            return self.vars[name]

        return VAR_RE.sub(sub, value)

    def text(self, value: str) -> str:
        try:
            return super().text(value)
        except pd.Unreadable:
            return self.expand(value)

    def resolve(self, word: str) -> str:
        """A command word with this command's variables filled in, or the word as it is."""
        try:
            return self.text(word)
        except pd.Unreadable:
            return word

    def stdin(self, segs: list, i: int) -> str:
        try:
            return super().stdin(segs, i)
        except pd.Unreadable:
            if i > 0 and segs[i][0] in ("|", "|&"):
                out = self.jq_output(segs[i - 1][1])
                if out is not None:
                    return out
            raise

    def jq_output(self, words: list[str]) -> str | None:
        """The JSON a `jq … '{body: $b}'` or `jq -Rs '{body: .}' FILE` producer writes, else None."""
        gi = pd.command_word(words)
        if gi is None or words[gi] != "jq":
            return None
        named: dict[str, str] = {}
        short: set[str] = set()
        positional: list[str] = []
        i = gi + 1
        while i < len(words):
            w = words[i]
            if w in ("--arg", "--rawfile", "--argjson", "--slurpfile") and i + 2 < len(words):
                if w in ("--arg", "--rawfile"):
                    try:
                        named[words[i + 1]] = self.text(words[i + 2]) if w == "--arg" else self.file(words[i + 2])
                    except pd.Unreadable:
                        pass
                i += 3
                continue
            if w in ("--raw-input", "--slurp"):
                short.add("R" if w == "--raw-input" else "s")
            elif w.startswith("-") and not w.startswith("--") and w != "-":
                short.update(w[1:])
            elif not w.startswith("-"):
                positional.append(w)
            i += 1
        m = JQ_BODY_RE.search(positional[0]) if positional else None
        if not m:
            return None
        ref = m.group(1)
        if ref == ".":
            if not {"R", "s"} <= short or len(positional) < 2:
                return None
            return json.dumps({"body": self.file(positional[1])})
        return json.dumps({"body": named[ref[1:]]}) if ref[1:] in named else None


class Body:
    """One body a call would post: where it is set (`what`), how (`how`) and its text."""

    def __init__(self, what: str, how: str, text: str, source: str = ""):
        self.what, self.how, self.text, self.source = what, how, text, source


# ── the two checks ─────────────────────────────────────────────────────────────

def file_reference(text: str, reader: Reader | None) -> str | None:
    """The path when the whole text is `@<path>`, None otherwise.

    The path must look like one: absolute, home- or dot-relative, `-` (stdin), a name with an
    extension, or an existing file. A body that is only a mention (`@octocat`, `@org/team`)
    is not a path.
    """
    m = re.fullmatch(r"@(\S+)", text.strip())
    if not m:
        return None
    p = m.group(1)
    if p == "-" or p.startswith(("/", "~", "./", "../")) or FILE_EXT_RE.search(p):
        return p
    full = reader.abspath(p) if reader else ""
    return p if full and os.path.exists(full) else None


def has_frontmatter(text: str) -> bool:
    """True when the text opens with a YAML frontmatter block.

    The first non-blank line is `---`, a later line is `---` (or `...`), and every line between
    is YAML: a `key: value` line (at least one), an indented continuation, a list item or a
    comment. A body that opens with a horizontal rule and prose, or has a `---` rule further
    down, is not frontmatter.
    """
    lines = text.lstrip("﻿").replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i >= len(lines) or lines[i].rstrip() != "---":
        return False
    keys = 0
    for line in lines[i + 1:]:
        s = line.rstrip()
        if s in ("---", "..."):
            return keys > 0
        if not s.strip():
            continue
        if FRONTMATTER_KEY_RE.match(s):
            keys += 1
        elif not (s[0] in " \t" or s.startswith(("- ", "#"))):
            return False
    return False


def refusal(body: Body, reader: Reader | None) -> str | None:
    path = file_reference(body.text, reader)
    if path is not None:
        return file_name_refusal(body, path)
    if has_frontmatter(body.text):
        return frontmatter_refusal(body)
    return None


def file_name_refusal(body: Body, path: str) -> str:
    sent = f'{body.what} would post the text "@{path}", not the file'
    if body.how == "gh-body":
        fix = (f"-b/--body sends its value as it is; gh reads a file only for -F/--body-file. "
               f"Use `{body.what} … --body-file {path}`.")
    elif body.how == "api-raw":
        fix = ("-f/--raw-field sends its value as it is; only -F/--field reads a file from @<path>. "
               f"Use `gh api … -F body=@{path}`.")
    elif body.how == "mcp":
        fix = "The tool posts the body as it is and reads no file. Pass the file's text in body."
    else:
        fix = f"Put the file's text in the body, or use `gh api … -F body=@{path}`."
    return f"GITHUB BODY IS A FILE NAME: {sent}. {fix}"


def frontmatter_refusal(body: Body) -> str:
    src = body.source if body.source not in ("", "-") else "<file>"
    return (f"GITHUB BODY STARTS WITH YAML FRONTMATTER: {body.what} would post the `---` … `---` block at "
            f"the top of the body, and GitHub shows it as text. Strip the frontmatter first, e.g. "
            f"`awk 'NR==1 && /^---$/ {{f=1; next}} f && /^---$/ {{f=0; next}} !f' {src} > /tmp/body.md`, "
            f"then post with `--body-file /tmp/body.md` (gh issue|pr) or `gh api … -F body=@/tmp/body.md`.")


# ── finding the bodies ─────────────────────────────────────────────────────────

def readable(read) -> str | None:
    """What `read()` returns, or None when the text cannot be read here (the body then passes)."""
    try:
        text = read()
    except (pd.Unreadable, OSError):
        return None
    return text if isinstance(text, str) else None


def collect(found: list[Body], what: str, how: str, read, source: str = "") -> None:
    text = readable(read)
    if text is not None:
        found.append(Body(what, how, text, source))


def gh_verb_bodies(reader: Reader, si: int, noun: str, verb: str, args: list[str]) -> list[Body]:
    with_value = COMMENT_FLAGS_WITH_VALUE if verb in ("comment", "review") else pd.PR_FLAGS_WITH_VALUE
    flags, _ = pd.parse_flags(args, with_value)
    what = f"gh {noun} {verb}"
    found: list[Body] = []
    for name, val in flags:
        v = val or ""
        if name in ("-b", "--body"):
            collect(found, what, "gh-body", lambda v=v: reader.text(v))
        elif name in ("-F", "--body-file"):
            collect(found, what, "body-file", lambda v=v: reader.file(v, reader.segs, si), v)
    return found


def payload_bodies(found: list[Body], what: str, data: object, source: str) -> None:
    """The body and every comments[].body of a JSON payload."""
    if not isinstance(data, dict):
        return
    if isinstance(data.get("body"), str):
        found.append(Body(what, "api-input", data["body"], source))
    comments = data.get("comments")
    if isinstance(comments, list):
        for c in comments:
            if isinstance(c, dict) and isinstance(c.get("body"), str):
                found.append(Body(what, "api-input", c["body"], source))


def is_body_key(key: str) -> bool:
    return key == "body" or key.endswith("[body]")


def gh_api_bodies(reader: Reader, si: int, args: list[str]) -> list[Body]:
    flags, pos = pd.parse_flags(args, pd.API_FLAGS_WITH_VALUE)
    if not pos:
        return []
    endpoint = reader.resolve(pos[0]).split("?")[0]
    if not BODY_ENDPOINT_RE.search(endpoint):
        return []
    methods = [v for n, v in flags if n in ("-X", "--method") and v]
    if methods and methods[-1].upper() == "GET":
        return []
    what = "gh api …/" + endpoint.split("/", 3)[-1] if endpoint.startswith("repos/") else f"gh api {endpoint}"
    found: list[Body] = []
    for name, val in flags:
        if val is None:
            continue
        if name == "--input":
            raw = readable(lambda v=val: reader.file(v, reader.segs, si))
            try:
                data = json.loads(raw) if raw is not None else None
            except ValueError:
                data = None
            payload_bodies(found, what, data, "" if val == "-" else val)
            continue
        key, _, v = val.partition("=")
        if not is_body_key(key):
            continue
        if name in ("-f", "--raw-field"):
            collect(found, what, "api-raw", lambda v=v: reader.text(v))
        elif name in ("-F", "--field"):
            if v.startswith("@"):
                collect(found, what, "api-field", lambda v=v: reader.file(v[1:], reader.segs, si), v[1:])
            else:
                collect(found, what, "api-field", lambda v=v: reader.text(v))
    return found


def bash_bodies(reader: Reader) -> list[Body]:
    found: list[Body] = []
    for si, (_sep, seg) in enumerate(reader.segs):
        gi = pd.command_word(seg)
        if gi is None or (seg[gi] != "gh" and not seg[gi].endswith("/gh")):
            continue
        rest = [t for t in seg[gi + 1:] if not pd.PLACEHOLDER_RE.fullmatch(t)]
        if len(rest) >= 2 and rest[1] in GH_BODY_VERBS.get(rest[0], ()):
            found.extend(gh_verb_bodies(reader, si, rest[0], rest[1], rest[2:]))
        elif rest and rest[0] == "api":
            found.extend(gh_api_bodies(reader, si, rest[1:]))
    return found


def mcp_bodies(tool: str, tool_input: dict) -> list[Body]:
    found: list[Body] = []
    payload_bodies(found, tool.replace("mcp__github__", "github "), tool_input, "")
    for b in found:
        b.how = "mcp"
    return found


# ── entry point ────────────────────────────────────────────────────────────────

def decide(hook: dict) -> str | None:
    tool = str(hook.get("tool_name") or "")
    tool_input = hook.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return None
    if tool.startswith("mcp__github__"):
        for body in mcp_bodies(tool, tool_input):
            reason = refusal(body, None)
            if reason:
                return reason
        return None
    if tool != "Bash":
        return None
    cmd = tool_input.get("command") or ""
    if isinstance(cmd, list):
        cmd = cmd[2] if len(cmd) >= 3 and cmd[1] in ("-c", "-lc") else " ".join(str(c) for c in cmd)
    try:
        reader = Reader(str(cmd), str(hook.get("cwd") or ""))
        found = bash_bodies(reader)
    except ValueError:
        # shlex could not split the command (e.g. unbalanced quotes): the shell would reject it too.
        return None
    for body in found:
        reason = refusal(body, reader)
        if reason:
            return reason
    return None


def main() -> int:
    if os.environ.get("GITHUB_COMMENT_BODY_GATE", "1") == "0":
        return 0
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        return 0
    reason = decide(hook if isinstance(hook, dict) else {})
    if reason:
        print(reason, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
