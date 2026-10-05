#!/usr/bin/env python3
"""Keep ONE PR comment as the explanation of the PR's current head.

The explanation (GitHub-safe Markdown written by /explain-diff-html) lives in a
single PR comment, marked with COMMENT_MARKER, edited in place on every push. The
PR description stays the author's own concise text (what changed, why, how it was
tested, issue links): squash merges copy the description into git log, so it must
not carry the explanation.

What a run does:
  - updates the existing explanation comment, or creates it when there is none.
    An older collapsed explanation comment (LEGACY_MARKER, or the pointer an
    earlier version left behind) is converted into the explanation comment rather
    than adding a second one. If several candidates exist, the OLDEST is kept and
    the others are reduced to a one-line pointer to it (never deleted).
  - removes any explain-diff-html section (START..END) an earlier version wrote into
    the description, so the description returns to the author's text. Issue links
    and the bot disclaimer outside that section are untouched. If what remains is
    shorter than SHORT_BODY characters, a NOTE line asks the agent to write a
    concise description; the run still succeeds.

Comment order: GitHub lists comments by creation time and cannot reorder them. The
explanation sits directly after the description when it is the PR's first comment
(run this right after `gh pr create`); otherwise the oldest existing explanation
comment keeps its place, and a new one is appended.

Head check: the caller passes the commit the explanation was written from
(`git -C <worktree> rev-parse HEAD`). If the PR's live head is a different
commit, the explanation is stale (or the push has not landed) and nothing is
written.

Usage:
  upsert_pr_body.py --repo OWNER/REPO --pr N --head SHA --explanation FILE [--dry-run]
  upsert_pr_body.py --quiz-positions --head SHA [--questions 5] [--options 4]

Exit codes: 0 written (or dry-run printed), 2 usage, 3 over the size limit,
4 head mismatch, 5 gh failure.
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

# Where the explanation lives now: one PR comment that starts with this marker.
COMMENT_MARKER = "<!-- explain-diff-html:comment {ref} head={sha} -->"
COMMENT_PREFIX = "<!-- explain-diff-html:comment "
# A superseded duplicate, reduced to a pointer. Never a candidate again.
POINTER_PREFIX = "<!-- explain-diff-html:pointer "
# The section an earlier version wrote INTO the description. Stripped on every run.
START = "<!-- explain-diff-html:start {ref} head={sha} -->"
START_RE = re.compile(r"<!-- explain-diff-html:start [^>]*-->")
END = "<!-- explain-diff-html:end -->"
# The collapsed-comment marker of the first version (and the pointer the second
# version left behind). A comment carrying it is converted, not duplicated.
LEGACY_MARKER = "<!-- explain-diff-html "
MAX_COMMENT = 60_000  # GitHub rejects comment bodies over 65,536 characters.
SHORT_BODY = 200


def strip_section(body: str) -> str:
    """Remove every explain-diff-html section (start..end) from a body."""
    out, i = [], 0
    while True:
        m = START_RE.search(body, i)
        if not m:
            out.append(body[i:])
            break
        out.append(body[i : m.start()])
        end = body.find(END, m.end())
        i = len(body) if end < 0 else end + len(END)
    return "".join(out)


def description_after_strip(body: str) -> tuple[str, bool, bool]:
    """(new description, changed?, too short?). Collapses the blank lines a removed section leaves."""
    old = body or ""
    new = strip_section(old)
    if new != old:
        new = re.sub(r"\n{3,}", "\n\n", new).strip() + "\n"
    return new, new != old, len(new.strip()) < SHORT_BODY


def explanation_comment(explanation: str, ref: str, sha: str) -> str:
    return COMMENT_MARKER.format(ref=ref, sha=sha) + "\n\n" + explanation.strip() + "\n"


def pointer_body(ref: str, keep_url: str) -> str:
    return f"{POINTER_PREFIX}{ref} -->\n_Superseded: the explanation of this PR is in [this comment]({keep_url}), updated on every push._"


def is_candidate(body: str) -> bool:
    b = (body or "").lstrip()
    if b.startswith(POINTER_PREFIX):
        return False
    return b.startswith((COMMENT_PREFIX, LEGACY_MARKER))


def plan_comments(comments: list[dict]) -> tuple[dict | None, list[dict]]:
    """The comment to keep (oldest candidate) and the duplicate candidates to reduce to pointers."""
    cands = sorted(
        (c for c in comments if is_candidate(c.get("body") or "")),
        key=lambda c: (c.get("created_at") or "", int(c.get("id") or 0)),
    )
    return (cands[0] if cands else None), cands[1:]


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


def gh_try(args: list[str]) -> tuple[bool, str]:
    r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if r.returncode != 0:
        return False, r.stderr.strip()[:300]
    return True, r.stdout


def gh(args: list[str]) -> str:
    ok, out = gh_try(args)
    if not ok:
        print(f"gh {' '.join(args[:3])} failed: {out}", file=sys.stderr)
        sys.exit(5)
    return out


def with_body_file(text: str, args_before: list[str], args_after: list[str] | None = None, *, strict: bool = True):
    """Run `gh api … -F body=@<tmp> …` with `text` as the body."""
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
        f.write(text)
        tmp = f.name
    try:
        args = [*args_before, "-F", f"body=@{tmp}", *(args_after or [])]
        return gh(args) if strict else gh_try(args)
    finally:
        os.unlink(tmp)


def list_comments(repo: str, pr: int) -> list[dict]:
    out = gh(["api", f"repos/{repo}/issues/{pr}/comments", "--paginate",
              "--jq", ".[] | {id, created_at, html_url, body}"])
    return [json.loads(line) for line in out.splitlines() if line.strip()]


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

    pr = json.loads(gh(["api", f"repos/{a.repo}/pulls/{a.pr}", "--jq", "{body: .body, head: .head.sha}"]))
    live = pr.get("head") or ""
    if not live or not live.startswith(a.head):
        print(
            f"head mismatch: explanation written from {a.head[:12]}, PR head is {live[:12]} — "
            "push first, or re-run against the PR's current head",
            file=sys.stderr,
        )
        return 4

    ref = f"{a.repo}#{a.pr}"
    with open(a.explanation, encoding="utf-8") as fh:
        comment = explanation_comment(fh.read(), ref, live[:12])
    if len(comment) > MAX_COMMENT:
        print(f"explanation comment is {len(comment)} chars, over {MAX_COMMENT}: shrink the explanation and re-run", file=sys.stderr)
        return 3

    keep, dups = plan_comments(list_comments(a.repo, a.pr))
    new_desc, desc_changed, desc_short = description_after_strip(pr.get("body") or "")
    note = (
        f"NOTE: the PR description is {len(new_desc.strip())} chars. Write a concise description "
        f"(what changed, why, how it was tested, issue links) with `gh pr edit {a.pr} -R {a.repo} --body-file <file>`; "
        "squash merges copy it into git log, so keep the explanation out of it."
    ) if desc_short else ""

    if a.dry_run:
        sys.stdout.write(comment)
        plan = {
            "comment": f"update {keep['id']}" if keep else "create",
            "pointers": [d["id"] for d in dups],
            "description": "strip explain-diff section" if desc_changed else "unchanged",
            "chars": len(comment),
        }
        print(f"\n[dry-run] {json.dumps(plan)}", file=sys.stderr)
        if note:
            print(note, file=sys.stderr)
        return 0

    # Oldest candidate first; one we cannot edit (written by someone else) is skipped,
    # so a run never stalls on it or adds a fresh comment every time.
    action, cid, url = "created", None, ""
    for c in ([keep] if keep else []) + dups:
        ok, _ = with_body_file(comment, ["api", "-X", "PATCH", f"repos/{a.repo}/issues/comments/{c['id']}"],
                               ["--silent"], strict=False)
        if ok:
            action, cid, url = "updated", c["id"], c.get("html_url") or ""
            break
        print(f"could not edit comment {c['id']} (not ours?); trying the next", file=sys.stderr)
    if cid is None:
        made = json.loads(with_body_file(comment, ["api", "-X", "POST", f"repos/{a.repo}/issues/{a.pr}/comments"],
                                         ["--jq", "{id, html_url}"]))
        cid, url = made.get("id"), made.get("html_url") or ""
    pointers = []
    for d in ([keep] if keep else []) + dups:
        if d["id"] == cid:
            continue
        ok, _ = with_body_file(pointer_body(ref, url), ["api", "-X", "PATCH", f"repos/{a.repo}/issues/comments/{d['id']}"],
                               ["--silent"], strict=False)
        if ok:
            pointers.append(d["id"])
    if desc_changed:
        with_body_file(new_desc, ["api", "-X", "PATCH", f"repos/{a.repo}/pulls/{a.pr}"], ["--silent"])

    if note:
        print(note)
    # repo/pr/head are echoed so the PostToolUse receipt (pr-auto-map.sh) can name the
    # PR even when the command passed them as shell variables. Keep this the last line.
    print(json.dumps({
        "updated": True, "repo": a.repo, "pr": a.pr, "head": live[:12], "chars": len(comment),
        "comment": cid, "comment_action": action, "comment_url": url, "pointers": pointers,
        "description": "stripped" if desc_changed else "unchanged",
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
