#!/usr/bin/env python3
"""Keep ONE PR comment as the explanation of the PR's current head.

The explanation (GitHub-safe Markdown written by /explain-diff-html) lives in a
single PR comment, marked with COMMENT_MARKER, edited in place on every push. The
PR description stays the author's own concise text (what changed, why, how it was
tested, issue links): squash merges copy the description into git log, so it must
not carry the explanation.

Which comments are ours. A comment is a candidate only when it STARTS with an exact
marker for this repo#pr (the current `:comment` marker, or the
`<!-- explain-diff-html <ref> -->` marker of earlier versions). It is ours only when
its author is an identity this coworker has proven it writes as:
  - the login `gh api user` reports (personal access tokens);
  - a login recorded in ACTORS_FILE, which this script appends to whenever GitHub
    answers one of its own comment POSTs (an App token cannot call /user, so this is
    how its `<app>[bot]` login is learned);
  - a login named in EXPLAIN_DIFF_ACTOR (comma-separated): explicit adoption, for
    an identity this coworker writes as but has not yet recorded. Use it only for
    your own identity.
Never the PR's author, never "any bot". If a candidate comment exists that is NOT
ours, nothing is written and the run exits 5: someone else's comment carries our
marker, and only a human or an explicit adoption can resolve it.

What a run does:
  - updates the oldest of our comments in place, or creates one when there is no
    candidate at all. Our other candidate comments become a one-line pointer to it.
  - re-reads the comments and succeeds only when exactly one of ours carries the
    current marker, the explained head and the requested body; and re-reads the PR
    head and refuses (exit 4) if it moved during the run.
  - removes the explanation block an earlier version wrote into the description,
    only when it is exactly that block: the start marker for this PR as the very
    first line, and exactly one end-marker line. Anything else is left unchanged
    with a NOTE. A description shorter than SHORT_BODY characters also gets a NOTE,
    and so does one over the description limits (see description_problems).
  - prints the receipt line (RECEIPT_PREFIX + JSON) as the last stdout line, only
    after every write succeeded. Any failed write exits 5 without it.

Comment order: GitHub lists comments by creation time and cannot reorder them. The
explanation sits directly after the description when it is the PR's first comment
(run this right after `gh pr create`); otherwise our oldest comment keeps its place.

Head check: the caller passes the commit the explanation was written from
(`git -C <worktree> rev-parse HEAD`). If the PR's live head is a different
commit, the explanation is stale (or the push has not landed) and nothing is
written.

Usage:
  upsert_pr_body.py --repo OWNER/REPO --pr N --head SHA --explanation FILE [--dry-run]
  upsert_pr_body.py --quiz-positions --head SHA [--questions 5] [--options 4]

Exit codes: 0 written (or dry-run printed), 2 usage, 3 over the size limit,
4 head mismatch (before or after writing), 5 gh failure, a comment carrying our
marker that is not ours, or the comments did not converge to one.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

COMMENT_MARKER = "<!-- explain-diff-html:comment {ref} head={sha} -->"
POINTER_MARKER = "<!-- explain-diff-html:pointer {ref} -->"
_REF = r"([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#(\d+)"
CURRENT_RE = re.compile(r"<!-- explain-diff-html:comment " + _REF + r" head=([0-9a-f]{7,40}) -->(?:\r?\n|$)")
LEGACY_RE = re.compile(r"<!-- explain-diff-html " + _REF + r" -->(?:\r?\n|$)")
# The block the previous version wrote into the description: its start line is the
# very first line (no indentation), and it closes with one end-marker line.
START_LINE_RE = re.compile(r"<!-- explain-diff-html:start " + _REF + r" head=[0-9a-f]{7,40} -->\r?\n")
START_ANY = "<!-- explain-diff-html:start "
END = "<!-- explain-diff-html:end -->"
RECEIPT_PREFIX = "EXPLAIN_DIFF_RECEIPT "
MAX_COMMENT = 60_000  # GitHub rejects comment bodies over 65,536 characters.
SHORT_BODY = 200

# Description limits: the same rules and env knobs as the PreToolUse gate
# (container/hooks/lib/pr_description.py); keep the two in step. Squash merges copy
# the description into git log, so each section (a line starting with a bold label
# or a `## Heading`) holds at most 2 non-empty lines, the whole description at most
# 1,000 characters, and no table. The `<sub>` disclaimer and `Fixes #N` lines are
# not counted.
_DISCLAIMER_RE = re.compile(r"^\s*<sub>.*</sub>\s*$", re.IGNORECASE)
_CLOSING_RE = re.compile(r"^\s*(fix(es|ed)?|close[sd]?|resolve[sd]?)\b.*(#\d+|/issues/\d+)", re.IGNORECASE)
_BOLD_LABEL_RE = re.compile(r"^\s*(\*\*|__)\s*(?P<label>[^*_\n]{1,80}?)\s*[.:]?\s*\1[.:]?(\s|$)")
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(?P<label>.+?)\s*#*\s*$")
_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
_TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")


def _env_int(name: str, default: int) -> int:
    v = os.environ.get(name, "")
    return int(v) if v.isdigit() and int(v) > 0 else default


def description_limits() -> tuple[int, int]:
    return _env_int("PR_DESCRIPTION_MAX_CHARS", 1000), _env_int("PR_DESCRIPTION_MAX_SECTION_LINES", 2)


def description_problems(body: str, max_chars: int, max_lines: int) -> list[str]:
    """What in a description breaks the limits, as short phrases; empty when it is fine."""
    lines = [ln for ln in body.replace("\r\n", "\n").split("\n")
             if not _DISCLAIMER_RE.match(ln) and not _CLOSING_RE.match(ln)]
    problems: list[str] = []
    sections: list[list] = []
    for ln in lines:
        if not ln.strip():
            continue
        m = _BOLD_LABEL_RE.match(ln) or _HEADING_RE.match(ln)
        if m:
            sections.append([m.group("label").strip().rstrip(".:"), 1])
        elif sections:
            sections[-1][1] += 1
    for label, n in sections:
        if n > max_lines:
            problems.append(f"{label} has {n} lines, max {max_lines}")
    if any(_TABLE_SEP_RE.match(ln) for ln in lines) and any(_TABLE_ROW_RE.match(ln) for ln in lines):
        problems.append("it contains a table")
    total = len("\n".join(lines).strip())
    if total > max_chars:
        problems.append(f"total {total:,} chars, max {max_chars:,}")
    return problems


def actors_file() -> str:
    return os.environ.get("EXPLAIN_DIFF_ACTORS_FILE") or os.path.expanduser("~/.claude/explain-diff-actors.json")


def recorded_actors() -> set[str]:
    try:
        with open(actors_file(), encoding="utf-8") as f:
            data = json.load(f)
        return {str(x) for x in data.get("actors", []) if x}
    except (OSError, ValueError, AttributeError):
        return set()


def record_actor(login: str) -> None:
    """Remember an identity GitHub confirmed this coworker posts as. Best effort."""
    if not login:
        return
    known = recorded_actors()
    if login in known:
        return
    path = actors_file()
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.{os.getpid()}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"actors": sorted(known | {login})}, f)
        os.replace(tmp, path)
    except OSError as e:
        print(f"could not record actor {login} in {path}: {e}", file=sys.stderr)


def same_ref(m: re.Match, repo: str, pr: int) -> bool:
    return m.group(1).lower() == repo.lower() and int(m.group(2)) == pr


def marker_kind(body: str, repo: str, pr: int) -> str | None:
    """'current' / 'legacy' when the body STARTS with our marker for this exact repo#pr."""
    m = CURRENT_RE.match(body or "")
    if m and same_ref(m, repo, pr):
        return "current"
    m = LEGACY_RE.match(body or "")
    if m and same_ref(m, repo, pr):
        return "legacy"
    return None


def marker_head(body: str) -> str:
    m = CURRENT_RE.match(body or "")
    return m.group(3) if m else ""


def split_candidates(comments: list[dict], repo: str, pr: int, trusted: set[str]) -> tuple[list[dict], list[dict]]:
    """(ours, foreign) among the comments carrying our marker for this PR, oldest first."""
    cands = sorted(
        (c for c in comments if marker_kind(c.get("body") or "", repo, pr)),
        key=lambda c: (c.get("created_at") or "", int(c.get("id") or 0)),
    )
    ours = [c for c in cands if (c.get("login") or "") in trusted]
    return ours, [c for c in cands if (c.get("login") or "") not in trusted]


def strip_legacy_section(body: str, repo: str, pr: int) -> tuple[str, str]:
    """Remove the explanation block an earlier version wrote into the description.

    Returns (new body, status): 'none', 'stripped', or 'left: <why>' when a block is
    present but is not exactly the generated one (the body is then unchanged).
    """
    body = body or ""
    m = START_LINE_RE.match(body)
    if not m:
        return body, ("left: an explain-diff start marker that is not the first line" if START_ANY in body else "none")
    if not same_ref(m, repo, pr):
        return body, f"left: the start marker names {m.group(1)}#{m.group(2)}, not this PR"
    rest = body[m.end():]
    ends = [mm for mm in re.finditer(r"(?m)^" + re.escape(END) + r"\r?$", rest)]
    if len(ends) != 1:
        return body, f"left: {len(ends)} end-marker lines (exactly one expected)"
    return rest[ends[0].end():].lstrip("\r\n"), "stripped"


def explanation_comment(explanation: str, ref: str, sha: str) -> str:
    return COMMENT_MARKER.format(ref=ref, sha=sha) + "\n\n" + explanation.strip() + "\n"


def pointer_body(ref: str, keep_url: str) -> str:
    return POINTER_MARKER.format(ref=ref) + f"\n_Superseded: the explanation of this PR is in [this comment]({keep_url}), updated on every push._"


def quiz_positions(sha: str, questions: int = 5, options: int = 4) -> list[str]:
    """Deterministic, spread-out correct-answer letters for a quiz on `sha`.

    Keyed on the head so a re-run of the same head reproduces the same quiz;
    no letter repeats more than twice and at least three letters appear, so the
    correct answer is never "always A".
    """
    letters = "ABCDEFGH"[:options]
    counter = 0
    while True:
        picks = []
        for i in range(questions):
            h = hashlib.sha256(f"{sha}:{counter}:{i}".encode()).digest()
            picks.append(letters[h[0] % options])
        spread = len(set(picks)) >= min(3, options, questions)
        capped = max(picks.count(c) for c in set(picks)) <= max(2, -(-questions // options))
        if spread and capped:
            return picks
        counter += 1


class GhError(Exception):
    pass


class Refused(Exception):
    def __init__(self, code: int, msg: str):
        super().__init__(msg)
        self.code = code


def gh_try(args: list[str]) -> tuple[bool, str]:
    r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if r.returncode != 0:
        return False, r.stderr.strip()[:300]
    return True, r.stdout


def gh(args: list[str]) -> str:
    ok, out = gh_try(args)
    if not ok:
        raise GhError(f"gh {' '.join(args[:4])} failed: {out}")
    return out


def with_body(text: str, args_before: list[str], args_after: list[str] | None = None) -> str:
    """`gh api … -F body=@<tmp> …` with `text` as the body; raises GhError on failure."""
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
        f.write(text)
        tmp = f.name
    try:
        return gh([*args_before, "-F", f"body=@{tmp}", *(args_after or [])])
    finally:
        os.unlink(tmp)


def list_comments(repo: str, pr: int) -> list[dict]:
    out = gh(["api", f"repos/{repo}/issues/{pr}/comments", "--paginate",
              "--jq", ".[] | {id, created_at, html_url, body, login: .user.login}"])
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def live_pr(repo: str, pr: int) -> dict:
    return json.loads(gh(["api", f"repos/{repo}/pulls/{pr}", "--jq", "{body: .body, head: .head.sha}"]))


def trusted_identities() -> set[str]:
    out = set(recorded_actors())
    ok, me = gh_try(["api", "user", "--jq", ".login"])
    if ok and me.strip():
        out.add(me.strip())
    out |= {x.strip() for x in os.environ.get("EXPLAIN_DIFF_ACTOR", "").split(",") if x.strip()}
    return out


def refuse_foreign(foreign: list[dict], ref: str, trusted: set[str]) -> None:
    if foreign:
        who = ", ".join(f"{c['id']} by {c.get('login') or '?'}" for c in foreign)
        raise Refused(5, (
            f"comment(s) {who} on {ref} start with the explanation marker but are not ours "
            f"(this run writes as: {', '.join(sorted(trusted)) or 'unknown'}). Nothing was written. "
            "If one of those logins is this coworker's own GitHub identity, re-run with "
            "EXPLAIN_DIFF_ACTOR=<that login>; otherwise report it to your parent — never adopt a human's login."
        ))


def converge(repo: str, pr: int, ref: str, comment: str, sha: str, trusted: set[str]) -> dict:
    """Make exactly one of our comments carry `comment`; returns it."""
    want = comment.rstrip()
    for attempt in range(2):
        mine, foreign = split_candidates(list_comments(repo, pr), repo, pr, trusted)
        refuse_foreign(foreign, ref, trusted)
        if not mine:
            raise GhError(f"our explanation comment on {ref} is missing after writing it")
        keep = mine[0]
        if (len(mine) == 1 and marker_kind(keep["body"], repo, pr) == "current"
                and marker_head(keep["body"]) == sha and (keep["body"] or "").rstrip() == want):
            return keep
        if attempt == 1:
            break
        if (keep["body"] or "").rstrip() != want:
            with_body(comment, ["api", "-X", "PATCH", f"repos/{repo}/issues/comments/{keep['id']}"], ["--silent"])
        for d in mine[1:]:
            with_body(pointer_body(ref, keep.get("html_url") or ""), ["api", "-X", "PATCH", f"repos/{repo}/issues/comments/{d['id']}"], ["--silent"])
    raise GhError(f"our explanation comments on {ref} did not converge to one (a concurrent writer?); re-run")


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--repo")
    p.add_argument("--pr", type=int)
    p.add_argument("--head", required=True, help="commit the explanation was written from")
    p.add_argument("--explanation", help="GitHub-safe Markdown file")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--quiz-positions", action="store_true")
    p.add_argument("--questions", type=int, default=5)
    p.add_argument("--options", type=int, default=4)
    a = p.parse_args(argv)

    if a.quiz_positions:
        print(" ".join(quiz_positions(a.head, a.questions, a.options)))
        return 0
    if not (a.repo and a.pr and a.explanation):
        p.error("--repo, --pr and --explanation are required")
    if not re.fullmatch(r"[0-9a-f]{7,40}", a.head):
        p.error("--head must be a commit sha (7-40 hex chars): git -C <worktree> rev-parse HEAD")

    try:
        return run(a)
    except Refused as e:
        print(str(e), file=sys.stderr)
        return e.code
    except GhError as e:
        print(str(e), file=sys.stderr)
        return 5


def run(a: argparse.Namespace) -> int:
    pr = live_pr(a.repo, a.pr)
    live = pr.get("head") or ""
    if not live or not live.startswith(a.head):
        raise Refused(4, f"head mismatch: explanation written from {a.head[:12]}, PR head is {live[:12]} — "
                         "push first, or re-run against the PR's current head")

    ref = f"{a.repo}#{a.pr}"
    with open(a.explanation, encoding="utf-8") as fh:
        comment = explanation_comment(fh.read(), ref, live[:12])
    if len(comment) > MAX_COMMENT:
        raise Refused(3, f"explanation comment is {len(comment)} chars, over {MAX_COMMENT}: shrink the explanation and re-run")

    trusted = trusted_identities()
    mine, foreign = split_candidates(list_comments(a.repo, a.pr), a.repo, a.pr, trusted)
    refuse_foreign(foreign, ref, trusted)
    new_desc, desc_status = strip_legacy_section(pr.get("body") or "", a.repo, a.pr)
    notes = []
    if desc_status.startswith("left:"):
        notes.append(f"NOTE: the description still holds an explain-diff block this script will not remove ({desc_status[6:]}); "
                     f"move it out by hand with `gh pr edit {a.pr} -R {a.repo} --body-file <file>`.")
    if len(new_desc.strip()) < SHORT_BODY:
        notes.append(f"NOTE: the PR description is {len(new_desc.strip())} chars. Write a concise description "
                     f"(what changed, why, how it was tested, issue links) with `gh pr edit {a.pr} -R {a.repo} --body-file <file>`; "
                     "squash merges copy it into git log, so keep the explanation out of it.")
    if os.environ.get("PR_DESCRIPTION_GATE", "1") != "0":
        max_chars, max_lines = description_limits()
        problems = description_problems(new_desc, max_chars, max_lines)
        if problems:
            notes.append(f"NOTE: the PR description is over the limits ({'; '.join(problems)}). Keep each section to "
                         f"{max_lines} lines and the whole description under {max_chars:,} chars with no tables; "
                         f"rewrite it with `gh pr edit {a.pr} -R {a.repo} --body-file <file>` and leave details, "
                         "tables and open questions in the explanation comment.")

    if a.dry_run:
        # Everything human-readable goes to stderr; stdout carries only a non-success trailer,
        # so nothing a dry run prints can be read as a receipt.
        sys.stderr.write(comment)
        plan = {"comment": f"update {mine[0]['id']}" if mine else "create", "pointers": [d["id"] for d in mine[1:]],
                "description": desc_status, "writes_as": sorted(trusted), "chars": len(comment)}
        print(f"\n[dry-run] {json.dumps(plan)}", file=sys.stderr)
        for n in notes:
            print(n, file=sys.stderr)
        print(RECEIPT_PREFIX + json.dumps({"updated": False, "dry_run": True}))
        return 0

    action = "updated"
    if mine:
        if (mine[0]["body"] or "").rstrip() != comment.rstrip():
            with_body(comment, ["api", "-X", "PATCH", f"repos/{a.repo}/issues/comments/{mine[0]['id']}"], ["--silent"])
        for d in mine[1:]:
            with_body(pointer_body(ref, mine[0].get("html_url") or ""), ["api", "-X", "PATCH", f"repos/{a.repo}/issues/comments/{d['id']}"], ["--silent"])
    else:
        made = json.loads(with_body(comment, ["api", "-X", "POST", f"repos/{a.repo}/issues/{a.pr}/comments"],
                                    ["--jq", "{id, login: .user.login}"]))
        login = made.get("login") or ""
        if login:
            trusted.add(login)
            record_actor(login)
        action = "created"
    kept = converge(a.repo, a.pr, ref, comment, live[:12], trusted)

    latest = live_pr(a.repo, a.pr)
    now = latest.get("head") or ""
    if now != live:
        raise Refused(4, f"the PR head moved from {live[:12]} to {now[:12]} during this run; "
                         "re-run /explain-diff-html for the new head")
    if desc_status == "stripped":
        # Edit only the description we inspected: if anyone changed it meanwhile, write nothing to it.
        if (latest.get("body") or "") != (pr.get("body") or ""):
            raise Refused(5, "the PR description changed during this run; nothing was written to it — re-run")
        with_body(new_desc, ["api", "-X", "PATCH", f"repos/{a.repo}/pulls/{a.pr}"], ["--silent"])
        after = live_pr(a.repo, a.pr).get("head") or ""
        if after != live:
            raise Refused(4, f"the PR head moved from {live[:12]} to {after[:12]} during this run; "
                             "re-run /explain-diff-html for the new head")

    for n in notes:
        print(n)
    # The receipt pr-auto-map.sh reads: last stdout line, printed only after every write
    # succeeded and the head was re-checked.
    print(RECEIPT_PREFIX + json.dumps({
        "updated": True, "repo": a.repo, "pr": a.pr, "head": live[:12], "chars": len(comment),
        "comment": kept["id"], "comment_action": action, "comment_url": kept.get("html_url") or "",
        "pointers": [d["id"] for d in mine[1:]], "description": desc_status,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
