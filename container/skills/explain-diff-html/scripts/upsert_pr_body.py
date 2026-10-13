#!/usr/bin/env python3
"""Keep ONE PR comment as the explanation of the PR's current head.

The explanation (GitHub-safe Markdown written by /explain-diff-html) lives in a
single PR comment, marked with COMMENT_MARKER and edited in place on every push.
The PR description stays the author's own concise text (what changed, why, how it
was tested, issue links): squash merges copy the description into git log, so it
must not carry the explanation. GitHub orders comments by creation time and cannot
move them, so the comment sits wherever it was created — on a busy repo, after the
bots' first comments — and is found by its marker, never by its position.

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

Which of ours we may overwrite. Every body this script writes ends with a seal
line (SEAL_MARKER) carrying the sha256 of the lines above it. Before overwriting one
of our comments the script checks that seal: intact means the body is our last
write; a mismatch means someone edited it since, and GitHub's edit history (GraphQL
`editor`) names who. A comment edited by anyone outside our identities is never
overwritten: the run exits 5 with a NOTE naming the editor and writes nothing, so a
maintainer's annotation survives every later push. A comment from before seals
existed is judged by its edit history alone (never edited, or edited only by us,
may be overwritten).

What a run does:
  - updates the oldest of our comments in place, or creates one when there is no
    candidate at all. Our other candidate comments become a one-line pointer to it.
  - appends the bot disclaimer when the explanation has no `<sub>…</sub>` line:
    --disclaimer / EXPLAIN_DIFF_DISCLAIMER, else the description's own final
    `<sub>` line (the spine mandates it there too), else DEFAULT_DISCLAIMER. A
    description without one gets a NOTE.
  - re-reads the comments and succeeds only when exactly one of ours carries the
    current marker, the explained head and the requested body; and re-reads the PR
    head and refuses (exit 4) if it moved during the run.
  - removes the explanation block an earlier version wrote into the description,
    only when it is exactly that block: the start marker for this PR as the very
    first line, and exactly one end-marker line. Anything else is left unchanged
    with a NOTE. It never empties the description: the block is removed only when
    what remains (minus the `<sub>` disclaimer and closing-keyword lines) is a real
    description, at least SHORT_BODY characters with a Summary section; otherwise
    the block stays and a NOTE asks for the concise description (`gh pr edit
    --body-file` replaces the whole description, block included). A description
    shorter than SHORT_BODY characters also gets a NOTE, and so does one over the
    description limits.
  - prints the receipt line (RECEIPT_PREFIX + JSON) as the last stdout line, only
    after every write succeeded. Any failed write exits 5 without it.

The description limits are stated once, in SKILL.md § The PR description, and
implemented once, in container/hooks/lib/pr_description.py (the PreToolUse gate).
This script imports that module — from /app/hooks inside the container, from the
repo tree, or from PR_DESCRIPTION_LIB — and carries no copy of the rules.

Head check: the caller passes the commit the explanation was written from
(`git -C <worktree> rev-parse HEAD`). If the PR's live head is a different
commit, the explanation is stale (or the push has not landed) and nothing is
written.

Usage:
  upsert_pr_body.py --repo OWNER/REPO --pr N --head SHA --explanation FILE
                    [--dry-run] [--quiet] [--disclaimer TEXT]
  upsert_pr_body.py --quiz-positions --head SHA [--questions 5] [--options 4]

--dry-run writes nothing. stderr gets the comment's first three non-empty lines
and its character count (not with --quiet), the plan JSON and the NOTE lines;
stdout gets a trailer that is not a receipt.

Exit codes: 0 written (or dry-run printed), 2 usage, 3 over the size limit,
4 head mismatch (before or after writing; stdout then carries a
`{"updated": false, "head_mismatch": true, …}` trailer naming the live head, which
pr-auto-map.sh records as a push so the refresh stays owed), 5 gh failure, a
comment carrying our marker that is not ours, one of ours edited by someone else,
or the comments did not converge to one.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile

COMMENT_MARKER = "<!-- explain-diff-html:comment {ref} head={sha} -->"
POINTER_MARKER = "<!-- explain-diff-html:pointer {ref} -->"
# The seal closes every body this script writes; its digest covers everything before it.
SEAL_MARKER = "<!-- explain-diff-html:written sha256={digest} -->"
SEAL_RE = re.compile(r"(?m)^<!-- explain-diff-html:written sha256=([0-9a-f]{64}) -->[ \t]*$")
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
DEFAULT_DISCLAIMER = "<sub>🤖 Generated by an automated coworker — may be inaccurate. A human maintainer should verify.</sub>"

HERE = os.path.dirname(os.path.abspath(__file__))
# Where the PR-description rules module lives: the container mounts the hooks at
# /app/hooks; a repo checkout has them three directories up from this script.
RULES_PATHS = (
    "/app/hooks/lib/pr_description.py",
    os.path.normpath(os.path.join(HERE, "..", "..", "..", "hooks", "lib", "pr_description.py")),
)
_rules = None


class GhError(Exception):
    pass


class Refused(Exception):
    """A refusal with its exit code; `trailer`, when set, is a non-receipt JSON line for stdout."""

    def __init__(self, code: int, msg: str, trailer: dict | None = None):
        super().__init__(msg)
        self.code = code
        self.trailer = trailer


def rules():
    """The PR-description rules module (container/hooks/lib/pr_description.py), loaded once.

    The limits have one implementation, shared with the PreToolUse gate, so the gate
    and this script's NOTEs can never disagree. PR_DESCRIPTION_LIB overrides the
    search; a tree without the module is a broken deployment, reported as exit 5.
    """
    global _rules
    if _rules is None:
        paths = [p for p in (os.environ.get("PR_DESCRIPTION_LIB", ""), *RULES_PATHS) if p]
        path = next((p for p in paths if os.path.isfile(p)), None)
        if path is None:
            raise Refused(5, (
                f"cannot find hooks/lib/pr_description.py (looked in {', '.join(paths)}): the PR-description "
                "rules live there and this script carries no copy. The hooks and this skill ship together — "
                "report it to your parent."
            ))
        spec = importlib.util.spec_from_file_location("pr_description", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _rules = mod
    return _rules


def description_limits() -> tuple[int, int]:
    return rules().limits()


def description_problems(body: str, max_chars: int, max_lines: int) -> list[str]:
    """What in a description breaks the limits, as short phrases; empty when it is fine.

    The hook's check_body, kept under this name as the offline pre-check entry point
    (`python3 -c "import upsert_pr_body as u; print(u.description_problems(open(F).read(), 1000, 2))"`).
    """
    return rules().check_body(body, max_chars, max_lines)


def description_core(body: str) -> str:
    """The description without its final `<sub>` disclaimer and closing-keyword lines."""
    return "\n".join(rules().counted_lines(body)).strip()


def has_summary(body: str) -> bool:
    """True when the description has a Summary section (bold label or heading)."""
    r = rules()
    for ln in r.counted_lines(body):
        m = r.BOLD_LABEL_RE.match(ln) or r.HEADING_RE.match(ln)
        if m and m.group("label").strip().rstrip(".:").lower().startswith("summary"):
            return True
    return False


def has_disclaimer(text: str) -> bool:
    """True when any line of `text` is a `<sub>…</sub>` disclaimer line."""
    return any(rules().DISCLAIMER_RE.match(ln) for ln in (text or "").splitlines())


def description_disclaimer(body: str) -> str:
    """The description's final `<sub>…</sub>` line (the spine puts the bot disclaimer there), or ''."""
    lines = [ln for ln in (body or "").splitlines() if ln.strip()]
    return lines[-1].strip() if lines and rules().DISCLAIMER_RE.match(lines[-1]) else ""


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


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sealed(text: str) -> str:
    """`text` closed by the seal line, so a later run can tell our last write from an edit."""
    text = text.rstrip("\n") + "\n"
    return text + SEAL_MARKER.format(digest=digest(text)) + "\n"


def seal_state(body: str) -> bool | None:
    """True when `body` is exactly what this script wrote, False when it changed since, None when it has no seal."""
    m = SEAL_RE.search(body or "")
    if not m:
        return None
    # Text after the seal line is an edit too: a note a human appended at the end.
    return digest(body[:m.start()]) == m.group(1) and not body[m.end():].strip()


def explanation_comment(explanation: str, ref: str, sha: str, disclaimer: str = "") -> str:
    text = COMMENT_MARKER.format(ref=ref, sha=sha) + "\n\n" + explanation.strip() + "\n"
    if disclaimer:
        text += "\n" + disclaimer.strip() + "\n"
    return sealed(text)


def pointer_body(ref: str, keep_url: str) -> str:
    return sealed(POINTER_MARKER.format(ref=ref)
                  + f"\n_Superseded: the explanation of this PR is in [this comment]({keep_url}), updated on every push._\n")


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
              "--jq", ".[] | {id, node_id, created_at, updated_at, html_url, body, login: .user.login}"])
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def live_pr(repo: str, pr: int) -> dict:
    return json.loads(gh(["api", f"repos/{repo}/pulls/{pr}", "--jq", "{body: .body, head: .head.sha}"]))


def last_editor(c: dict) -> tuple[str, str] | None:
    """(login, when) of the comment's last editor from GitHub's edit history; ('', '') when never edited.

    None when the lookup failed. The REST comment carries no editor, so this is one
    GraphQL query by node id.
    """
    node_id = c.get("node_id") or ""
    if not node_id:
        return None
    ok, out = gh_try(["api", "graphql", "-f", f"id={node_id}",
                      "-f", "query=query($id: ID!) { node(id: $id) { ... on IssueComment { editor { login } lastEditedAt } } }",
                      "--jq", ".data.node"])
    if not ok:
        return None
    try:
        node = json.loads(out)
    except ValueError:
        return None
    if not isinstance(node, dict):
        return None
    return str((node.get("editor") or {}).get("login") or ""), str(node.get("lastEditedAt") or "")


def assert_unedited(c: dict, ref: str, trusted: set[str]) -> None:
    """Refuse (exit 5) to overwrite one of our comments that someone else edited after our last write.

    An intact seal proves the body is ours. Otherwise GitHub's edit history decides:
    an edit by one of our own identities (or no edit at all) is fine; a human's edit
    is kept, and so is a body whose editor cannot be established.
    """
    body = c.get("body") or ""
    state = seal_state(body)
    if state is True:
        return
    info = last_editor(c)
    if info is None:
        if state is None and (c.get("updated_at") or "") == (c.get("created_at") or ""):
            return  # never edited since it was created
        who, when = "someone this run could not identify (the edit-history lookup failed)", ""
    else:
        who, when = info
        if not who or who in trusted:
            return
    raise Refused(5, (
        f"NOTE: comment {c['id']} on {ref} ({c.get('html_url') or 'our explanation comment'}) was edited by {who}"
        f"{' at ' + when if when else ''} after this script last wrote it; nothing was written, so that edit "
        "stays. Tell your parent: a human can revert the edit or delete the comment to let the explanation be "
        "refreshed. Never edit or delete it yourself, and never adopt a human's login."
    ))


def patch_comment(repo: str, c: dict, body: str, ref: str, trusted: set[str]) -> bool:
    """PATCH comment `c` to `body` unless it already reads so; refuses first when someone else edited it."""
    if (c.get("body") or "").rstrip() == body.rstrip():
        return False
    assert_unedited(c, ref, trusted)
    with_body(body, ["api", "-X", "PATCH", f"repos/{repo}/issues/comments/{c['id']}"], ["--silent"])
    return True


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
        patch_comment(repo, keep, comment, ref, trusted)
        for d in mine[1:]:
            patch_comment(repo, d, pointer_body(ref, keep.get("html_url") or ""), ref, trusted)
    raise GhError(f"our explanation comments on {ref} did not converge to one (a concurrent writer?); re-run")


def head_trailer(a: argparse.Namespace, live: str) -> dict:
    """The non-receipt stdout line of a head refusal: names the live head for pr-auto-map.sh."""
    return {"updated": False, "head_mismatch": True, "repo": a.repo, "pr": a.pr, "head": live[:12]}


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--repo")
    p.add_argument("--pr", type=int)
    p.add_argument("--head", required=True, help="commit the explanation was written from")
    p.add_argument("--explanation", help="GitHub-safe Markdown file")
    p.add_argument("--disclaimer", default="", help="bot disclaimer `<sub>…</sub>` line to append when the explanation has none")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--quiet", action="store_true", help="no comment preview on a dry run")
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
        if e.trailer:
            print(RECEIPT_PREFIX + json.dumps(e.trailer))
        return e.code
    except GhError as e:
        print(str(e), file=sys.stderr)
        return 5


def run(a: argparse.Namespace) -> int:
    ref = f"{a.repo}#{a.pr}"
    pr = live_pr(a.repo, a.pr)
    live = pr.get("head") or ""
    if not live or not live.startswith(a.head):
        raise Refused(4, f"head mismatch on {ref}: explanation written from {a.head[:12]}, PR head is {live[:12]} — "
                         "push first, or re-run against the PR's current head", head_trailer(a, live))

    description = pr.get("body") or ""
    with open(a.explanation, encoding="utf-8") as fh:
        explanation = fh.read()
    disclaimer, disclaimer_status = "", "kept"
    if not has_disclaimer(explanation):
        disclaimer = (a.disclaimer or os.environ.get("EXPLAIN_DIFF_DISCLAIMER", "") or description_disclaimer(description)
                      or DEFAULT_DISCLAIMER)
        disclaimer_status = "appended"
    comment = explanation_comment(explanation, ref, live[:12], disclaimer)
    if len(comment) > MAX_COMMENT:
        raise Refused(3, f"explanation comment is {len(comment)} chars, over {MAX_COMMENT}: shrink the explanation and re-run")

    trusted = trusted_identities()
    mine, foreign = split_candidates(list_comments(a.repo, a.pr), a.repo, a.pr, trusted)
    refuse_foreign(foreign, ref, trusted)
    # Every comment this run would rewrite is checked before anything is written, so a
    # human's edit to any of them stops the whole run, not just its own PATCH.
    targets = {}
    if mine:
        targets[mine[0]["id"]] = comment
        for d in mine[1:]:
            targets[d["id"]] = pointer_body(ref, mine[0].get("html_url") or "")
        for c in mine:
            if (c.get("body") or "").rstrip() != targets[c["id"]].rstrip():
                assert_unedited(c, ref, trusted)

    new_desc, desc_status = strip_legacy_section(description, a.repo, a.pr)
    if desc_status == "stripped":
        # Never empty the description: removing the block before the concise description
        # exists left PRs with no description (and a squash merge would commit none).
        core = description_core(new_desc)
        if len(core) < SHORT_BODY or not has_summary(new_desc):
            why = (f"only {len(core)} chars would remain" if len(core) < SHORT_BODY
                   else "what would remain has no Summary section")
            new_desc, desc_status = description, f"kept: {why}"
    notes = []
    if desc_status.startswith("kept:"):
        notes.append(f"NOTE: the old explanation block stays in the description for now ({desc_status[6:]}); "
                     "this script never empties a description. Write the concise description (Summary / Root cause / "
                     "Tests / Risk, within the limits in SKILL.md § The PR description, plus the Fixes line and the "
                     f"<sub> disclaimer) with `gh pr edit {a.pr} -R {a.repo} --body-file <absolute path>`: that replaces "
                     "the whole description, old block included.")
    elif desc_status.startswith("left:"):
        notes.append(f"NOTE: the description still holds an explain-diff block this script will not remove ({desc_status[6:]}); "
                     f"move it out by hand with `gh pr edit {a.pr} -R {a.repo} --body-file <file>`.")
    if not desc_status.startswith("kept:") and len(new_desc.strip()) < SHORT_BODY:
        notes.append(f"NOTE: the PR description is {len(new_desc.strip())} chars. Write a concise description "
                     f"(what changed, why, how it was tested, issue links) with `gh pr edit {a.pr} -R {a.repo} --body-file <file>`; "
                     "squash merges copy it into git log, so keep the explanation out of it.")
    if not desc_status.startswith("kept:") and os.environ.get("PR_DESCRIPTION_GATE", "1") != "0":
        max_chars, max_lines = description_limits()
        problems = description_problems(new_desc, max_chars, max_lines)
        if problems:
            notes.append(f"NOTE: the PR description is over the limits ({'; '.join(problems)}). Keep each section to "
                         f"{max_lines} lines and the whole description under {max_chars:,} chars with no tables; "
                         f"rewrite it with `gh pr edit {a.pr} -R {a.repo} --body-file <file>` and leave details, "
                         "tables and open questions in the explanation comment.")
    if not desc_status.startswith("kept:") and not description_disclaimer(new_desc):
        notes.append(f"NOTE: the PR description has no bot disclaimer: make `{disclaimer or DEFAULT_DISCLAIMER}` its last "
                     f"line with `gh pr edit {a.pr} -R {a.repo} --body-file <file>` (that line is not counted toward the limits).")

    plan = {"comment": f"update {mine[0]['id']}" if mine else "create", "pointers": [d["id"] for d in mine[1:]],
            "description": desc_status, "disclaimer": disclaimer_status, "writes_as": sorted(trusted), "chars": len(comment)}
    if a.dry_run:
        # Everything human-readable goes to stderr; stdout carries only a non-success trailer,
        # so nothing a dry run prints can be read as a receipt. The preview is three lines:
        # echoing the whole comment put 4–8k tokens back into the agent's context per dry run.
        if not a.quiet:
            preview = [ln for ln in comment.splitlines() if ln.strip()][:3]
            sys.stderr.write("\n".join(preview) + f"\n… {len(comment):,} chars in all\n")
        print(f"[dry-run] {json.dumps(plan)}", file=sys.stderr)
        for n in notes:
            print(n, file=sys.stderr)
        print(RECEIPT_PREFIX + json.dumps({"updated": False, "dry_run": True}))
        return 0

    action = "updated"
    if mine:
        for c in mine:
            patch_comment(a.repo, c, targets[c["id"]], ref, trusted)
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
        raise Refused(4, f"the PR head of {ref} moved from {live[:12]} to {now[:12]} during this run; "
                         "re-run /explain-diff-html for the new head", head_trailer(a, now))
    if desc_status == "stripped":
        # Edit only the description we inspected: if anyone changed it meanwhile, write nothing to it.
        if (latest.get("body") or "") != description:
            raise Refused(5, "the PR description changed during this run; nothing was written to it — re-run")
        with_body(new_desc, ["api", "-X", "PATCH", f"repos/{a.repo}/pulls/{a.pr}"], ["--silent"])
        after = live_pr(a.repo, a.pr).get("head") or ""
        if after != live:
            raise Refused(4, f"the PR head of {ref} moved from {live[:12]} to {after[:12]} during this run; "
                             "re-run /explain-diff-html for the new head", head_trailer(a, after))

    for n in notes:
        print(n)
    # The receipt pr-auto-map.sh reads: last stdout line, printed only after every write
    # succeeded and the head was re-checked.
    print(RECEIPT_PREFIX + json.dumps({
        "updated": True, "repo": a.repo, "pr": a.pr, "head": live[:12], "chars": len(comment),
        "comment": kept["id"], "comment_action": action, "comment_url": kept.get("html_url") or "",
        "pointers": [d["id"] for d in mine[1:]], "description": desc_status, "disclaimer": disclaimer_status,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
