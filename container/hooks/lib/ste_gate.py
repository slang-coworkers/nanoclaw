"""Simple-Technical-English check behind gate-ste-writing.sh (run as `python3 ste_gate.py`).

Text that other people read follows the `slang-ste-writing` skill: short
sentences, one topic per paragraph, no unapproved words. The skill ships the
checker, `scripts/ste_check.py`; this gate finds it and runs it on every
external-facing text the tool call would post:

- Bash: `gh pr create|edit|comment|review`, `gh issue create|edit|comment`, and
  `gh api` to PR, issue, comment and review endpoints (bodies read with
  pr_description.py: inline, heredoc, `$(cat FILE)`, `--body-file`, `-F body=@`).
- GitHub MCP write tools (`mcp__github__*` that create or update an issue, a PR,
  a comment or a review): the `body` / `comment` fields.
- Chat: `mcp__slang-mcp__discord_send_message` (`content`) and the Slack post and
  reply tools (`text`). A chat post is also refused outright when it is a numbered
  part of a split message: one post per topic, the rest in its thread
  (`thread_name` on the anchor, then the returned `thread_id`).

Reads the PreToolUse hook JSON on stdin. Exit 0 = allow (no checker installed in
this group, nothing to check, or no findings). Exit 2 = deny, with one line on
stderr listing up to three findings and the skill to apply. STE_WRITING_GATE=0
disables; STE_CHECK=<path> points at a checker outside the default locations.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import shlex
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pr_description import Reader, Unreadable, bodies

CHECKER_CANDIDATES = (
    os.environ.get("STE_CHECK", ""),
    os.path.expanduser("~/.claude/skills/slang-ste-writing/scripts/ste_check.py"),
    "/home/node/.claude/skills/slang-ste-writing/scripts/ste_check.py",
    "/app/skills/slang-ste-writing/scripts/ste_check.py",
)
MAX_SHOWN = 3
# Chat tools and the field that carries the post.
CHAT_TOOLS = {
    "mcp__slang-mcp__discord_send_message": "content",
    "mcp__slang-mcp__slack_post_message": "text",
    "mcp__slang-mcp__slack_reply_to_thread": "text",
}
# GitHub MCP tools that post text other people read.
GITHUB_WRITE_TOOL_RE = re.compile(
    r"^mcp__github__(create_issue|update_issue|add_issue_comment|create_pull_request|update_pull_request|"
    r"create_pending_pull_request_review|add_comment_to_pending_review|submit_pending_pull_request_review|"
    r"create_and_submit_pull_request_review|add_pull_request_review_comment\w*)$"
)
GITHUB_TEXT_FIELDS = ("body", "comment")
BASH_KINDS = ("pr", "issue", "comment", "api-comment")
# "(part 2/5)", "part 1 of 3", "[2/4]" at the start of a message, or "(part k/N)" anywhere.
NUMBERED_PART_RE = re.compile(
    r"^\s*(?:\(?\s*part\s+\d+\s*(?:/|of)\s*\d+\s*\)?|\[\s*\d+\s*/\s*\d+\s*\])|\(\s*part\s+\d+\s*/\s*\d+\s*\)",
    re.IGNORECASE,
)


def load_checker():
    """Return the installed skill's `check_text`, or None when the skill is not in this group."""
    for path in CHECKER_CANDIDATES:
        if path and os.path.isfile(path):
            spec = importlib.util.spec_from_file_location("ste_check", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore[union-attr]
            return getattr(mod, "check_text", None)
    return None


def check_texts(texts: list[tuple[str, str]]) -> int:
    """Run the installed checker over (what, text) pairs; refuse the first with findings."""
    check_text = load_checker()
    if check_text is None:
        return 0
    for what, text in texts:
        findings = check_text(text)
        if findings:
            shown = "; ".join(f"line {n}: {msg}" for n, msg in findings[:MAX_SHOWN])
            more = f" (+{len(findings) - MAX_SHOWN} more)" if len(findings) > MAX_SHOWN else ""
            print(
                f"WRITING CHECK for {what}: {shown}{more} — rewrite per the slang-ste-writing skill "
                "(short sentences, one topic per paragraph, approved words), then retry.",
                file=sys.stderr,
            )
            return 2
    return 0


def check_chat_post(content: str) -> int:
    """Refuse a numbered part of a split post, then apply the writing checker if installed."""
    if NUMBERED_PART_RE.search(content):
        print(
            "CHAT POST REFUSED: this is a numbered part of a split message. Post one message per "
            "topic; put the rest in its thread (pass thread_name on the anchor message, then send "
            "follow-ups to the returned thread_id). Never prefix parts with (part k/N).",
            file=sys.stderr,
        )
        return 2
    return check_texts([("the chat post", content)])


def main() -> int:
    if os.environ.get("STE_WRITING_GATE", "1") == "0":
        return 0
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        return 0
    tool = str(hook.get("tool_name") or "")
    tool_input = hook.get("tool_input") or {}
    if tool in CHAT_TOOLS:
        return check_chat_post(str(tool_input.get(CHAT_TOOLS[tool]) or ""))
    if GITHUB_WRITE_TOOL_RE.match(tool):
        return check_texts([(tool.replace("mcp__github__", "github "), str(tool_input.get(f)))
                            for f in GITHUB_TEXT_FIELDS if isinstance(tool_input.get(f), str) and tool_input.get(f).strip()])
    if tool != "Bash":
        return 0
    cmd = tool_input.get("command") or ""
    if isinstance(cmd, list):
        cmd = cmd[2] if len(cmd) >= 3 and cmd[1] in ("-c", "-lc") else shlex.join(str(c) for c in cmd)
    if load_checker() is None:
        return 0
    try:
        found = bodies(Reader(str(cmd), str(hook.get("cwd") or "")), kinds=BASH_KINDS)
    except (Unreadable, ValueError):
        # The description gate already refuses unreadable PR text; other text we cannot read is let through.
        return 0
    return check_texts(found)


if __name__ == "__main__":
    sys.exit(main())
