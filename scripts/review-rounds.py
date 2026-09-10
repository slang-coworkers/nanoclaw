#!/usr/bin/env python3
"""review-rounds (review-cycles v2): how much VALID human review does a PR draw,
bot-authored vs human-authored, over time?

Companion to bot-contributions (throughput) and regression-quality (does the work
hold up). This one prices the REVIEW friction the coworker's PRs draw from humans.

The v1 producer counted every non-Bot, non-author comment as human review and
bucketed only merged PRs by merge week. Two things made that number wrong on prod
(prod-quality audit, 2026-09-09): a GitHub Actions workflow posts "PR board sync"
notices from a USER account (jhelferty-nv PAT), so a third of the counted "human"
cycles on bot PRs were automation; and long design reviews landed months of
discussion in a single merge week. v2 inspects comment bodies, keeps two explicit
indices, and attributes by the week the activity happened.

Uses the GitHub GraphQL API: one query per repo page pulls each PR's author, its
review submissions, its inline review threads WITH comment bodies, and its
conversation comments WITH bodies. A PR whose reviews, threads, thread comments
or conversation comments run past the first page is completed with follow-up
`node(id:)` queries BEFORE it is counted (GitHub returns these connections oldest
first, so a single page would drop the newest activity on exactly the long
design reviews the p90 is about); `pagesFetched` on the row is the audit trail
and `truncated` means "still short after the follow-ups", which should not
happen. Auth is the shader-slang GitHub-App installation token, minted by the
local helper and passed to a direct `curl --noproxy '*'` so a leaked http_proxy
cannot tunnel the request through the OneCLI gateway (same rule funnel-cron
enforces).

WHAT COUNTS. Two indices, both kept, both per PR and per week (mean, median, p90, N):

  ROUNDS = human review sessions. A published review by a valid human (any state:
  COMMENTED, CHANGES_REQUESTED, APPROVED, DISMISSED) is one round; the same
  reviewer's submissions within 30 minutes of the previous one collapse into a
  single round (GitHub creates an implicit COMMENTED review per stand-alone
  inline comment, so a reviewer leaving three inline comments over twenty
  minutes is one round, not three). A review carrying five inline comments is
  still one round. DISMISSED counts because the review WAS published (a stale
  approval auto-dismissed by the next push, or a CHANGES_REQUESTED a maintainer
  cleared); ignoring it would also let a later dismissal erase a round from a
  past week. PENDING is unpublished, visible only to its author, and ignored.

  COMMENTS = valid human comments after the filter: inline review comments across
  whole threads (every comment in `reviewThreads`, not just the opener) plus
  conversation comments (`pullRequest.comments`). Review summary bodies are not
  comments; they are the round.

THE FILTER (spec item 2; counters ship under `filters` so every removal is
auditable). Applied in this order: board-sync notice -> self -> automation ->
dispatch command. Removed as automation: the pr-board-sync notices posted from a
user PAT (body contains "<!-- pr-board-sync-assignment -->" or starts with
"**PR board sync:**", case-insensitive, after dropping quoted lines so a human
quote-replying the notice keeps their comment), any login ending in "[bot]",
anything the API types as Bot, coderabbitai, qodo*, CLAassistant, slangbot,
nv-slang-bot, the CI and copilot logins, and ghost/deleted actors. Removed as
self: the PR author's own comments and reviews; on the bot's PRs that is the
bot's own replies, so `removedAutomation` stays the automation the operator asked
to audit rather than being dominated by the author talking on its own PR.
Removed as commands: short bodies (<= 120 chars) that are only a dispatch to a
bot (^@(coderabbitai|coderabbit|nv-slang-bot)\\b.*(?<![\\w-])(?:review|rebase)\\b;
the lookbehind keeps "I'll re-review after" as the real review it is).
Deduplicated: the same author posting an identical body within 60 s.

AUTHOR CLASS. bot = the PR author normalises to nv-slang-bot (the GitHub-App bot;
"[bot]" stripped, lower-cased). human = any other non-automation account.
automation = other bot accounts authoring PRs (dependabot, slangbot, "[bot]"
logins). unknown = the author is null (a deleted account, or hidden from the
token). automation and unknown PRs are listed in perPR but excluded from BOTH
series rather than being folded into either class.

ATTRIBUTION. Primary series `weeklyByActivity`: each round is bucketed into the
Monday-UTC week of its first submission, each comment into the week of its
createdAt, across merged AND open AND closed PRs. The population (N) for a week
is the PRs "touched" that week: created, merged or closed in it, or with at least
one valid round/comment in it. A touched PR with no review that week contributes
zeros, so zero-review PRs sit in the denominator exactly as they do in the merge
series. Secondary series `weeklyByMerge`: merged PRs bucketed by merge week with
their whole-PR totals (the v1 population), so the old chart can be compared; each
class row also carries the v1 field names (computed with the v2 filter), both
under `legacy` and spread at class level so the old panel's totals strip keeps
rendering too. The top-level `weekly` key is a deprecated alias of the merge
series in the v1 shape so the old panel keeps rendering during rollout. A week
row in either series is flagged `partial` when its Monday is before --since
(the window opens mid-week; the default 2026-04-10 is a Friday) or when it
contains generatedAt (still in progress), so the dashboard can draw it hollow
like a low-N week instead of plotting three days as a full one.

CLASSIFICATION. Every valid comment gets one heuristic label: question,
change_request, nit, ack, process, other (rules in `classify_comment`, mirrored in
the `definition` object of the output).

Closed-but-unmerged PRs are included on purpose: the review they drew is real
human effort, and dropping them would make a week's history change when an open
PR is later closed without merging. The whole history since --since is recomputed
every run.

FAIL CLOSED. Every fetch (first pages and follow-ups alike) runs through
Collection; the first failure marks the run INCOMPLETE and the snapshot is
written with complete:false, a populated errors[] and NO series, then the
process exits nonzero. Aggregation is wrapped the same way, so a bug in the
maths lands as complete:false rather than as a traceback that leaves the
previous snapshot in place looking current. A broken collector must never be
indistinguishable from a quiet week. Oddities that do not make the numbers wrong
(a null PR node the token cannot see, a PR returned twice across a page edge)
are counted under warnings[] instead.

  python3 scripts/review-rounds.py [--since YYYY-MM-DD] [--repos a/b,c/d]
      [--install-id N] [--json <out>] [--fixture <raw-nodes.json>]

Exit codes: 0 = complete, 1 = incomplete collection, 2 = nothing to measure.
"""
import argparse
import collections
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone

# 3, not 2: the v1 "cycles" producer already shipped as schema 2 on prod, so the
# v2 shape takes the next free number. Consumers branch on schema >= 3.
SCHEMA = 3

TOKEN_SCRIPT = f"{os.environ.get('HOME', '')}/.config/nanoclaw/gh-app-token.py"
# shader-slang org installation id, the same one bot-contributions.ts and
# funnel.ts mint against.
DEFAULT_INSTALL = "122982130"
# All seven shader-slang repos the coworkers contribute to (spec item 1).
DEFAULT_REPOS = [
    "shader-slang/slang",
    "shader-slang/slangpy",
    "shader-slang/slang-rhi",
    "shader-slang/shader-slang.github.io",
    "shader-slang/slangpy-samples",
    "shader-slang/slang-playground",
    "shader-slang/slang-vscode-extension",
]
GRAPHQL = "https://api.github.com/graphql"
STATES = ["MERGED", "OPEN", "CLOSED"]

ROUND_COLLAPSE_SECONDS = 30 * 60
DEDUPE_SECONDS = 60
MIN_N = 5
LONGEST_COMMENTS = 5
SNIPPET_CHARS = 200
DISPATCH_MAX_CHARS = 120
# Follow-up pages per sub-connection; 50 x 100 comments is far past any real PR.
MAX_FOLLOWUP_PAGES = 50
# A published review in any of these states is a round. PENDING is left out: it
# is unpublished and only its author can see it.
PUBLISHED_REVIEW_STATES = ("APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED")
# The two author classes that make up the series; automation and unknown are
# listed in perPR only.
SERIES_CLASSES = ("bot", "human")

# Our bot, matched normalised (see is_bot_author). This is the AUTHOR-class
# question ("was this PR ours?"), so only nv-slang-bot counts.
OUR_BOT = {"nv-slang-bot"}
# Any actor that is not a human paying review attention. Exact logins, normalised.
BOT_REVIEWERS = {
    "nv-slang-bot",
    "github-actions",
    "dependabot",
    "copilot",
    "copilot-pull-request-reviewer",
    "devin-ai-integration",
    "coderabbitai",
    "coderabbit",
    "claassistant",
    "slangbot",
}
# Login patterns (applied to the raw login, case-insensitive).
BOT_LOGIN_PATTERNS = [r"\[bot\]$", r"^qodo", r"^coderabbit"]
_BOT_LOGIN_RES = [re.compile(p, re.IGNORECASE) for p in BOT_LOGIN_PATTERNS]

BOARD_SYNC_MARKER = "<!-- pr-board-sync-assignment -->"
BOARD_SYNC_PREFIX = "**PR board sync:**"
# The spec's literal tail is \b(review|rebase)\b, but \b matches after a hyphen,
# so "I'll re-review and approve after" (a real prod comment) read as a command.
# The lookbehind refuses a hyphen or word character right before the verb.
DISPATCH_COMMAND = re.compile(
    r"^@(?:coderabbitai|coderabbit|nv-slang-bot)\b.*(?<![\w-])(?:review|rebase)\b",
    re.IGNORECASE | re.DOTALL)
# A markdown quote line. Dropped before the board-sync check (a human quoting
# the notice is not the notice) and before classification.
_QUOTE_LINE = re.compile(r"^[ \t]*>.*$", re.MULTILINE)

CATEGORIES = ["question", "change_request", "nit", "ack", "process", "other"]


def normalise_login(login):
    return re.sub(r"\[bot\]$", "", (login or "").strip(), flags=re.IGNORECASE).lower()


def is_bot_author(actor):
    """A PR authored by our bot. actor = {login, __typename} or None."""
    if not actor:
        return False
    return normalise_login(actor.get("login")) in OUR_BOT


def is_bot_actor(actor):
    """A reviewer/commenter that is not human review attention (incl. ghosts)."""
    if not actor:
        return True  # ghost/unknown: do not credit it as human attention
    login = (actor.get("login") or "").strip()
    if actor.get("__typename") == "Bot":
        return True
    if any(r.search(login) for r in _BOT_LOGIN_RES):
        return True
    return normalise_login(login) in BOT_REVIEWERS


def is_board_sync_notice(body):
    """The pr-board-sync workflow's notice, posted from a user PAT. Quoted lines
    go first (GitHub's quote reply carries the raw markdown, HTML comment
    included, so a human asking "why was I assigned?" under the notice would
    otherwise vanish as automation); the prefix compare is case-insensitive."""
    b = _QUOTE_LINE.sub("", body or "").lstrip()
    return BOARD_SYNC_MARKER in b or b.casefold().startswith(BOARD_SYNC_PREFIX.casefold())


def is_dispatch_command(body):
    b = (body or "").strip()
    return len(b) <= DISPATCH_MAX_CHARS and bool(DISPATCH_COMMAND.match(b))


def parse_ts(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)


def week_of(iso):
    """Monday (UTC) of the ISO week the timestamp falls in, as YYYY-MM-DD."""
    dt = parse_ts(iso)
    monday = dt - timedelta(days=dt.weekday())
    return monday.date().isoformat()


# --- comment classification --------------------------------------------------

_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_FENCE = re.compile(r"```.*?```", re.DOTALL)
_INLINE_CODE = re.compile(r"`[^`\n]*`")
_URL = re.compile(r"https?://\S+")
_TRAILING_JUNK = re.compile(r"[\s\)\]\"'*_.!]+$")

NIT_RE = re.compile(r"^\W*(?:nit|nits|nitpick|minor|typo|style|optional)\b", re.IGNORECASE)
ACK_RE = re.compile(
    r"\b(?:lgtm|looks good(?: to me)?|thanks|thank you|approved|approving|merging|"
    r"nice work|great work|good catch)\b|^\W*\+1\b",
    re.IGNORECASE)
ACK_MAX_CHARS = 200
PROCESS_RE = re.compile(
    r"\b(?:rebase[sd]?|rebasing|update (?:the )?(?:pr |pull request )?(?:description|title)|"
    r"ci|re-?run|re-?runs|re-?running|re-?trigger|re-?triggered|retry|merge conflicts?|"
    r"resolve (?:the )?conflicts?)\b",
    re.IGNORECASE)
QUESTION_START_RE = re.compile(
    r"^\W*(?:why|how|what|which|where|when|could|does|did|is it|is this|is there|isn'?t|"
    r"are there|are you|do you|do we|can you|can we|would you|should we|any reason)\b",
    re.IGNORECASE)
CHANGE_RE = re.compile(
    r"\b(?:please|should|shouldn'?t|must|needs? to|fix|remove|add|rename|use|revert|"
    r"don'?t|do not|instead|change|replace|move|drop|avoid|update|missing|wrong|incorrect)\b",
    re.IGNORECASE)


def clean_body(body):
    b = _HTML_COMMENT.sub(" ", body or "")
    b = _FENCE.sub(" ", b)
    b = _QUOTE_LINE.sub(" ", b)
    b = _URL.sub(" ", b)
    b = _INLINE_CODE.sub(" ", b)
    return re.sub(r"\s+", " ", b).strip()


def classify_comment(body):
    """One heuristic label per valid comment. Order matters: the specific
    prefix rules (nit, short ack, process) win over the broad ones (question,
    change_request), and 'other' is what is left."""
    text = clean_body(body)
    if not text:
        return "other"
    if NIT_RE.match(text):
        return "nit"
    if len(text) <= ACK_MAX_CHARS and ACK_RE.search(text):
        return "ack"
    if PROCESS_RE.search(text):
        return "process"
    if _TRAILING_JUNK.sub("", text).endswith("?") or QUESTION_START_RE.match(text):
        return "question"
    if CHANGE_RE.search(text):
        return "change_request"
    return "other"


# --- collection ---------------------------------------------------------------

class Collection:
    """Records every fetch/parse failure so no caller can launder one into a
    zero. Callers keep going after a failure (to surface as many problems as
    possible in one run) but `ok` stays False and the run publishes INCOMPLETE."""

    def __init__(self):
        self.ok = True
        self.errors = []
        self.warnings = []

    def fail(self, what, detail):
        self.ok = False
        self.errors.append({"what": what, "detail": str(detail).strip()[:400]})

    def warn(self, what, detail):
        """Something odd that does not make the numbers wrong: a null PR node
        the token cannot see, a PR returned twice across a page edge. Shipped
        under warnings[] so it is visible without failing the run."""
        self.warnings.append({"what": what, "detail": str(detail).strip()[:400]})


def mint_token(col, install_id):
    try:
        r = subprocess.run(
            ["python3", TOKEN_SCRIPT, "--install-id", install_id],
            capture_output=True, text=True, timeout=120, check=False,
            env={"HOME": os.environ.get("HOME", ""), "PATH": os.environ.get("PATH", "")},
        )
    except (OSError, subprocess.SubprocessError) as e:
        col.fail("token", f"{type(e).__name__}: {e}")
        return None
    if r.returncode != 0:
        col.fail("token", r.stderr or r.stdout or f"rc={r.returncode}")
        return None
    tok = (r.stdout or "").strip()
    if not tok:
        col.fail("token", "empty token from gh-app-token.py")
        return None
    return tok


def graphql(col, token, query, variables, what, retries=1):
    """POST a GraphQL query via direct curl. Returns the `data` object, or None
    on any transport / GraphQL-error / parse failure (recorded on col). One
    retry on a transport blip so a single dropped connection does not fail a
    hundred-page run."""
    body = json.dumps({"query": query, "variables": variables})
    cmd = [
        "curl", "-sS", "--noproxy", "*",
        "-X", "POST",
        "-H", f"Authorization: bearer {token}",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/vnd.github+json",
        "--data-binary", "@-",
        GRAPHQL,
    ]
    last = None
    for attempt in range(retries + 1):
        if attempt:
            time.sleep(5)
        try:
            r = subprocess.run(cmd, input=body, capture_output=True, text=True,
                               timeout=180, check=False)
        except (OSError, subprocess.SubprocessError) as e:
            last = f"{type(e).__name__}: {e}"
            continue
        if r.returncode != 0:
            last = f"curl rc={r.returncode}: {(r.stderr or r.stdout)[:300]}"
            continue
        try:
            doc = json.loads(r.stdout)
        except json.JSONDecodeError as e:
            last = f"unparseable response: {e}: {r.stdout[:200]}"
            continue
        if doc.get("errors"):
            last = f"graphql errors: {json.dumps(doc['errors'])[:300]}"
            continue
        data = doc.get("data")
        if data is None:
            last = "graphql returned no data"
            continue
        return data
    col.fail(what, last or "unknown failure")
    return None


# One page pulls each PR's author and lifecycle stamps, its review submissions,
# its inline review threads with EVERY comment's body/author/createdAt, and its
# conversation comments with bodies. Point cost is dominated by
# PRs x threads x thread-comments (25 x 50 x 30 = 37500 -> about 13 points per
# page), well inside the GraphQL budget for a 30-minute cron over seven repos.
# Every sub-connection carries pageInfo, and PRs and threads carry their node
# id, so the rare PR that runs past a first page can be completed with the
# follow-up queries below instead of everyone paying for a bigger first page.
PR_QUERY = """
query($owner:String!, $name:String!, $cursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequests(first:25, after:$cursor, states:[MERGED, OPEN, CLOSED],
                 orderBy:{field:UPDATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id number title url state createdAt updatedAt mergedAt closedAt
        author { login __typename }
        reviews(first:100) {
          totalCount pageInfo { hasNextPage endCursor }
          nodes { state submittedAt author { login __typename } }
        }
        reviewThreads(first:50) {
          totalCount pageInfo { hasNextPage endCursor }
          nodes {
            id
            comments(first:30) {
              totalCount pageInfo { hasNextPage endCursor }
              nodes { id body createdAt url author { login __typename } }
            }
          }
        }
        comments(first:100) {
          totalCount pageInfo { hasNextPage endCursor }
          nodes { id body createdAt url author { login __typename } }
        }
      }
    }
  }
}
"""

# Follow-ups for a PR whose first page under-fetched a sub-connection. Each pages
# ONE connection onward from the cursor the first page stopped at, through
# node(id:), so a 300-comment design review costs a few small extra calls. On a
# bot PR the 100 review slots are shared with coderabbitai's implicit COMMENTED
# reviews, so without these a hot PR would lose HUMAN reviews first.
PR_REVIEWS_QUERY = """
query($id:ID!, $cursor:String) {
  node(id:$id) { ... on PullRequest {
    reviews(first:100, after:$cursor) {
      totalCount pageInfo { hasNextPage endCursor }
      nodes { state submittedAt author { login __typename } }
    }
  } }
}
"""
PR_COMMENTS_QUERY = """
query($id:ID!, $cursor:String) {
  node(id:$id) { ... on PullRequest {
    comments(first:100, after:$cursor) {
      totalCount pageInfo { hasNextPage endCursor }
      nodes { id body createdAt url author { login __typename } }
    }
  } }
}
"""
PR_THREADS_QUERY = """
query($id:ID!, $cursor:String) {
  node(id:$id) { ... on PullRequest {
    reviewThreads(first:50, after:$cursor) {
      totalCount pageInfo { hasNextPage endCursor }
      nodes {
        id
        comments(first:30) {
          totalCount pageInfo { hasNextPage endCursor }
          nodes { id body createdAt url author { login __typename } }
        }
      }
    }
  } }
}
"""
THREAD_COMMENTS_QUERY = """
query($id:ID!, $cursor:String) {
  node(id:$id) { ... on PullRequestReviewThread {
    comments(first:100, after:$cursor) {
      totalCount pageInfo { hasNextPage endCursor }
      nodes { id body createdAt url author { login __typename } }
    }
  } }
}
"""
FOLLOWUPS = (
    ("reviews", PR_REVIEWS_QUERY),
    ("comments", PR_COMMENTS_QUERY),
    ("reviewThreads", PR_THREADS_QUERY),
)


def needs_more(conn):
    """True when a connection's first page did not carry every node. Trusts
    pageInfo when present; a connection fetched without one (an older fixture)
    falls back to totalCount vs nodes."""
    if not isinstance(conn, dict):
        return False
    page = conn.get("pageInfo") or {}
    if page:
        return bool(page.get("hasNextPage"))
    return (conn.get("totalCount") or 0) > len(conn.get("nodes") or [])


def page_connection(col, token, what, query, node_id, field, conn):
    """Pull every remaining page of one sub-connection into conn['nodes'].
    Continues from the cursor the previous page stopped at; with no cursor known
    it refetches from the start and REPLACES the nodes so nothing counts twice.
    Returns the number of extra pages fetched, or None when a fetch failed
    (already recorded on col, so the run fails closed)."""
    nodes = conn.setdefault("nodes", [])
    cursor = (conn.get("pageInfo") or {}).get("endCursor")
    if cursor is None:
        del nodes[:]
    fetched = 0
    while fetched < MAX_FOLLOWUP_PAGES:
        data = graphql(col, token, query, {"id": node_id, "cursor": cursor}, what=what)
        if data is None:
            return None
        node = data.get("node")
        if not isinstance(node, dict):
            # It was visible a moment ago on the first page; a null now is a
            # failure to report, not a connection that happens to be empty.
            col.fail(what, "node not visible on follow-up")
            return None
        sub = node.get(field) or {}
        nodes.extend(n for n in (sub.get("nodes") or []) if isinstance(n, dict))
        fetched += 1
        page = sub.get("pageInfo") or {}
        cursor = page.get("endCursor")
        conn["pageInfo"] = {"hasNextPage": bool(page.get("hasNextPage")), "endCursor": cursor}
        if "totalCount" in sub:
            conn["totalCount"] = sub["totalCount"]
        if not page.get("hasNextPage"):
            break
        time.sleep(0.3)
    return fetched


def pr_needs_more(pr):
    """Does any sub-connection of this PR node run past its first page?"""
    if any(needs_more(pr.get(field)) for field, _ in FOLLOWUPS):
        return True
    threads = (pr.get("reviewThreads") or {}).get("nodes") or []
    return any(needs_more(th.get("comments")) for th in threads if isinstance(th, dict))


def complete_pr(col, token, repo, pr):
    """Follow-up pass for one PR: page reviews, conversation comments and review
    threads to completion, then every thread's comments. Returns the extra pages
    fetched per connection (folded into perPR[].pagesFetched), or None when a
    fetch failed. A node without an id (a fixture) gets no follow-up and stays
    flagged truncated."""
    label = f"{repo}#{pr.get('number')}"
    pid = pr.get("id")
    pages = {"reviews": 0, "comments": 0, "reviewThreads": 0, "threadComments": 0}
    if not pid:
        return pages
    for field, query in FOLLOWUPS:
        conn = pr.get(field)
        if not needs_more(conn):
            continue
        got = page_connection(col, token, f"{label} {field}", query, pid, field, conn)
        if got is None:
            return None
        pages[field] += got
    for th in (pr.get("reviewThreads") or {}).get("nodes") or []:
        if not isinstance(th, dict) or not th.get("id"):
            continue
        tc = th.get("comments")
        if not needs_more(tc):
            continue
        got = page_connection(col, token, f"{label} thread comments", THREAD_COMMENTS_QUERY,
                              th["id"], "comments", tc)
        if got is None:
            return None
        pages["threadComments"] += got
    return pages


def in_window(pr, since_iso):
    """A PR belongs to the window when it was alive in it: created, merged or
    closed at/after --since, or still open. updatedAt is the paging key."""
    upd = pr.get("updatedAt")
    if upd and upd < since_iso:
        return False
    if pr.get("state") == "OPEN":
        return True
    for k in ("createdAt", "mergedAt", "closedAt"):
        if (pr.get(k) or "") >= since_iso:
            return True
    return False


def pr_facts(pr, repo, since_iso):
    """Per-PR review facts for one PullRequest node (GraphQL shape)."""
    author = pr.get("author") or {}
    author_login = normalise_login(author.get("login"))
    if not author:
        # Deleted account or hidden from the token. Not "automation": that label
        # would be a lie, and the row is excluded from both series either way.
        author_class = "unknown"
    elif is_bot_author(author):
        author_class = "bot"
    elif is_bot_actor(author):
        author_class = "automation"
    else:
        author_class = "human"
    merged_at = pr.get("mergedAt")
    closed_at = pr.get("closedAt")
    created_at = pr.get("createdAt")
    if merged_at:
        state = "merged"
    elif pr.get("state") == "OPEN":
        state = "open"
    else:
        state = "closed"

    def is_self(actor):
        return bool(author_login) and normalise_login((actor or {}).get("login")) == author_login

    removed = {"automation": 0, "commands": 0, "duplicates": 0, "self": 0}
    reasons = collections.Counter()
    by_login = collections.Counter()

    def drop_automation(actor, reason):
        removed["automation"] += 1
        reasons[reason] += 1
        login = normalise_login((actor or {}).get("login")) if actor else ""
        by_login[login or "<ghost>"] += 1

    # 1. gather every comment candidate: whole threads + conversation.
    raw = []
    rt = pr.get("reviewThreads") or {}
    tnodes = [t for t in (rt.get("nodes") or []) if isinstance(t, dict)]
    thread_truncated = False
    for th in tnodes:
        tc = th.get("comments") or {}
        cs = [c for c in (tc.get("nodes") or []) if isinstance(c, dict)]
        if (tc.get("totalCount") or 0) > len(cs):
            thread_truncated = True
        for idx, c in enumerate(cs):
            raw.append(("inline", c, idx == 0))
    cc = pr.get("comments") or {}
    cnodes = [c for c in (cc.get("nodes") or []) if isinstance(c, dict)]
    for c in cnodes:
        raw.append(("conversation", c, False))

    # 2. the filter, in this order: board-sync marker -> self -> automation
    #    login/type -> dispatch command. Marker first so a notice posted on the
    #    poster's own PR is still automation, not self. Self before automation
    #    so the bot's own replies on its own PRs land under removed.self, and
    #    removedAutomation stays the automation the operator asked to audit
    #    (board-sync notices, CLAassistant, coderabbit) instead of being
    #    dominated by the author talking on its own PR.
    kept = []
    for kind, c, opener in raw:
        a = c.get("author")
        body = c.get("body") or ""
        if is_board_sync_notice(body):
            drop_automation(a, "boardSyncNotice")
            continue
        if is_self(a):
            removed["self"] += 1
            continue
        if is_bot_actor(a):
            drop_automation(a, "ghost" if not a else "botLogin")
            continue
        if is_dispatch_command(body):
            removed["commands"] += 1
            continue
        kept.append({
            "kind": kind,
            "opener": opener,
            "author": normalise_login(a.get("login")),
            "createdAt": c.get("createdAt") or "",
            "body": body,
            "url": c.get("url"),
        })

    # 3. dedupe: same author, identical body, within 60 s of the previous copy.
    kept.sort(key=lambda c: c["createdAt"])
    last_seen = {}
    valid = []
    for c in kept:
        key = (c["author"], re.sub(r"\s+", " ", c["body"]).strip())
        ts = parse_ts(c["createdAt"]) if c["createdAt"] else None
        prev = last_seen.get(key)
        if ts is not None and prev is not None and (ts - prev).total_seconds() <= DEDUPE_SECONDS:
            removed["duplicates"] += 1
            continue
        if ts is not None:
            last_seen[key] = ts
        valid.append(c)

    # 4. rounds from review submissions, collapsed per reviewer.
    reviews = pr.get("reviews") or {}
    rnodes = [r for r in (reviews.get("nodes") or []) if isinstance(r, dict)]
    reviews_removed = {"automation": 0, "self": 0}
    per_reviewer = collections.defaultdict(list)
    submissions = 0
    changes_requested = 0
    for rv in rnodes:
        if rv.get("state") not in PUBLISHED_REVIEW_STATES:
            continue  # PENDING: unpublished, nobody but its author has seen it
        ra = rv.get("author")
        if is_self(ra):
            reviews_removed["self"] += 1
            continue
        if is_bot_actor(ra):
            reviews_removed["automation"] += 1
            continue
        if not rv.get("submittedAt"):
            continue
        submissions += 1
        # Strict on purpose: GraphQL does not expose what state a DISMISSED
        # review had before the dismissal, so it is a round but never a CR.
        if rv.get("state") == "CHANGES_REQUESTED":
            changes_requested += 1
        per_reviewer[normalise_login(ra.get("login"))].append(rv["submittedAt"])
    rounds = []  # (iso, reviewer)
    for login, times in per_reviewer.items():
        times.sort()
        last = None
        for t in times:
            ts = parse_ts(t)
            if last is None or (ts - last).total_seconds() > ROUND_COLLAPSE_SECONDS:
                rounds.append((t, login))
            last = ts
    rounds.sort()

    # 5. derived views.
    classification = {k: 0 for k in CATEGORIES}
    for c in valid:
        classification[classify_comment(c["body"])] += 1
    reviewers = sorted({r[1] for r in rounds} | {c["author"] for c in valid})
    longest = sorted(valid, key=lambda c: (-len(c["body"]), c["createdAt"]))[:LONGEST_COMMENTS]
    longest_out = [{
        "author": c["author"],
        "date": c["createdAt"],
        "kind": c["kind"],
        "chars": len(c["body"]),
        "url": c["url"],
        "text": c["body"][:SNIPPET_CHARS],
    } for c in longest]

    activity = {}
    for t, _login in rounds:
        if t >= since_iso:
            activity.setdefault(week_of(t), {"rounds": 0, "comments": 0})["rounds"] += 1
    for c in valid:
        if c["createdAt"] and c["createdAt"] >= since_iso:
            activity.setdefault(week_of(c["createdAt"]), {"rounds": 0, "comments": 0})["comments"] += 1
    activity = dict(sorted(activity.items()))
    stamps = sorted([r[0] for r in rounds] + [c["createdAt"] for c in valid if c["createdAt"]])
    first_activity = stamps[0] if stamps else None
    last_activity = stamps[-1] if stamps else None
    end = merged_at or closed_at or last_activity
    duration = None
    if created_at and end:
        duration = round((parse_ts(end) - parse_ts(created_at)).total_seconds() / 86400, 1)

    # Still short AFTER the follow-up pass (collect_repo completes every
    # in-window PR before it lands here), so on a live run this should stay
    # False; a fixture without node ids can still trip it.
    truncated = (
        (reviews.get("totalCount") or 0) > len(rnodes)
        or (rt.get("totalCount") or 0) > len(tnodes)
        or (cc.get("totalCount") or 0) > len(cnodes)
        or thread_truncated
    )
    extra = pr.get("_pagesFetched") or {}
    pages_fetched = {
        "reviews": 1 + (extra.get("reviews") or 0),
        "comments": 1 + (extra.get("comments") or 0),
        "reviewThreads": 1 + (extra.get("reviewThreads") or 0),
        "threadComments": extra.get("threadComments") or 0,
    }
    inline = sum(1 for c in valid if c["kind"] == "inline")
    return {
        "repo": repo,
        "number": pr.get("number"),
        "url": pr.get("url") or f"https://github.com/{repo}/pull/{pr.get('number')}",
        "title": (pr.get("title") or "")[:160],
        "author": author_login,
        "authorClass": author_class,
        "state": state,
        "createdAt": created_at,
        "mergedAt": merged_at,
        "closedAt": closed_at,
        "rounds": len(rounds),
        "comments": len(valid),
        "inlineComments": inline,
        "conversationComments": len(valid) - inline,
        "threads": sum(1 for c in valid if c["opener"]),
        "changesRequested": changes_requested,
        "submissions": submissions,
        "reviewers": reviewers,
        "classification": classification,
        "removedAutomation": removed["automation"],
        "removed": removed,
        "reviewsRemoved": reviews_removed,
        "longestComments": longest_out,
        "activityByWeek": activity,
        "activityWeeks": list(activity),
        "firstActivityAt": first_activity,
        "lastActivityAt": last_activity,
        "reviewDurationDays": duration,
        "truncated": truncated,
        "pagesFetched": pages_fetched,
        # audit detail folded into filters{}; stripped before serialisation
        "_reasons": dict(reasons),
        "_byLogin": dict(by_login),
    }


def collect_repo(col, token, repo, since_iso):
    """Raw PullRequest nodes for one repo, newest-updated first, stopping when a
    whole page was last updated before the window. Null nodes (PRs the token
    cannot see) are dropped with a warning. A PR returned twice, because the
    UPDATED_AT ordering shifted under the cursor while the pages were being
    fetched, is kept once (the first copy: it is the most recently updated). A
    PR inside the window whose first page under-fetched a sub-connection is
    completed with follow-up node() queries before it is returned. None on any
    failure, first page or follow-up alike."""
    owner, name = repo.split("/", 1)
    cursor = None
    out = []
    seen = set()
    nulls = 0
    dupes = 0
    for _ in range(600):  # backstop; >15000 PRs is not real here
        data = graphql(col, token, PR_QUERY, {"owner": owner, "name": name, "cursor": cursor},
                       what=f"{repo} pullRequests")
        if data is None:
            return None
        repo_obj = (data or {}).get("repository")
        if repo_obj is None:
            col.fail(f"{repo}", "repository not visible to this installation token")
            return None
        conn = repo_obj.get("pullRequests") or {}
        raw_nodes = conn.get("nodes") or []
        nodes = [n for n in raw_nodes if isinstance(n, dict)]
        nulls += len(raw_nodes) - len(nodes)
        for n in nodes:
            num = n.get("number")
            if num in seen:
                dupes += 1
                continue
            seen.add(num)
            if in_window(n, since_iso) and pr_needs_more(n):
                pages = complete_pr(col, token, repo, n)
                if pages is None:
                    return None
                n["_pagesFetched"] = pages
            out.append(n)
        page = conn.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        if nodes and all((n.get("updatedAt") or "") < since_iso for n in nodes):
            break
        cursor = page.get("endCursor")
        time.sleep(0.3)  # gentle; GraphQL point budget is ample
    if nulls:
        col.warn(f"{repo} pullRequests",
                 f"{nulls} null PR node(s) dropped (not visible to this installation token)")
    if dupes:
        col.warn(f"{repo} pullRequests",
                 f"{dupes} PR(s) returned twice across a page edge; kept the first copy")
    return out


# --- aggregation --------------------------------------------------------------

def percentile(values, pct):
    """Nearest-rank percentile of a list of numbers. [] -> None."""
    if not values:
        return None
    s = sorted(values)
    k = max(0, min(len(s) - 1, round((pct / 100.0) * (len(s) - 1))))
    return s[k]


def stats(values):
    n = len(values)
    if n == 0:
        return {"n": 0, "total": 0, "mean": None, "median": None, "p90": None, "zeroPct": None}
    return {
        "n": n,
        "total": sum(values),
        "mean": round(statistics.fmean(values), 2),
        "median": round(statistics.median(values), 2),
        "p90": percentile(values, 90),
        "zeroPct": round(100 * sum(1 for v in values if v == 0) / n, 1),
    }


def legacy_stats(prs):
    """The v1 field names over a bucket of PR rows, computed with the v2 filter.
    cycles = human-initiated threads + conversation comments (v1 headline);
    avgRounds here is the v1 meaning (strict CHANGES_REQUESTED count)."""
    n = len(prs)
    if n == 0:
        return {"prs": 0, "avgCycles": None, "medianCycles": None, "p90Cycles": None,
                "avgRounds": None, "medianRounds": None, "p90Rounds": None,
                "zeroRoundPct": None, "avgSubmissions": None,
                "avgThreads": None, "avgIssueComments": None}
    cycles = [p["threads"] + p["conversationComments"] for p in prs]
    cr = [p["changesRequested"] for p in prs]
    return {
        "prs": n,
        "avgCycles": round(statistics.fmean(cycles), 2),
        "medianCycles": round(statistics.median(cycles), 2),
        "p90Cycles": percentile(cycles, 90),
        "avgRounds": round(statistics.fmean(cr), 2),
        "medianRounds": round(statistics.median(cr), 2),
        "p90Rounds": percentile(cr, 90),
        "zeroRoundPct": round(100 * sum(1 for r in cr if r == 0) / n, 1),
        "avgSubmissions": round(statistics.fmean(p["submissions"] for p in prs), 2),
        "avgThreads": round(statistics.fmean(p["threads"] for p in prs), 2),
        "avgIssueComments": round(statistics.fmean(p["conversationComments"] for p in prs), 2),
    }


def class_of(prs, with_legacy=True):
    out = {
        "prs": len(prs),
        "lowN": len(prs) < MIN_N,
        "rounds": stats([p["rounds"] for p in prs]),
        "comments": stats([p["comments"] for p in prs]),
    }
    if with_legacy:
        legacy = legacy_stats(prs)
        out["legacy"] = legacy
        # The v1 field names at class level too (prs is the same number), so
        # the old panel's totals strip keeps rendering during rollout and not
        # only its chart, which reads the `weekly` alias.
        out.update({k: v for k, v in legacy.items() if k != "prs"})
    return out


def class_totals(prs):
    bot = [p for p in prs if p["authorClass"] == "bot"]
    human = [p for p in prs if p["authorClass"] == "human"]
    return {
        "prs": len(prs),
        "mergedPrs": sum(1 for p in prs if p["state"] == "merged"),
        "openPrs": sum(1 for p in prs if p["state"] == "open"),
        "closedPrs": sum(1 for p in prs if p["state"] == "closed"),
        "automationAuthoredPrs": sum(1 for p in prs if p["authorClass"] == "automation"),
        "unknownAuthoredPrs": sum(1 for p in prs if p["authorClass"] == "unknown"),
        "botAuthored": class_of(bot),
        "humanAuthored": class_of(human),
        "reviewTruncatedPrs": sum(1 for p in prs if p["truncated"]),
    }


def partial_reasons(week, since_iso, now_iso):
    """Why a week row is not a full week: the window opens inside it (its Monday
    is before --since) or it is still in progress (it contains generatedAt)."""
    reasons = []
    if week < since_iso[:10]:
        reasons.append("window-start")
    if now_iso and week_of(now_iso) == week:
        reasons.append("in-progress")
    return reasons


def week_row(week, since_iso, now_iso):
    row = {"week": week}
    reasons = partial_reasons(week, since_iso, now_iso)
    row["partial"] = bool(reasons)
    if reasons:
        row["partialReasons"] = reasons
    return row


def weekly_by_merge(prs, since_iso, now_iso):
    """[{week, partial, botAuthored, humanAuthored}] over merge weeks; merged PRs
    only, whole-PR totals (the v1 population)."""
    weeks = {}
    for p in prs:
        if p["state"] != "merged" or p["authorClass"] not in SERIES_CLASSES:
            continue
        wk = week_of(p["mergedAt"])
        weeks.setdefault(wk, {"bot": [], "human": []})[p["authorClass"]].append(p)
    rows = []
    for wk in sorted(weeks):
        row = week_row(wk, since_iso, now_iso)
        row["botAuthored"] = class_of(weeks[wk]["bot"])
        row["humanAuthored"] = class_of(weeks[wk]["human"])
        rows.append(row)
    return rows


def legacy_weekly(prs):
    """The v1 `weekly` shape: {week, botAuthored{prs,...legacy}, humanAuthored{...}}."""
    weeks = {}
    for p in prs:
        if p["state"] != "merged" or p["authorClass"] not in SERIES_CLASSES:
            continue
        wk = week_of(p["mergedAt"])
        weeks.setdefault(wk, {"bot": [], "human": []})[p["authorClass"]].append(p)
    return [
        {"week": wk, "botAuthored": legacy_stats(weeks[wk]["bot"]),
         "humanAuthored": legacy_stats(weeks[wk]["human"])}
        for wk in sorted(weeks)
    ]


def touched_weeks(p, since_iso):
    weeks = set(p["activityByWeek"])
    for k in ("createdAt", "mergedAt", "closedAt"):
        v = p.get(k)
        if v and v >= since_iso:
            weeks.add(week_of(v))
    return weeks


def weekly_by_activity(prs, since_iso, now_iso):
    """[{week, partial, botAuthored, humanAuthored}] over activity weeks.
    Population per week = PRs touched that week (see module doc); values = that
    week's rounds and comments on each touched PR (zeros for
    touched-but-unreviewed)."""
    weeks = {}
    for p in prs:
        if p["authorClass"] not in SERIES_CLASSES:
            continue
        for wk in touched_weeks(p, since_iso):
            a = p["activityByWeek"].get(wk, {"rounds": 0, "comments": 0})
            weeks.setdefault(wk, {"bot": [], "human": []})[p["authorClass"]].append(a)
    rows = []
    for wk in sorted(weeks):
        row = week_row(wk, since_iso, now_iso)
        for cls, key in (("bot", "botAuthored"), ("human", "humanAuthored")):
            acts = weeks[wk][cls]
            row[key] = {
                "prs": len(acts),
                "lowN": len(acts) < MIN_N,
                "prsWithActivity": sum(1 for a in acts if a["rounds"] + a["comments"] > 0),
                "rounds": stats([a["rounds"] for a in acts]),
                "comments": stats([a["comments"] for a in acts]),
            }
        rows.append(row)
    return rows


def repo_block(prs, since_iso, now_iso):
    return {
        "totals": class_totals(prs),
        "weeklyByActivity": weekly_by_activity(prs, since_iso, now_iso),
        "weeklyByMerge": weekly_by_merge(prs, since_iso, now_iso),
        "weekly": legacy_weekly(prs),
    }


def filters_block(prs):
    reasons = collections.Counter()
    by_login = collections.Counter()
    tot = collections.Counter()
    rev = collections.Counter()
    for p in prs:
        reasons.update(p["_reasons"])
        by_login.update(p["_byLogin"])
        tot.update(p["removed"])
        rev.update(p["reviewsRemoved"])
    return {
        "removedAutomation": tot["automation"],
        "removedCommands": tot["commands"],
        "dedupedDuplicates": tot["duplicates"],
        "removedSelf": tot["self"],
        "removedAutomationByReason": {
            "botLogin": reasons["botLogin"],
            "boardSyncNotice": reasons["boardSyncNotice"],
            "ghost": reasons["ghost"],
        },
        "removedByLogin": dict(sorted(by_login.items(), key=lambda kv: (-kv[1], kv[0]))),
        "reviewSubmissionsRemoved": {"automation": rev["automation"], "self": rev["self"]},
        "botLogins": sorted(BOT_REVIEWERS),
        "botLoginPatterns": list(BOT_LOGIN_PATTERNS),
        "boardSyncMarkers": [BOARD_SYNC_MARKER, BOARD_SYNC_PREFIX],
        "dispatchCommandPattern": DISPATCH_COMMAND.pattern,
    }


def build_snapshot(nodes_by_repo, since, repos, now=None, col=None):
    """Pure aggregation over raw GraphQL PR nodes: {repo: [node]} -> the series
    keys of the output document. No network. Null nodes are dropped (counted on
    col as a warning when one is given) and a PR listed twice counts once, so a
    fixture is held to the same rules as a live collection. `now` (ISO) marks
    the in-progress week partial; it defaults to the wall clock."""
    since_iso = f"{since}T00:00:00Z"
    now_iso = now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    by_repo = {}
    all_prs = []
    for repo in repos:
        seen = set()
        nodes = []
        nulls = 0
        for n in nodes_by_repo.get(repo, []) or []:
            if not isinstance(n, dict):
                nulls += 1
                continue
            if n.get("number") in seen:
                continue  # first copy wins: it is the most recently updated
            seen.add(n.get("number"))
            nodes.append(n)
        if nulls and col is not None:
            col.warn(f"{repo} nodes", f"{nulls} null PR node(s) dropped")
        rows = [pr_facts(n, repo, since_iso) for n in nodes if in_window(n, since_iso)]
        rows.sort(key=lambda p: p["number"] or 0)
        by_repo[repo] = rows
        all_prs.extend(rows)
    doc = repo_block(all_prs, since_iso, now_iso)
    doc["filters"] = filters_block(all_prs)
    doc["perRepo"] = {repo: repo_block(rows, since_iso, now_iso) for repo, rows in by_repo.items()}
    doc["perPR"] = [{k: v for k, v in p.items() if not k.startswith("_")} for p in all_prs]
    return doc


def write_json(path, doc):
    """Atomic replace, creating the directory."""
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".review-rounds.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(doc, f, indent=1)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


DEFINITION = {
    "rounds": (
        "A human review session. A published review by a valid human in any state "
        "(COMMENTED, CHANGES_REQUESTED, APPROVED, DISMISSED) is one round; the same "
        "reviewer's submissions within 30 minutes of the previous one collapse into "
        "a single round. A review with five inline comments is one round. PENDING "
        "reviews are ignored (unpublished, visible only to their author); DISMISSED "
        "reviews count because they were published. changesRequested stays strict: "
        "a dismissed review is a round but never a CR."
    ),
    "publishedReviewStates": list(PUBLISHED_REVIEW_STATES),
    "comments": (
        "Valid human comments after the filter: every inline review comment across "
        "whole threads (pullRequest.reviewThreads) plus every conversation comment "
        "(pullRequest.comments). Review summary bodies are not comments."
    ),
    "filters": (
        "Applied in this order: board-sync notice, self, automation, dispatch "
        "command. Removed as automation: pr-board-sync notices posted from a user PAT "
        "(body contains '<!-- pr-board-sync-assignment -->' or starts with "
        "'**PR board sync:**', case-insensitive, quoted lines dropped first so a "
        "human quote-replying the notice is kept), logins ending in [bot], actors "
        "typed Bot, ghost or deleted actors, the logins in filters.botLogins and "
        "logins matching filters.botLoginPatterns. Removed as self: the PR author's "
        "own comments and reviews (on a bot PR, the bot's own replies). Removed as "
        "commands: bodies of at most 120 chars matching "
        "^@(coderabbitai|coderabbit|nv-slang-bot)\\b.*(?<![\\w-])(?:review|rebase)\\b "
        "(the lookbehind keeps 're-review'). Deduplicated: the same author posting an "
        "identical body within 60 s. Counters under filters{} (fleet) and "
        "perPR[].removed (per PR)."
    ),
    "attribution": (
        "weeklyByActivity (primary): each round is bucketed into the Monday-UTC week "
        "of its first submission and each comment into the week of its createdAt, "
        "across merged, open and closed PRs. N for a week is the PRs touched that "
        "week: created, merged or closed in it, or with at least one valid round or "
        "comment in it; a touched PR with no review that week contributes zeros. Only "
        "events at or after --since are bucketed. weeklyByMerge (legacy population): "
        "merged PRs bucketed by merge week with whole-PR totals; `weekly` is the same "
        "series in the v1 shape. A week row carries partial:true (with "
        "partialReasons) when its Monday is before --since (window-start) or it "
        "contains generatedAt (in-progress); render those hollow like low-N weeks."
    ),
    "authorClass": (
        "bot = PR author normalises to nv-slang-bot ([bot] stripped, lower-cased). "
        "human = any other non-automation account. automation = other bot accounts "
        "authoring PRs (dependabot, slangbot, [bot] logins). unknown = null author "
        "(deleted account or hidden from the token). automation and unknown are "
        "listed in perPR and excluded from both series."
    ),
    "classification": {
        "question": "cleaned body ends with '?' or starts with why/how/what/which/where/when/could/does/did/is it/is this/is there/are there/do you/can you/would you/should we",
        "change_request": "contains an imperative marker: please/should/must/need to/fix/remove/add/rename/use/revert/don't/do not/instead/change/replace/move/drop/avoid/update/missing/wrong/incorrect",
        "nit": "starts with nit/nits/nitpick/minor/typo/style/optional",
        "ack": "at most 200 chars and contains lgtm/looks good/thanks/thank you/approved/approving/merging/nice work/great work/good catch/+1",
        "process": "contains rebase/update the description or title/CI/rerun/retrigger/retry/merge conflict/resolve conflicts",
        "other": "none of the above (dispatch commands are removed before classification)",
        "order": "nit, ack, process, question, change_request, other (first match wins)",
    },
    "roundCollapseMinutes": ROUND_COLLAPSE_SECONDS // 60,
    "dedupeWindowSeconds": DEDUPE_SECONDS,
    "minN": MIN_N,
    "weekBucket": "monday-utc",
    "states": STATES,
    "truncation": (
        "First page per sub-resource: 100 reviews, 50 threads x 30 comments, 100 "
        "conversation comments. A PR in the window that runs past any of them is "
        "completed with follow-up node() queries before it is counted "
        "(perPR[].pagesFetched is the audit trail: pages per connection, including "
        "the first). truncated means still short after the follow-ups and should "
        "be false on a live run; a fixture without node ids can still trip it."
    ),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2026-04-10", help="YYYY-MM-DD window start")
    ap.add_argument("--repos", default=",".join(DEFAULT_REPOS),
                    help="comma-separated owner/name list")
    ap.add_argument("--install-id", default=DEFAULT_INSTALL)
    ap.add_argument("--json", default=None)
    ap.add_argument("--fixture", default=None,
                    help="read raw GraphQL PR nodes from this JSON file ({repo: [nodes]}) "
                         "instead of GitHub; for dry runs and tests")
    args = ap.parse_args()

    since_iso = f"{args.since}T00:00:00Z"
    repos = [r.strip() for r in args.repos.split(",") if r.strip()]
    col = Collection()
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = {
        "schema": SCHEMA,
        "generatedAt": generated_at,
        "since": args.since,
        "metric": "review-cycles",
        "definition": DEFINITION,
        "window": {"since": args.since, "states": STATES, "repos": repos,
                   "weekBucket": "monday-utc", "activityEventsSince": since_iso},
        "complete": False,
        "errors": col.errors,
        "warnings": col.warnings,
    }

    def publish(code):
        """Single exit path. Series ship ONLY from a complete run, so
        complete:false + a populated errors[] is the dashboard's signal to render
        'collection broken' instead of a number."""
        doc["complete"] = col.ok
        if args.json:
            write_json(args.json, doc)
            print(f"wrote {args.json}")
        if not col.ok:
            print(f"INCOMPLETE collection: {len(col.errors)} error(s); metrics withheld",
                  file=sys.stderr)
            for e in col.errors[:10]:
                first = e["detail"].splitlines()[0] if e["detail"] else ""
                print(f"  {e['what']}: {first}", file=sys.stderr)
        for w in col.warnings[:10]:
            print(f"  warning {w['what']}: {w['detail']}", file=sys.stderr)
        return code

    nodes_by_repo = {}
    if args.fixture:
        try:
            with open(args.fixture) as f:
                nodes_by_repo = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            col.fail("fixture", f"{type(e).__name__}: {e}")
            return publish(1)
        if not isinstance(nodes_by_repo, dict):
            col.fail("fixture", "expected an object {repo: [nodes]}")
            return publish(1)
    else:
        token = mint_token(col, args.install_id)
        if token is None:
            return publish(1)
        for repo in repos:
            nodes = collect_repo(col, token, repo, since_iso)
            if nodes is None:
                # A repo failed mid-collection. Everything below would print
                # numbers a reader could not tell apart from a real result.
                return publish(1)
            nodes_by_repo[repo] = nodes

    if not col.ok:
        return publish(1)
    try:
        series = build_snapshot(nodes_by_repo, args.since, repos, now=generated_at, col=col)
    except Exception as e:  # noqa: BLE001 - deliberately blind: see the next comment
        # An aggregation bug must land as complete:false, not as a traceback
        # that exits 1 and leaves the previous snapshot in place looking
        # current (the dashboard's stale marker only fires after 36 h).
        col.fail("aggregate", repr(e))
        return publish(1)
    if not series["perPR"]:
        col.fail("prs", "no PRs in window; nothing to measure")
        return publish(2)
    doc.update(series)

    t = doc["totals"]
    bt, ht = t["botAuthored"], t["humanAuthored"]
    print(f"review-cycles v2: {t['prs']} PRs ({t['mergedPrs']} merged / {t['openPrs']} open / "
          f"{t['closedPrs']} closed) across {len(repos)} repo(s) since {args.since}: "
          f"{bt['prs']} bot / {ht['prs']} human / {t['automationAuthoredPrs']} other automation"
          f" / {t['unknownAuthoredPrs']} unknown author")
    print(f"  ROUNDS per PR   bot mean {bt['rounds']['mean']} median {bt['rounds']['median']}  |  "
          f"human mean {ht['rounds']['mean']} median {ht['rounds']['median']}")
    print(f"  COMMENTS per PR bot mean {bt['comments']['mean']} median {bt['comments']['median']}  |  "
          f"human mean {ht['comments']['mean']} median {ht['comments']['median']}")
    fl = doc["filters"]
    print(f"  removed: automation {fl['removedAutomation']} "
          f"(board-sync {fl['removedAutomationByReason']['boardSyncNotice']}), "
          f"commands {fl['removedCommands']}, duplicates {fl['dedupedDuplicates']}, "
          f"self {fl['removedSelf']}")
    print(f"  {len(doc['weeklyByActivity'])} activity week(s), {len(doc['weeklyByMerge'])} merge week(s)")
    trunc = t["reviewTruncatedPrs"]
    if trunc:
        print(f"  NOTE: {trunc} PR(s) still short of a sub-resource after the follow-up "
              "pass; their counts are a floor.")
    return publish(0)


if __name__ == "__main__":
    sys.exit(main())
