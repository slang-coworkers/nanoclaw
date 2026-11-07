"""Classification for gate-issue-optout.sh: does this tool call write to GitHub about an
issue that people have opted out of?

Input (stdin): the Claude Code PreToolUse JSON ({tool_name, tool_input, cwd}). The opt-out
list is the JSON the host writes (ISSUE_OPT_OUT_LIST): {"issues": {"owner/repo": [{"number":
N, "label": "no-bot"}, ...]}}.

A call is refused when both hold:
  1. it writes to GitHub — the same shapes eval_sandbox.py recognises (a mutating `gh`
     verb, `gh api` with a non-GET method or body fields, `git push`, a mutating HTTP call
     to api.github.com, GraphQL) or a GitHub MCP tool that is not a read;
  2. it names an opted-out issue: `#N`, `issues/N`, `issue-N`, `issue N` (or a branch
     such as `fix/issue-N`) for a repository the call names, or for any opted-out
     repository when the call names none (a checkout's default remote is unknown here, so
     the number alone decides).
Reads, writes that name no opted-out issue, and calls on other repositories pass.
Exit 0 passes the call; exit 2 refuses it with the reason on stderr."""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import eval_sandbox as es  # the GitHub-write shapes are shared with the eval sandbox gate

DEFAULT_LIST = "/workspace/agent/.issue-opt-outs.json"

READ_MCP_SUFFIXES = ("get_", "list_", "search_", "read_")
REPO_FLAG_RE = re.compile(r"(?:^|\s)(?:-R|--repo)[=\s]+['\"]?(?:https?://github\.com/)?([\w.-]+/[\w.-]+?)(?:\.git)?['\"]?(?=\s|$)")
REPO_URL_RE = re.compile(r"github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git)?(?=[/\s'\"#?]|$)", re.IGNORECASE)
API_REPO_RE = re.compile(r"repos/([\w.-]+)/([\w.-]+)(?=[/?\s'\"]|$)", re.IGNORECASE)


def load_list(path: str) -> dict:
    """{repo: {number: label}} from the host's list file; empty when the file is missing or malformed."""
    try:
        with open(path, encoding="utf-8") as fh:
            doc = json.load(fh)
    except (OSError, ValueError):
        return {}
    out: dict = {}
    for repo, rows in (doc.get("issues") or {}).items():
        for row in rows or []:
            try:
                out.setdefault(repo.lower(), {})[int(row["number"])] = str(row.get("label") or "")
            except (KeyError, TypeError, ValueError):
                continue
    return out


def issue_reference_re(number: int) -> re.Pattern:
    """Mentions of issue `number`: #N, issues/N, issue-N, issue_N, issue N."""
    return re.compile(rf"(?<![\w/])#{number}(?!\d)|\bissues?[/\s_-]+{number}(?!\d)", re.IGNORECASE)


def repos_named(text: str) -> set:
    """Repositories a command names explicitly (-R/--repo, a github.com URL, a repos/ API path)."""
    found = set()
    for m in REPO_FLAG_RE.finditer(text):
        found.add(m.group(1).lower())
    for m in REPO_URL_RE.finditer(text):
        found.add(f"{m.group(1)}/{m.group(2)}".lower())
    for m in API_REPO_RE.finditer(text):
        found.add(f"{m.group(1)}/{m.group(2)}".lower())
    return found


GH_NUMBERED_RESOURCES = {"issue", "pr"}


def gh_target_numbers(text: str) -> set:
    """Issue or PR numbers a `gh issue <verb> N` / `gh pr <verb> N` segment addresses: the
    bare-number positionals after the verb, and the number of a .../issues/N or /pull/N URL
    given instead. `gh issue comment 123` names 123 without writing "#123" anywhere."""
    found = set()
    for segment in es.split_segments(text):
        tokens = es.strip_env_prefix(es.tokens_of(segment))
        if len(tokens) < 3 or os.path.basename(tokens[0]) != "gh" or tokens[1] not in GH_NUMBERED_RESOURCES:
            continue
        for tok in tokens[3:]:
            if tok.isdigit():
                found.add(int(tok))
            else:
                m = re.search(r"/(?:issues|pull)/(\d+)(?:[/?#]|$)", tok)
                if m:
                    found.add(int(m.group(1)))
    return found


def opted_out_issue_in(text: str, opted: dict):
    """(repo, number, label) of the first opted-out issue `text` refers to, else None."""
    named = repos_named(text)
    targets = gh_target_numbers(text)
    for repo, issues in opted.items():
        if named and repo not in named:
            continue
        for number, label in issues.items():
            if number in targets or issue_reference_re(number).search(text):
                return repo, number, label
    return None


def github_write_reason(command: str, cwd: str | None) -> str | None:
    """Why `command` writes to GitHub, or None when it only reads. With an empty allow-list
    every GitHub write is "outside the allowed repositories" for eval_sandbox.classify, so its
    reason doubles as the write detector here."""
    return es.classify(command, frozenset(), es.git_remote_resolver(cwd))


def classify(tool_name: str, tool_input: dict, cwd: str | None, opted: dict):
    """Refusal reason for the call, or None when it passes."""
    if not opted:
        return None
    if tool_name == "Bash":
        command = str(tool_input.get("command") or "")
        if not command:
            return None
        hit = opted_out_issue_in(command, opted)
        if hit is None:
            return None
        if github_write_reason(command, cwd) is None:
            return None
        repo, number, label = hit
        return f"{repo}#{number} ({label})"
    if tool_name.startswith("mcp__"):
        short = tool_name.split("__", 2)[-1].lower()
        if short.startswith(READ_MCP_SUFFIXES):
            return None
        text = json.dumps(tool_input, sort_keys=True)
        repo_field = ""
        owner, name = tool_input.get("owner"), tool_input.get("repo")
        if isinstance(owner, str) and isinstance(name, str):
            repo_field = f"{owner}/{name}".lower()
        elif isinstance(name, str) and "/" in name:
            repo_field = name.lower()
        for repo, issues in opted.items():
            if repo_field and repo_field != repo:
                continue
            for key in ("issue_number", "pull_number", "number"):
                val = tool_input.get(key)
                if isinstance(val, int) and val in issues:
                    return f"{repo}#{val} ({issues[val]})"
            for number, label in issues.items():
                if issue_reference_re(number).search(text):
                    return f"{repo}#{number} ({label})"
        return None
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return 0
    tool_name = str(payload.get("tool_name") or "")
    tool_input = payload.get("tool_input") if isinstance(payload.get("tool_input"), dict) else {}
    cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) else None
    opted = load_list(os.environ.get("ISSUE_OPT_OUT_LIST") or DEFAULT_LIST)
    reason = classify(tool_name, tool_input, cwd, opted)
    if reason is None:
        return 0
    sys.stderr.write(
        f"ISSUE OPT-OUT: refused — {reason}. People have opted this issue out (a newcomer label or a comment "
        "telling the bot to stop), so the bot does not comment on it, push a branch or open a pull request "
        "for it, or edit it. Reads stay allowed. If the label is removed the issue comes back to the bot by "
        "itself; do not try another route.\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
