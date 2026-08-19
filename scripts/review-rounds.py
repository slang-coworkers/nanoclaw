#!/usr/bin/env python3
"""review-rounds — how many human-review rounds does a PR need, bot vs human?

Companion to bot-contributions (throughput) and regression-quality (does the
work hold up). This one prices the REVIEW friction: when the bot opens a PR, how
many times does a human have to send it back before it merges — and is that
converging toward, or below, the friction a human-authored PR draws?

Uses the GitHub GraphQL API (one query per repo page pulls each PR's author and
its full review list in a single round-trip; the REST equivalent is one call per
PR). Auth is the shader-slang GitHub-App installation token, minted by the local
helper and passed to a direct `curl --noproxy '*'` so a leaked http_proxy can't
tunnel the request through the OneCLI gateway (same rule funnel-cron enforces).

WHAT COUNTS AS A ROUND (the definition, stated here so a reader cannot infer the
wrong one):

  A human-review ROUND is one review submitted with state CHANGES_REQUESTED by a
  reviewer who is neither a bot/CI actor nor the PR's own author — i.e. one time
  a human read the diff and sent it back. `rounds` for a PR is the count of such
  reviews. Zero rounds = the PR merged without a human ever requesting changes (a
  clean first pass, though it may still have drawn APPROVED/COMMENTED reviews).

  Excluded reviewers: our own bot (nv-slang-bot), CI/automation (github-actions,
  dependabot, copilot-pull-request-reviewer, devin-ai-integration), anything the
  API tags __typename==Bot or whose login ends in "[bot]", and the PR author's
  own self-reviews (GitHub records those and they are not review a human PAID).

  SECONDARY, reported beside the headline and never as it: `submissions` = every
  human review submission on the PR (APPROVED + CHANGES_REQUESTED + COMMENTED),
  same reviewer-exclusion rules. A COMMENTED review is real human attention even
  when it requests no changes; CHANGES_REQUESTED is the strict "sent back" count.
  The two are kept apart on purpose — see the reviewCycles panel, which prices
  feedback SESSIONS with a different (session-collapsed) rule; this producer is
  deliberately a simpler, per-submission census and does not share its code.

AUTHOR CLASS: a PR is bot-authored iff its author login normalises to
`nv-slang-bot` (the App bot appears as both `nv-slang-bot` and `nv-slang-bot[bot]`
across API surfaces; we normalise before comparing). Everything else is
human-authored. Other automation authoring PRs (e.g. dependabot) is negligible
in the shader-slang product repos and would fall in "human"; documented, not
silently folded into "bot".

SCOPE: MERGED PRs only, over the last ~6 months (--since, default 2026-04-10).
OPEN PRs are excluded on purpose: the metric buckets by MERGE WEEK, and an open
PR has no merge week to bucket into — including it would either drop it or need a
second, incomparable time axis. Merged-only also matches "friction a SHIPPED PR
drew", which is the question.

AGGREGATION: each merged PR is bucketed by the Monday (UTC) of the week it
merged. Per week and per author class we emit
  { prs, avgRounds, medianRounds, p90Rounds, zeroRoundPct, avgSubmissions }
where zeroRoundPct is the share of that week's merged PRs that took 0
change-requested rounds (the clean-first-pass rate).

FAIL CLOSED. Every fetch runs through Collection; the first failure marks the run
INCOMPLETE and the snapshot is written with complete:false, a populated errors[],
and NO weekly metrics, then the process exits nonzero. A collector that broke
must never be indistinguishable from a genuinely quiet, zero-round week — an
outage that published a clean zero would read as "review got easier". The
incomplete snapshot overwrites the previous one on purpose, so the dashboard can
see that its data is broken rather than render last week's numbers as today's.

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

SCHEMA = 1

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
# EXCLUDE reviewers from the round/submission counts. Mirrors the reviewer
# exclusion in scripts/funnel-metrics.ts (kept as a local literal — python can't
# import the TS; the header notes they must stay in sync).
BOT_REVIEWERS = {
    "nv-slang-bot",
    "github-actions",
    "dependabot",
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


def is_bot_reviewer(actor):
    """A reviewer that is not human review cost."""
    if not actor:
        return True  # ghost/unknown reviewer — do not credit it as human attention
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


PR_QUERY = """
query($owner:String!, $name:String!, $cursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequests(first:40, after:$cursor, states:[MERGED],
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
      }
    }
  }
}
"""


def collect_repo(col, token, repo, since_iso):
    """Yield per-PR review facts for one repo's merged PRs newer than since_iso.

    PRs come newest-updated first; a merged PR's mergedAt is stable, so we page
    until every node on a page merged before `since` (updated-order means a late
    page can still hold an in-window PR, so we filter per-node and stop only when
    a whole page is out of window)."""
    owner, name = repo.split("/", 1)
    cursor = None
    out = []
    for _ in range(200):  # backstop; a repo with >8000 merged PRs is not real here
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
            merged_at = pr.get("mergedAt")
            if not merged_at:
                continue
            if merged_at < since_iso:
                continue
            in_window_any = True
            reviews = pr.get("reviews") or {}
            rnodes = reviews.get("nodes") or []
            total = reviews.get("totalCount") or 0
            author = pr.get("author")
            author_login = normalise_login((author or {}).get("login"))
            changes = 0
            submissions = 0
            for rv in rnodes:
                ra = rv.get("author")
                if is_bot_reviewer(ra):
                    continue
                if normalise_login((ra or {}).get("login")) == author_login and author_login:
                    continue  # self-review is not review a human paid
                state = rv.get("state")
                if state in ("APPROVED", "CHANGES_REQUESTED", "COMMENTED"):
                    submissions += 1
                if state == "CHANGES_REQUESTED":
                    changes += 1
            out.append({
                "repo": repo,
                "number": pr.get("number"),
                "mergedAt": merged_at,
                "bot": is_bot_author(author),
                "rounds": changes,
                "submissions": submissions,
                # A PR with >100 review submissions would truncate the first-page
                # window and undercount both numbers — flag it so the aggregate
                # can be read as a floor for that PR rather than silently wrong.
                "truncated": total > len(rnodes),
            })
        page = conn.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        # Newest-updated first: once a full page holds no in-window merge, older
        # pages cannot either (mergedAt <= updatedAt is not guaranteed, but a page
        # of 40 all-out-of-window merges is a safe stop for a 6-month window).
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
    k = max(0, min(len(s) - 1, int(round((pct / 100.0) * (len(s) - 1)))))
    return s[k]


def summarise(prs):
    """Aggregate one week/class bucket of PR records."""
    rounds = [p["rounds"] for p in prs]
    subs = [p["submissions"] for p in prs]
    n = len(prs)
    if n == 0:
        return {"prs": 0, "avgRounds": None, "medianRounds": None, "p90Rounds": None,
                "zeroRoundPct": None, "avgSubmissions": None}
    zero = sum(1 for r in rounds if r == 0)
    return {
        "prs": n,
        "avgRounds": round(statistics.fmean(rounds), 2),
        "medianRounds": round(statistics.median(rounds), 2),
        "p90Rounds": percentile(rounds, 90),
        "zeroRoundPct": round(100 * zero / n, 1),
        "avgSubmissions": round(statistics.fmean(subs), 2),
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
    "A human-review round = one CHANGES_REQUESTED review by a non-bot, non-author "
    "reviewer (a human sending the PR back). Bot/CI reviewers and self-reviews are "
    "excluded. avgSubmissions (secondary) counts all human review submissions "
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

    all_prs = []
    for repo in repos:
        rows = collect_repo(col, token, repo, since_iso)
        if rows is None:
            # A repo failed mid-collection. Everything below would print numbers a
            # reader could not tell apart from a real result.
            return publish(1)
        all_prs.extend(rows)

    if not col.ok:
        return publish(1)
    if not all_prs:
        col.fail("prs", "no merged PRs in window — nothing to measure")
        return publish(2)

    # Bucket weekly, then per class.
    weeks = {}
    for p in all_prs:
        wk = merge_week(p["mergedAt"])
        weeks.setdefault(wk, {"bot": [], "human": []})
        weeks[wk]["bot" if p["bot"] else "human"].append(p)

    weekly = []
    for wk in sorted(weeks):
        weekly.append({
            "week": wk,
            "botAuthored": summarise(weeks[wk]["bot"]),
            "humanAuthored": summarise(weeks[wk]["human"]),
        })

    bot_all = [p for p in all_prs if p["bot"]]
    human_all = [p for p in all_prs if not p["bot"]]
    truncated = sum(1 for p in all_prs if p["truncated"])

    doc.update({
        "totals": {
            "prs": len(all_prs),
            "botAuthored": summarise(bot_all),
            "humanAuthored": summarise(human_all),
            "reviewTruncatedPrs": truncated,
        },
        "weekly": weekly,
    })

    print(f"review-rounds — {len(all_prs)} merged PRs across {len(repos)} repo(s) since {ARGS.since}: "
          f"{len(bot_all)} bot / {len(human_all)} human, {len(weekly)} week bucket(s)")
    bt, ht = doc["totals"]["botAuthored"], doc["totals"]["humanAuthored"]
    print(f"  avg CHANGES_REQUESTED rounds/PR — bot {bt['avgRounds']}  human {ht['avgRounds']}  "
          f"(clean-first-pass: bot {bt['zeroRoundPct']}%  human {ht['zeroRoundPct']}%)")
    if truncated:
        print(f"  NOTE: {truncated} PR(s) had >100 review submissions; their counts are a floor.")
    return publish(0)


if __name__ == "__main__":
    sys.exit(main())
