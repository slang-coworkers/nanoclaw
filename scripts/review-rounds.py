#!/usr/bin/env python3
"""review-rounds — how much human review does a PR draw, bot vs human, over time?

Companion to bot-contributions (throughput) and regression-quality (does the
work hold up). This one prices the REVIEW friction: when the bot opens a PR, how
much human back-and-forth does it draw before it merges — and is that converging
toward, or below, the friction a human-authored PR draws?

Uses the GitHub GraphQL API: one query per repo page pulls each PR's author, its
review list, its inline review THREADS, and its conversation COMMENTS in a single
round-trip (the REST equivalent is several calls per PR). Auth is the shader-slang
GitHub-App installation token, minted by the local helper and passed to a direct
`curl --noproxy '*'` so a leaked http_proxy can't tunnel the request through the
OneCLI gateway (same rule funnel-cron enforces).

WHAT COUNTS (the definitions, stated here so a reader cannot infer the wrong one):

  HEADLINE — a human-review CYCLE. `cycles` = (human-initiated inline review
  THREADS) + (human conversation COMMENTS). Each distinct locus of human feedback
  — an inline discussion thread a human opened, or a top-level PR conversation
  remark — is one cycle of back-and-forth. Inline feedback is counted by THREAD
  (`pullRequest.reviewThreads`, thread attributed to its opening comment's
  author), NOT by formal review submission, so a single "changes requested"
  review carrying three inline threads reads as three cycles of discussion rather
  than one. Conversation comments are `pullRequest.comments` (the issue-level
  back-and-forth). This is the number that lines up with the published
  "Avg human review cycles / PR" slide — calibrated against 129 real bot PRs in
  shader-slang/slang (merged 2026-06-22..08-02) it means ~2.9 cycles/PR overall
  and tracks the slide's per-week 2.5–4.2 band (mean abs error ~0.75, the closest
  of the candidate definitions tested: threads+comments beat submissions-only
  (~2.3), threads-only (~1.6), and submissions+comments (~3.6)).

  SECONDARY — a human-review ROUND. `rounds` = reviews submitted with state
  CHANGES_REQUESTED by a human (non-bot, non-author) — the strict "a human sent
  it back" count. Near-zero on these repos (most review lands as COMMENTED, not
  CHANGES_REQUESTED), kept beside the headline, never as it.

  SECONDARY — `submissions` = every human review submission (APPROVED +
  CHANGES_REQUESTED + COMMENTED). Its components `threads` and `issueComments`
  ship too, so the cycle number is fully decomposable.

  Excluded from every human count: our own bot (nv-slang-bot), CI/automation
  (github-actions, dependabot, copilot / copilot-pull-request-reviewer,
  devin-ai-integration), anything the API tags __typename==Bot or whose login
  ends in "[bot]", and the PR author's own comments/reviews (self-review is not
  review a human PAID).

  NOTE this shares no code with the reviewCycles panel (funnel.ts /
  funnel-metrics.ts), which prices feedback SESSIONS with a session-collapsed
  rule; this producer is a deliberately simpler per-thread / per-comment census.

AUTHOR CLASS: a PR is bot-authored iff its author login normalises to
`nv-slang-bot`. That is the GitHub-App bot `app/nv-slang-bot` (GraphQL returns it
as the Bot actor `nv-slang-bot`; REST/search spell it `nv-slang-bot[bot]`; the
plain USER `nv-slang-bot` authors ≈0 PRs — see bot-contributions.ts). We
normalise (`[bot]` stripped, lower-cased) before comparing so every spelling of
the App bot is caught. Everything else is human-authored; other automation
authoring PRs (e.g. dependabot) is negligible here and would fall in "human" —
documented, not silently folded into "bot".

SCOPE: MERGED PRs only, over the last ~6 months (--since, default 2026-04-10),
across --repos (default the three shader-slang product repos). OPEN PRs are
excluded on purpose: the metric buckets by MERGE WEEK, and an open PR has no
merge week to bucket into. The published slide is scoped to shader-slang/slang
alone, so alongside the combined `weekly`/`totals` the snapshot also carries a
`perRepo` breakdown — a slang-only reader matches the slide, the combined total
prices the whole pipeline.

AGGREGATION: each merged PR is bucketed by the Monday (UTC) of the week it
merged. Per week and per author class we emit
  { prs, avgCycles, medianCycles, p90Cycles, avgRounds, medianRounds, p90Rounds,
    zeroRoundPct, avgSubmissions, avgThreads, avgIssueComments }
where zeroRoundPct is the share of that week's merged PRs that took 0
change-requested rounds (the clean-first-pass rate).

FAIL CLOSED. Every fetch runs through Collection; the first failure marks the run
INCOMPLETE and the snapshot is written with complete:false, a populated errors[],
and NO weekly metrics, then the process exits nonzero. A collector that broke
must never be indistinguishable from a genuinely quiet week — an outage that
published a clean zero would read as "review got easier". The incomplete snapshot
overwrites the previous one on purpose, so the dashboard can see that its data is
broken rather than render last week's numbers as today's.

  python3 scripts/review-rounds.py [--since YYYY-MM-DD] [--repos a/b,c/d]
      [--install-id N] [--json <out>]

Exit codes: 0 = complete, 1 = incomplete collection, 2 = nothing to measure.
"""
import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone

SCHEMA = 2

TOKEN_SCRIPT = f"{os.environ.get('HOME', '')}/.config/nanoclaw/gh-app-token.py"
# shader-slang org installation id — the same one bot-contributions.ts and
# funnel.ts mint against. The product repos live here.
DEFAULT_INSTALL = "122982130"
DEFAULT_REPOS = ["shader-slang/slang", "shader-slang/slangpy", "shader-slang/slang-rhi"]
GRAPHQL = "https://api.github.com/graphql"

# Our bot, matched normalised (see is_bot_author). Narrow set: this is the
# AUTHOR-class question ("was this PR ours?"), so only nv-slang-bot counts.
OUR_BOT = {"nv-slang-bot"}
# Broader: any actor that is not a human paying review attention. Used only to
# EXCLUDE reviewers/commenters from the cycle/round/submission counts. Mirrors the
# reviewer exclusion in scripts/funnel-metrics.ts (kept as a local literal —
# python can't import the TS; the header notes they must stay in sync).
BOT_REVIEWERS = {
    "nv-slang-bot",
    "github-actions",
    "dependabot",
    "copilot",
    "copilot-pull-request-reviewer",
    "devin-ai-integration",
}


def normalise_login(login):
    return re.sub(r"\[bot\]$", "", (login or "").strip(), flags=re.IGNORECASE).lower()


def is_bot_author(actor):
    """A PR authored by our bot. actor = {login, __typename} or None."""
    if not actor:
        return False
    return normalise_login(actor.get("login")) in OUR_BOT


def is_bot_actor(actor):
    """A reviewer/commenter that is not human review attention."""
    if not actor:
        return True  # ghost/unknown — do not credit it as human attention
    login = (actor.get("login") or "").strip()
    if actor.get("__typename") == "Bot":
        return True
    if re.search(r"\[bot\]$", login, flags=re.IGNORECASE):
        return True
    return normalise_login(login) in BOT_REVIEWERS


def merge_week(iso):
    """Monday (UTC) of the ISO week the timestamp falls in, as YYYY-MM-DD."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    monday = dt - timedelta(days=dt.weekday())
    return monday.date().isoformat()


class Collection:
    """Records every fetch/parse failure so no caller can launder one into a
    zero. Callers keep going after a failure (to surface as many problems as
    possible in one run) but `ok` stays False and the run publishes INCOMPLETE.
    """

    def __init__(self):
        self.ok = True
        self.errors = []

    def fail(self, what, detail):
        self.ok = False
        self.errors.append({"what": what, "detail": str(detail).strip()[:400]})


def mint_token(col):
    try:
        r = subprocess.run(
            ["python3", TOKEN_SCRIPT, "--install-id", ARGS.install_id],
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


def graphql(col, token, query, variables, what):
    """POST a GraphQL query via direct curl. Returns the `data` object, or None
    on any transport / GraphQL-error / parse failure (recorded on col)."""
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
    try:
        r = subprocess.run(cmd, input=body, capture_output=True, text=True,
                           timeout=180, check=False)
    except (OSError, subprocess.SubprocessError) as e:
        col.fail(what, f"{type(e).__name__}: {e}")
        return None
    if r.returncode != 0:
        col.fail(what, f"curl rc={r.returncode}: {(r.stderr or r.stdout)[:300]}")
        return None
    try:
        doc = json.loads(r.stdout)
    except json.JSONDecodeError as e:
        col.fail(what, f"unparseable response: {e}: {r.stdout[:200]}")
        return None
    if doc.get("errors"):
        col.fail(what, f"graphql errors: {json.dumps(doc['errors'])[:300]}")
        return None
    data = doc.get("data")
    if data is None:
        col.fail(what, "graphql returned no data")
        return None
    return data


# One page pulls each PR's author, review list, inline review threads (with just
# the opening comment's author, so a thread is attributed to whoever started it),
# and conversation comments — everything the cycle/round/submission counts need.
PR_QUERY = """
query($owner:String!, $name:String!, $cursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequests(first:25, after:$cursor, states:[MERGED],
                 orderBy:{field:UPDATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        mergedAt
        author { login __typename }
        reviews(first:100) {
          totalCount
          nodes { state author { login __typename } }
        }
        reviewThreads(first:100) {
          totalCount
          nodes { comments(first:1) { nodes { author { login __typename } } } }
        }
        comments(first:100) {
          totalCount
          nodes { author { login __typename } }
        }
      }
    }
  }
}
"""


def pr_facts(pr):
    """Per-PR review facts for one PullRequest node, or None if it never merged."""
    merged_at = pr.get("mergedAt")
    if not merged_at:
        return None
    author = pr.get("author")
    author_login = normalise_login((author or {}).get("login"))

    def is_self(actor):
        return bool(author_login) and normalise_login((actor or {}).get("login")) == author_login

    reviews = pr.get("reviews") or {}
    rnodes = reviews.get("nodes") or []
    rounds = 0
    submissions = 0
    for rv in rnodes:
        ra = rv.get("author")
        if is_bot_actor(ra) or is_self(ra):
            continue
        state = rv.get("state")
        if state in ("APPROVED", "CHANGES_REQUESTED", "COMMENTED"):
            submissions += 1
        if state == "CHANGES_REQUESTED":
            rounds += 1

    rt = pr.get("reviewThreads") or {}
    tnodes = rt.get("nodes") or []
    threads = 0
    for th in tnodes:
        cs = (th.get("comments") or {}).get("nodes") or []
        starter = cs[0].get("author") if cs else None
        if is_bot_actor(starter) or is_self(starter):
            continue
        threads += 1

    cc = pr.get("comments") or {}
    cnodes = cc.get("nodes") or []
    issue_comments = 0
    for c in cnodes:
        ca = c.get("author")
        if is_bot_actor(ca) or is_self(ca):
            continue
        issue_comments += 1

    # >100 of any sub-resource means the first-page window truncated it and the
    # counts are a FLOOR for this PR — flag it rather than silently undercount.
    truncated = (
        (reviews.get("totalCount") or 0) > len(rnodes)
        or (rt.get("totalCount") or 0) > len(tnodes)
        or (cc.get("totalCount") or 0) > len(cnodes)
    )
    return {
        "number": pr.get("number"),
        "mergedAt": merged_at,
        "bot": is_bot_author(author),
        "rounds": rounds,
        "submissions": submissions,
        "threads": threads,
        "issueComments": issue_comments,
        "cycles": threads + issue_comments,
        "truncated": truncated,
    }


def collect_repo(col, token, repo, since_iso):
    """Per-PR review facts for one repo's merged PRs newer than since_iso, or None
    on failure. Pages newest-updated first; stops when a whole page merged before
    the window."""
    owner, name = repo.split("/", 1)
    cursor = None
    out = []
    for _ in range(400):  # backstop; >10000 merged PRs is not real here
        data = graphql(col, token, PR_QUERY, {"owner": owner, "name": name, "cursor": cursor},
                       what=f"{repo} pullRequests")
        if data is None:
            return None
        repo_obj = (data or {}).get("repository")
        if repo_obj is None:
            col.fail(f"{repo}", "repository not visible to this installation token")
            return None
        conn = repo_obj.get("pullRequests") or {}
        nodes = conn.get("nodes") or []
        in_window_any = False
        for pr in nodes:
            f = pr_facts(pr)
            if f is None or f["mergedAt"] < since_iso:
                continue
            in_window_any = True
            f["repo"] = repo
            out.append(f)
        page = conn.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        if nodes and not in_window_any:
            break
        cursor = page.get("endCursor")
        time.sleep(0.3)  # gentle; GraphQL point budget is ample
    return out


def percentile(values, pct):
    """Nearest-rank percentile of a list of numbers. [] -> None."""
    if not values:
        return None
    s = sorted(values)
    k = max(0, min(len(s) - 1, round((pct / 100.0) * (len(s) - 1))))
    return s[k]


def summarise(prs):
    """Aggregate one bucket of PR records."""
    n = len(prs)
    if n == 0:
        return {"prs": 0, "avgCycles": None, "medianCycles": None, "p90Cycles": None,
                "avgRounds": None, "medianRounds": None, "p90Rounds": None,
                "zeroRoundPct": None, "avgSubmissions": None,
                "avgThreads": None, "avgIssueComments": None}
    cycles = [p["cycles"] for p in prs]
    rounds = [p["rounds"] for p in prs]
    zero = sum(1 for r in rounds if r == 0)
    return {
        "prs": n,
        "avgCycles": round(statistics.fmean(cycles), 2),
        "medianCycles": round(statistics.median(cycles), 2),
        "p90Cycles": percentile(cycles, 90),
        "avgRounds": round(statistics.fmean(rounds), 2),
        "medianRounds": round(statistics.median(rounds), 2),
        "p90Rounds": percentile(rounds, 90),
        "zeroRoundPct": round(100 * zero / n, 1),
        "avgSubmissions": round(statistics.fmean(p["submissions"] for p in prs), 2),
        "avgThreads": round(statistics.fmean(p["threads"] for p in prs), 2),
        "avgIssueComments": round(statistics.fmean(p["issueComments"] for p in prs), 2),
    }


def weekly_of(prs):
    """[{week, botAuthored, humanAuthored}] over the merge weeks present in prs."""
    weeks = {}
    for p in prs:
        wk = merge_week(p["mergedAt"])
        weeks.setdefault(wk, {"bot": [], "human": []})
        weeks[wk]["bot" if p["bot"] else "human"].append(p)
    return [
        {"week": wk, "botAuthored": summarise(weeks[wk]["bot"]),
         "humanAuthored": summarise(weeks[wk]["human"])}
        for wk in sorted(weeks)
    ]


def class_totals(prs):
    return {
        "prs": len(prs),
        "botAuthored": summarise([p for p in prs if p["bot"]]),
        "humanAuthored": summarise([p for p in prs if not p["bot"]]),
        "reviewTruncatedPrs": sum(1 for p in prs if p["truncated"]),
    }


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


DEFINITION = (
    "A human-review CYCLE = one human-initiated inline review THREAD "
    "(reviewThreads, attributed to its opening comment's author) + one human "
    "conversation COMMENT (issue-level), counting inline feedback by thread rather "
    "than by formal review submission. Bot/CI reviewers and self-reviews are "
    "excluded. SECONDARY: rounds = human CHANGES_REQUESTED reviews (strict "
    "sent-back count); submissions = all human review submissions "
    "(APPROVED+CHANGES_REQUESTED+COMMENTED). MERGED PRs only, bucketed by merge "
    "week (Monday UTC)."
)

ARGS = None


def main():
    global ARGS
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2026-04-10", help="YYYY-MM-DD merge-window start")
    ap.add_argument("--repos", default=",".join(DEFAULT_REPOS),
                    help="comma-separated owner/name list")
    ap.add_argument("--install-id", default=DEFAULT_INSTALL)
    ap.add_argument("--json", default=None)
    ARGS = ap.parse_args()

    since_iso = f"{ARGS.since}T00:00:00Z"
    repos = [r.strip() for r in ARGS.repos.split(",") if r.strip()]
    col = Collection()
    doc = {
        "schema": SCHEMA,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "since": ARGS.since,
        "definition": DEFINITION,
        "metric": "review-cycles",
        "window": {"since": ARGS.since, "states": ["MERGED"], "repos": repos,
                   "weekBucket": "merge-week-monday-utc"},
        "complete": False,
        "errors": col.errors,
    }

    def publish(code):
        """Single exit path. Metrics ship ONLY from a complete run, so
        complete:false + a populated errors[] is the dashboard's signal to render
        'collection broken' instead of a number."""
        doc["complete"] = col.ok
        if ARGS.json:
            write_json(ARGS.json, doc)
            print(f"wrote {ARGS.json}")
        if not col.ok:
            print(f"INCOMPLETE collection — {len(col.errors)} error(s); metrics withheld",
                  file=sys.stderr)
            for e in col.errors[:10]:
                first = e["detail"].splitlines()[0] if e["detail"] else ""
                print(f"  {e['what']}: {first}", file=sys.stderr)
        return code

    token = mint_token(col)
    if token is None:
        return publish(1)

    by_repo = {}
    all_prs = []
    for repo in repos:
        rows = collect_repo(col, token, repo, since_iso)
        if rows is None:
            # A repo failed mid-collection. Everything below would print numbers a
            # reader could not tell apart from a real result.
            return publish(1)
        by_repo[repo] = rows
        all_prs.extend(rows)

    if not col.ok:
        return publish(1)
    if not all_prs:
        col.fail("prs", "no merged PRs in window — nothing to measure")
        return publish(2)

    doc.update({
        "totals": class_totals(all_prs),
        "weekly": weekly_of(all_prs),
        # Per-repo breakdown so a slang-only reader matches the published slide,
        # while the combined weekly/totals above price the whole pipeline. Repos
        # with no in-window merges are omitted.
        "perRepo": {repo: {"totals": class_totals(rows), "weekly": weekly_of(rows)}
                    for repo, rows in by_repo.items() if rows},
    })

    bt = doc["totals"]["botAuthored"]
    ht = doc["totals"]["humanAuthored"]
    print(f"review-cycles — {len(all_prs)} merged PRs across {len(repos)} repo(s) since {ARGS.since}: "
          f"{bt['prs']} bot / {ht['prs']} human, {len(doc['weekly'])} week bucket(s)")
    print(f"  avg human review CYCLES/PR — bot {bt['avgCycles']}  human {ht['avgCycles']}  "
          f"(bot: {bt['avgThreads']} threads + {bt['avgIssueComments']} comments; "
          f"strict CHANGES_REQUESTED rounds bot {bt['avgRounds']}/human {ht['avgRounds']})")
    trunc = doc["totals"]["reviewTruncatedPrs"]
    if trunc:
        print(f"  NOTE: {trunc} PR(s) had >100 reviews/threads/comments; their counts are a floor.")
    return publish(0)


if __name__ == "__main__":
    sys.exit(main())
