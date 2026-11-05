"""Review-length cap behind gate-review-length.sh (run as `python3 review_length.py`).

A posted review stays under REVIEW_LENGTH_CAP_CHARS characters of review text (default 4000):
the summary or body plus every inline comment. A length sentence in the prompt does not change
how much a reviewer writes; a refusal at posting time does, so the cap is enforced here, on the
call that would post or write the review.

Reads the PreToolUse hook JSON on stdin and measures the review text of the call:

  Bash            `gh pr review` and `gh pr comment` (-b/--body, -F/--body-file);
                  `gh api …/pulls/N/reviews[/ID[/events]]` (--input JSON: body plus comments[].body,
                  or -f body=…), `gh api …/pulls/N/comments` and `…/issues/N/comments` (body);
                  a write of an evaluation answer file `…/answer.json` by heredoc, tee, echo or
                  printf — the file an evaluation copy delivers instead of posting, shaped
                  {"summary": …, "findings": [{"comment": …}, …]}.
  Write           an `answer.json` of that shape: summary plus every finding's comment.
  Edit, MultiEdit the same file, measured after the edit is applied to its current content.
  mcp__github__*  the pending-review flow: create_pending_pull_request_review (body),
                  add_comment_to_pending_review (body), submit_pending_pull_request_review (body).
                  One review spreads over several calls, so a running total per pull request is
                  kept in REVIEW_LENGTH_STATE_DIR/.review-length-state.json and the call that would
                  take the total past the cap is the one refused; delete_pending_pull_request_review
                  resets it. create_and_submit_pull_request_review (body plus comments) and
                  add_issue_comment (body) are single posts.

Command parsing (heredocs, $(cat …), --body-file, files this same command writes) is shared with
the PR description gate: this module imports pr_description.py from the same directory.

Exit 0 = allow (nothing to measure, or within the cap). Exit 2 = deny, with one line on stderr
giving the count, the cap and what to do. Text that cannot be read here (built by the shell at
run time, piped from another program) is allowed: the gate caps what it can measure, it never
guesses.
"""

from __future__ import annotations

import glob
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pr_description as pd  # command parsing shared with the description gate

CAP_DEFAULT = 4000
STATE_FILE = ".review-length-state.json"
STATE_MAX_AGE_SEC = 12 * 3600

REVIEW_FLAGS_WITH_VALUE = {"-b", "--body", "-F", "--body-file", "-R", "--repo"}
REVIEW_ENDPOINT_RE = re.compile(
    r"(^|/)repos/[^/]+/[^/]+/(pulls/\d+/(reviews(/\d+(/events)?)?|comments)|issues/\d+/comments)/?$"
)
ANSWER_FILE = "answer.json"
# Post-write check: where the evaluation answer files live inside the container and how
# recent a file must be to count as "written by the call that just ran".
ANSWER_ROOT_DEFAULT = "/workspace/agent/eval"
POST_WINDOW_DEFAULT_SEC = 600

PENDING_CREATE = "mcp__github__create_pending_pull_request_review"
PENDING_ADD = "mcp__github__add_comment_to_pending_review"
PENDING_SUBMIT = "mcp__github__submit_pending_pull_request_review"
PENDING_DELETE = "mcp__github__delete_pending_pull_request_review"
CREATE_AND_SUBMIT = "mcp__github__create_and_submit_pull_request_review"
ISSUE_COMMENT = "mcp__github__add_issue_comment"


def cap() -> int:
    return pd.env_int("REVIEW_LENGTH_CAP_CHARS", CAP_DEFAULT)


class Measured:
    """How much review text one call carries and where it came from."""

    def __init__(self, what: str, chars: int, parts: str = ""):
        self.what, self.chars, self.parts = what, chars, parts


# ── measuring ──────────────────────────────────────────────────────────────────

def review_payload_chars(data: object) -> tuple[int, str] | None:
    """(chars, description) for a review-shaped JSON object, None when it is not one.

    Review payloads: {"body", "comments": [{"body"}]} (GitHub API) and
    {"summary", "findings": [{"comment"}]} (evaluation answer). An answer that only
    reports an error ({"error": …}) is not a review.
    """
    if not isinstance(data, dict):
        return None
    main = data.get("summary") if "summary" in data else data.get("body")
    items = data.get("findings") if "findings" in data else data.get("comments")
    if main is None and items is None:
        return None
    total = len(main) if isinstance(main, str) else 0
    count = 0
    if isinstance(items, list):
        for it in items:
            if isinstance(it, dict):
                text = it.get("comment") if "comment" in it else it.get("body")
                if isinstance(text, str):
                    total += len(text)
                    count += 1
            elif isinstance(it, str):
                total += len(it)
                count += 1
    label = "summary" if "summary" in data else "body"
    noun = "finding" if "findings" in data else "comment"
    return total, f"{label} plus {count} {noun}{'' if count == 1 else 's'}"


def answer_json_chars(text: str) -> tuple[int, str] | None:
    try:
        data = json.loads(text)
    except ValueError:
        return None
    return review_payload_chars(data)


def is_answer_path(path: str) -> bool:
    return os.path.basename(path.strip().strip("'\"")) == ANSWER_FILE


def recent_answer_files(root: str, window_sec: float, now: float | None = None) -> list[str]:
    """Answer files under `root` (eval/<task>/r<k>/answer.json, or one level up) written
    inside the last `window_sec` seconds, oldest first."""
    now = time.time() if now is None else now
    found = []
    for pattern in (os.path.join(root, "*", "*", ANSWER_FILE), os.path.join(root, "*", ANSWER_FILE)):
        for path in glob.glob(pattern):
            try:
                mtime = os.path.getmtime(path)
            except OSError:
                continue
            if now - mtime <= window_sec:
                found.append((mtime, path))
    return [p for _, p in sorted(found)]


def post_decide(hook: dict, root: str | None = None, window_sec: float | None = None,
                now: float | None = None) -> str | None:
    """The post-write check: after a Bash, Write, Edit or MultiEdit call, measure every
    answer file written in the last few minutes, whatever wrote it. The pre-write check
    sees the text a tool call carries; a script the agent writes and runs carries none,
    so its output is measured here instead. An answer over the cap is moved aside
    (`answer.json.too-long-<epoch>`) so the runner cannot score it, and the agent is told
    to write a shorter one."""
    tool = str(hook.get("tool_name") or "")
    if tool not in ("Bash", "Write", "Edit", "MultiEdit"):
        return None
    root = root or os.environ.get("REVIEW_LENGTH_ANSWER_ROOT") or ANSWER_ROOT_DEFAULT
    window = window_sec if window_sec is not None else pd.env_int("REVIEW_LENGTH_POST_WINDOW_SEC", POST_WINDOW_DEFAULT_SEC)
    now = time.time() if now is None else now
    limit = cap()
    candidates = recent_answer_files(root, window, now)
    tool_input = hook.get("tool_input") if isinstance(hook.get("tool_input"), dict) else {}
    named = str(tool_input.get("file_path") or "")
    if is_answer_path(named) and os.path.isfile(named) and named not in candidates:
        candidates.append(named)
    for path in candidates:
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                r = answer_json_chars(fh.read())
        except OSError:
            continue
        if r is None or r[0] <= limit:
            continue
        aside = f"{path}.too-long-{int(now)}"
        try:
            os.replace(path, aside)
            moved = f" The file was moved to {os.path.basename(aside)}; write a shorter {ANSWER_FILE} in its place."
        except OSError:
            moved = ""
        return (over(f"the answer file {ANSWER_FILE}", r[0], r[1], limit) or "") + moved
    return None


def bash_measurements(reader: pd.Reader) -> list[Measured]:
    found: list[Measured] = []
    segs = pd.segments(pd.tokenize(reader.cmd))
    for si, (_sep, seg) in enumerate(segs):
        gi = pd.command_word(seg)
        if gi is None:
            continue
        word = seg[gi]
        rest = [t for t in seg[gi + 1:] if not pd.PLACEHOLDER_RE.fullmatch(t)]
        if word == "gh" or word.endswith("/gh"):
            if len(rest) >= 2 and rest[0] == "pr" and rest[1] in ("review", "comment"):
                body = gh_body(reader, segs, si, rest[2:])
                if body is not None:
                    found.append(Measured(f"gh pr {rest[1]}", len(body)))
            elif rest and rest[0] == "api":
                m = gh_api_review(reader, segs, si, rest[1:])
                if m is not None:
                    found.append(m)
        elif word in ("echo", "printf"):
            m = echo_answer(seg[gi + 1:], reader)
            if m is not None:
                found.append(m)
        elif word == "tee":
            # `cat <<EOF | tee …/answer.json`: the heredoc sits on the cat segment.
            targets = [t for t in rest if not t.startswith("-")]
            if any(is_answer_path(t) for t in targets):
                r = answer_json_chars(reader.stdin(segs, si))
                if r is not None:
                    found.append(Measured(f"the answer file {ANSWER_FILE}", r[0], r[1]))
    # `cat > …/answer.json <<EOF` and `tee …/answer.json <<EOF`: the Reader already paired the
    # heredoc with its target path.
    for path, text in reader.written.items():
        if is_answer_path(path):
            r = answer_json_chars(text)
            if r is not None:
                found.append(Measured(f"the answer file {os.path.basename(path)}", r[0], r[1]))
    return found


def gh_body(reader: pd.Reader, segs: list, si: int, args: list[str]) -> str | None:
    flags, _ = pd.parse_flags(args, REVIEW_FLAGS_WITH_VALUE)
    body = None
    for name, val in flags:
        if name in ("-b", "--body"):
            body = reader.text(val or "")
        elif name in ("-F", "--body-file"):
            body = reader.file(val or "", segs, si)
    return body


def gh_api_review(reader: pd.Reader, segs: list, si: int, args: list[str]) -> Measured | None:
    flags, pos = pd.parse_flags(args, pd.API_FLAGS_WITH_VALUE)
    endpoint = (pos[0] if pos else "").split("?")[0]
    if not REVIEW_ENDPOINT_RE.search(endpoint):
        return None
    what = "gh api …/reviews" if "/reviews" in endpoint else ("gh api …/pulls/N/comments" if "/pulls/" in endpoint else "gh api …/issues/N/comments")
    body: str | None = None
    for name, val in flags:
        if name == "--input":
            raw = reader.file(val or "", segs, si)
            try:
                data = json.loads(raw)
            except ValueError:
                return None
            r = review_payload_chars(data)
            return Measured(what, r[0], r[1]) if r is not None else None
        if name in ("-f", "--raw-field", "-F", "--field") and val is not None:
            key, _, v = val.partition("=")
            if key == "body":
                body = reader.file(v[1:], segs, si) if name in ("-F", "--field") and v.startswith("@") else reader.text(v)
    return Measured(what, len(body)) if body is not None else None


def echo_answer(args: list[str], reader: pd.Reader) -> Measured | None:
    """`echo '<json>' > …/answer.json` / `printf '%s' '<json>' > …/answer.json`."""
    target = None
    words: list[str] = []
    i = 0
    while i < len(args):
        a = args[i]
        if a in (">", ">>") and i + 1 < len(args):
            target = args[i + 1]
            i += 2
            continue
        if a.startswith((">", ">>")) and len(a) > 1 and a.lstrip(">"):
            target = a.lstrip(">")
            i += 1
            continue
        if not (a.startswith("-") and len(a) <= 3):
            words.append(a)
        i += 1
    if target is None or not is_answer_path(target):
        return None
    text = " ".join(words)
    if pd.PLACEHOLDER_RE.search(text) or (("$" in text or "`" in text) and not reader.literal_in_single_quotes(text)):
        return None
    r = answer_json_chars(text)
    return Measured(f"the answer file {ANSWER_FILE}", r[0], r[1]) if r is not None else None


def write_measurement(tool: str, tool_input: dict) -> Measured | None:
    path = str(tool_input.get("file_path") or "")
    if not is_answer_path(path):
        return None
    if tool == "Write":
        content = tool_input.get("content")
        if not isinstance(content, str):
            return None
    else:
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                content = fh.read()
        except OSError:
            return None
        edits = tool_input.get("edits") if tool == "MultiEdit" else [tool_input]
        for e in edits or []:
            if not isinstance(e, dict):
                continue
            old, new = str(e.get("old_string") or ""), str(e.get("new_string") or "")
            if not old:
                continue
            content = content.replace(old, new) if e.get("replace_all") else content.replace(old, new, 1)
    r = answer_json_chars(content)
    return Measured(f"the answer file {ANSWER_FILE}", r[0], r[1]) if r is not None else None


# ── the pending-review running total ───────────────────────────────────────────

def state_path() -> str:
    return os.path.join(os.environ.get("REVIEW_LENGTH_STATE_DIR") or "/workspace/agent", STATE_FILE)


def load_state() -> dict:
    try:
        with open(state_path(), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    now = time.time()
    return {k: v for k, v in data.items() if isinstance(v, dict) and now - float(v.get("updated", 0)) < STATE_MAX_AGE_SEC}


def save_state(state: dict) -> None:
    try:
        tmp = state_path() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(state, fh)
        os.replace(tmp, state_path())
    except OSError:
        pass


def pr_key(tool_input: dict) -> str:
    owner, repo = tool_input.get("owner"), tool_input.get("repo")
    number = tool_input.get("pullNumber") or tool_input.get("pull_number") or tool_input.get("issue_number") or "?"
    return f"{owner}/{repo}#{number}" if owner and repo else f"#{number}"


def text_of(value: object) -> int:
    return len(value) if isinstance(value, str) else 0


def mcp_decision(tool: str, tool_input: dict, limit: int) -> str | None:
    """Deny reason for a GitHub MCP review call, or None to allow (state is updated on allow)."""
    body = text_of(tool_input.get("body"))
    if tool == CREATE_AND_SUBMIT:
        r = review_payload_chars(tool_input) or (body, "body")
        return over(f"{short(tool)} on {pr_key(tool_input)}", r[0], r[1], limit)
    if tool == ISSUE_COMMENT:
        return over(f"{short(tool)} on {pr_key(tool_input)}", body, "body", limit)
    if tool not in (PENDING_CREATE, PENDING_ADD, PENDING_SUBMIT, PENDING_DELETE):
        return None
    state = load_state()
    key = pr_key(tool_input)
    if tool == PENDING_DELETE:
        state.pop(key, None)
        save_state(state)
        return None
    running = int(state.get(key, {}).get("total", 0)) if tool != PENDING_CREATE else 0
    total = running + body
    if total > limit:
        if tool == PENDING_CREATE:
            return over(f"{short(tool)} on {key}", total, "body", limit)
        return (f"REVIEW TOO LONG: this {('comment' if tool == PENDING_ADD else 'submit body')} would bring the pending "
                f"review on {key} to {total:,} characters of review text; the cap is {limit:,}. Keep the summary and the "
                f"findings with the highest value, drop the rest, and post one review, not several.")
    if tool == PENDING_SUBMIT:
        state.pop(key, None)
    else:
        state[key] = {"total": total, "updated": time.time()}
    save_state(state)
    return None


def short(tool: str) -> str:
    return tool.replace("mcp__github__", "github ")


def over(what: str, chars: int, parts: str, limit: int) -> str | None:
    if chars <= limit:
        return None
    detail = f" ({parts})" if parts else ""
    return (f"REVIEW TOO LONG: {what} carries {chars:,} characters of review text{detail}; the cap is {limit:,}. "
            f"Keep the summary and the findings with the highest value, drop the rest, and post one review, not several.")


# ── entry point ────────────────────────────────────────────────────────────────

def decide(hook: dict) -> str | None:
    tool = str(hook.get("tool_name") or "")
    tool_input = hook.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return None
    limit = cap()
    if tool.startswith("mcp__github__"):
        return mcp_decision(tool, tool_input, limit)
    if tool in ("Write", "Edit", "MultiEdit"):
        m = write_measurement(tool, tool_input)
        return over(m.what, m.chars, m.parts, limit) if m else None
    if tool != "Bash":
        return None
    cmd = tool_input.get("command") or ""
    if isinstance(cmd, list):
        cmd = cmd[2] if len(cmd) >= 3 and cmd[1] in ("-c", "-lc") else " ".join(str(c) for c in cmd)
    try:
        found = bash_measurements(pd.Reader(str(cmd), str(hook.get("cwd") or "")))
    except (pd.Unreadable, ValueError):
        return None
    for m in found:
        reason = over(m.what, m.chars, m.parts, limit)
        if reason:
            return reason
    return None


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if os.environ.get("REVIEW_LENGTH_GATE", "1") == "0":
        return 0
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        return 0
    hook = hook if isinstance(hook, dict) else {}
    reason = post_decide(hook) if "--post" in argv else decide(hook)
    if reason:
        print(reason, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
