#!/usr/bin/env bash
# pull-universe.sh — Exhaustive chain universe pull for scan.py.
#
# Runs inside the orchestrator container. Enumerates ALL gh-issue-* sessions
# via ncl, resolves each chain's PR + comments + last outbound via gh/ncl,
# and writes the full scan.py input JSON to stdout.
#
# Uses batched GraphQL queries to fetch issue state, comments, PR discovery,
# and PR details in 2-4 API calls instead of ~225 individual REST calls.
#
# Usage:
#   bash scripts/pull-universe.sh [--state /path/to/supervisor-state.json] [--include-closed]
#                                 [--cache-dir DIR [--budget-s N]]
#
# --cache-dir switches to the incremental pull the hourly gate uses
# (supervise-gate.py): GitHub data is refetched only for chains that changed
# since the last pull, and a session's last outbound only when it can have
# moved; everything else comes from DIR (bookkeeping in universe_cache.py).
# --budget-s bounds the refetching: once it is spent, the remaining chains keep
# their cached data, are marked `"cache_cold": true`, and are refetched first
# next run. Without --cache-dir the pull is the full one, as before.
#
# Requires: ncl, gh, python3
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Sub-second start time: --budget-s counts from here, so Step 1's ncl calls are inside it.
START_EPOCH=$(python3 -c 'import time; print(time.time())')

# Scratch dir for passing large JSON blobs between steps via files instead of
# argv (argv overflows "Argument list too long" once the chain universe grows
# past ~170 chains / ~0.5MB payloads).
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT

STATE_FILE=""
INCLUDE_CLOSED=false
CACHE_DIR=""
BUDGET_S=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --state) STATE_FILE="$2"; shift 2 ;;
    --include-closed) INCLUDE_CLOSED=true; shift ;;
    --cache-dir) CACHE_DIR="$2"; shift 2 ;;
    --budget-s) BUDGET_S="$2"; shift 2 ;;
    *) shift ;;
  esac
done

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# --- 1. Pull all sessions, filter to gh-issue-*, stamp each with its agent
#        group's folder (the role signal scan.py needs to tell a fixer-owned
#        chain apart from a triage-only one — see scan.py we_owe_next_step). ---
ALL_SESSIONS=$(ncl sessions list --limit 10000 --json 2>/dev/null)
ALL_GROUPS=$(ncl groups list --json 2>/dev/null)
GH_SESSIONS=$(GROUPS_JSON="$ALL_GROUPS" python3 -c '
import json, os, sys
data = json.load(sys.stdin)["data"]
# agent_group_id -> folder map (best-effort; absent -> "" -> non-fixer, current behavior)
folder_by_group = {}
try:
    for g in (json.loads(os.environ.get("GROUPS_JSON") or "{}").get("data") or []):
        if g.get("id"):
            folder_by_group[g["id"]] = g.get("folder") or ""
except (json.JSONDecodeError, AttributeError, TypeError):
    pass
gh = []
for s in data:
    if not (s.get("thread_id") or "").startswith("gh-issue-"):
        continue
    s["group_folder"] = folder_by_group.get(s.get("agent_group_id"), "")
    gh.append(s)
json.dump(gh, sys.stdout)
' <<<"$ALL_SESSIONS")

# --- 1b. Stamp each gh-issue session with its live cost-cap status. scan.py's
#         classify() short-circuits a nudge for a session that's deliberately
#         `stopped` pending a human cost decision (dashboard Continue/Stop),
#         instead of reading the resulting long silence as ordinary staleness —
#         see scan.py::any_session_cost_stopped. One `ncl cost-cap stopped`
#         call returns the live stopped set (the predicate the dashboard's
#         stopped filter uses), so every session is 'stopped' or 'ok' from a
#         single mailbox round-trip. A per-session `ncl cost-cap status` loop
#         costs one round-trip per session — over an hour for the 5,500+
#         gh-issue sessions on prod. When the call fails, every session is
#         'unknown', which scan.py treats as "no signal" (never cost_stopped). ---
printf '%s' "$GH_SESSIONS" > "$TMPD/gh_sessions_precost.json"
GH_SESSIONS=$(python3 - "$TMPD/gh_sessions_precost.json" <<'PY'
import json
import subprocess
import sys

with open(sys.argv[1]) as f:
    sessions = json.load(f)


def stopped_session_ids():
    """Ids of the sessions that are cost-stopped right now, or None when the call fails."""
    try:
        r = subprocess.run(
            ["ncl", "cost-cap", "stopped", "--json"],
            capture_output=True, text=True, timeout=60)
        if r.returncode != 0 or not r.stdout.strip():
            return None
        parsed = json.loads(r.stdout)
        rows = (parsed.get("data") or {}).get("stopped") if isinstance(parsed, dict) else None
        if not isinstance(rows, list):
            return None
        return {row.get("session_id") for row in rows if isinstance(row, dict) and row.get("session_id")}
    except Exception:
        return None


stopped_ids = stopped_session_ids()
if stopped_ids is None:
    print("pull-universe: ncl cost-cap stopped failed; cost_status is 'unknown' for every session",
          file=sys.stderr)
stopped = 0
for s in sessions:
    if stopped_ids is None or not s.get("id"):
        status = "unknown"
    else:
        status = "stopped" if s["id"] in stopped_ids else "ok"
    s["cost_status"] = status
    if status == "stopped":
        stopped += 1

print(f"pull-universe: cost-cap status stamped for {len(sessions)} session(s), "
      f"{stopped} cost-stopped", file=sys.stderr)
json.dump(sessions, sys.stdout)
PY
)

# --- 2. Group sessions by thread_id, extract repo + issue number ---
THREADS=$(echo "$GH_SESSIONS" | python3 -c '
import json, sys, re
sessions = json.load(sys.stdin)
by_thread = {}
for s in sessions:
    t = s["thread_id"]
    by_thread.setdefault(t, []).append(s)
result = []
for t, slist in sorted(by_thread.items()):
    m = re.match(r"gh-issue-(.+/.+)-(\d+)$", t)
    if not m:
        continue
    repo, issue = m.group(1), int(m.group(2))
    sess_ids = [s["id"] for s in slist]
    result.append({"thread": t, "repo": repo, "issue": issue, "sessions": sess_ids})
json.dump(result, sys.stdout)
')

CHAIN_COUNT=$(echo "$THREADS" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
echo "pull-universe: $CHAIN_COUNT chains to fetch" >&2

# --- 3+4. Batch GraphQL: issue states + comments + PR discovery + PR details ---
# Heredoc (quoted 'PY') so the inline Python is passed verbatim — NOT re-parsed
# by bash. The previous `python3 -c '...'` form broke because Python single-
# quoted subscripts like t['issue'] closed the bash single-quote early.
# THREADS is passed via a file (argv-safe); INCLUDE_CLOSED via env.
printf '%s' "$THREADS" > "$TMPD/threads.json"

# Load prior supervisor-state now (not just at Step 5) so Step 4b can rehydrate
# each chain's disposition from the last tick — without it scan.py's
# HUMAN_OWNED_DISPOSITION gate always sees None and over-flags (see SKILL.md §3).
STATE="{}"
if [[ -n "$STATE_FILE" && -f "$STATE_FILE" ]]; then
  STATE=$(cat "$STATE_FILE")
fi
printf '%s' "$STATE" > "$TMPD/state.json"

# Read the big blobs from files (not argv) to avoid "Argument list too long".
# Step 4b reads each session's last_active / container_status from here for
# the cached pull; Step 5 puts the same file in the payload.
printf '%s' "$GH_SESSIONS" > "$TMPD/gh_sessions.json"

CACHE_DIR="$CACHE_DIR" BUDGET_S="$BUDGET_S" START_EPOCH="$START_EPOCH" PU_LIB_DIR="$HERE" \
INCLUDE_CLOSED="$INCLUDE_CLOSED" python3 - "$TMPD/threads.json" "$TMPD/state.json" "$TMPD/gh_sessions.json" <<'PY' > "$TMPD/chains.json"
import json, sys, subprocess, re, os, time
from concurrent.futures import ThreadPoolExecutor

with open(sys.argv[1]) as _f:
    threads = json.load(_f)
with open(sys.argv[2]) as _f:
    prior_state = json.load(_f)
with open(sys.argv[3]) as _f:
    sessions_by_id = {s["id"]: s for s in json.load(_f) if s.get("id")}
include_closed = os.environ["INCLUDE_CLOSED"] == "true"
bot_logins = {"nv-slang-bot[bot]", "nv-slang-bot"}
BATCH_SIZE = 50

# --- Cached pull (--cache-dir): the time box. The GitHub refetch stops starting
# new calls at GITHUB_SHARE of --budget-s and the outbound rereads at
# OUTBOUND_SHARE; the rest of the box covers the calls still in flight (each one
# has its own timeout) and writing the cache. ---
CACHE_DIR = os.environ.get("CACHE_DIR") or ""
BUDGET_S = float(os.environ.get("BUDGET_S") or 0)
START = float(os.environ.get("START_EPOCH") or time.time())
GITHUB_SHARE = 0.6
OUTBOUND_SHARE = 0.9
OUTBOUND_JOBS = 8


def budget_spent(share):
    """True once `share` of the --budget-s time box is used; never true without a budget."""
    return BUDGET_S > 0 and time.time() - START >= BUDGET_S * share


cache = None
if CACHE_DIR:
    sys.path.insert(0, os.environ["PU_LIB_DIR"])
    from datetime import datetime, timezone
    import universe_cache
    cache = universe_cache.UniverseCache(CACHE_DIR, datetime.now(timezone.utc))

def run(cmd, default=""):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return r.stdout.strip() if r.returncode == 0 else default
    except Exception:
        return default

def gh_graphql(query):
    """Execute a GraphQL query via gh api graphql.

    GraphQL is partial-success: an aliased batch where a few numbers don't
    resolve returns HTTP 200 with a valid `data` object AND an `errors` array,
    and `gh` exits non-zero for it. The old code treated rc!=0 as total failure
    and threw the whole batch away — one bad number (e.g. a chain keyed on a PR
    number, which `issue(number:)` 404s) collapsed PR discovery for all 50 in
    the batch (the "1/147 PRs" enrichment failure). Salvage the data whenever it
    parses and contains a `data` object; only bail when there's nothing usable.
    """
    r = subprocess.run(
        ["gh", "api", "graphql", "-f", f"query={query}"],
        capture_output=True, text=True, timeout=60)
    parsed = None
    if r.stdout.strip():
        try:
            parsed = json.loads(r.stdout)
        except json.JSONDecodeError:
            parsed = None
    if isinstance(parsed, dict) and parsed.get("data") is not None:
        errs = parsed.get("errors") or []
        if errs:
            # Partial success — keep the salvaged nodes, just note the misses.
            print(f"pull-universe: graphql partial ({len(errs)} node error(s); "
                  f"salvaged data): {str(errs[0].get('message',''))[:120]}",
                  file=sys.stderr)
        return parsed
    # Nothing usable in stdout — genuine failure, fall back to REST.
    if r.returncode != 0:
        print(f"pull-universe: graphql error: {r.stderr[:200]}", file=sys.stderr)
    return None

# Mirror of container/agent-runner/src/transient-error.ts classifyTurnError.
# Keep these signature lists in sync with that module — this is explainability
# for the supervisor board (last_outbound_error_class), the host redrive is the
# authoritative actor. Returns 'transient' | 'unknown' | 'permanent' | None.
_PERMANENT_SIGNATURES = (
    "billing_error", "invalid api key", "invalid_request_error",
    "permission_error", "authentication_error: invalid",
)
_TRANSIENT_SIGNATURES = (
    "not logged in", "please run /login", "econnrefused", "econnreset",
    "etimedout", "connection closed mid-response", "connection refused",
    "connection reset", "socket connection was closed", "socket hang up",
    "unable to connect to api", "bad gateway", "overloaded_error",
    "502", "503", "504", "service unavailable", "gateway timeout",
)

def classify_error_text(text):
    if not text:
        return None
    low = text.lower()
    # Only classify text that actually looks like an error notice, so a normal
    # reply that happens to contain "login" is not mislabeled.
    is_errorish = low.startswith("error:") or "please run /login" in low or "not logged in" in low
    if not is_errorish and not any(s in low for s in _TRANSIENT_SIGNATURES):
        return None
    if any(s in low for s in _PERMANENT_SIGNATURES):
        return "permanent"
    if any(s in low for s in _TRANSIENT_SIGNATURES):
        return "transient"
    return "unknown" if is_errorish else None

def ncl_last_outbound(sess_ids):
    """Return (latest_ts, latest_text, latest_kind) for the newest OUTBOUND row
    across the chain's sessions.

    Previously this discarded text/kind AND used `--limit 1` without `--reverse`,
    which returns the OLDEST merged row — so it never actually saw the last
    outbound (an a2a handoff bounce was invisible). We now pull the most recent
    rows newest-first (`--reverse`) and take the newest row whose direction is
    'out', keeping its text so scan.py can derive an error class for
    prioritization (last_outbound_error_class).
    """
    latest = None
    latest_text = None
    latest_kind = None
    for sid in sess_ids:
        ts, text, kind = session_last_outbound(sid) or (None, None, None)
        if ts and (latest is None or ts > latest):
            latest, latest_text, latest_kind = ts, text, kind
    return latest, latest_text, latest_kind

def session_last_outbound(sid):
    """(ts, text, kind) of the newest outbound row among one session's 10 newest
    rows — (None, None, None) when none of them is outbound — or None when the
    read itself failed, so the cached pull never records a failed read as
    "no outbound"."""
    out = run(["ncl", "sessions", "messages", "--id", sid,
               "--limit", "10", "--reverse", "--full", "--json"])
    if not out:
        return None
    try:
        data = json.loads(out)
        msgs = data.get("data") or data if isinstance(data, list) else data.get("data", [])
    except (json.JSONDecodeError, TypeError, AttributeError):
        return None
    if not isinstance(msgs, list):
        return None
    # Rows arrive newest-first; take the first 'out' row.
    for m in msgs:
        if isinstance(m, dict) and m.get("direction") == "out":
            return m.get("timestamp"), m.get("text"), m.get("kind")
    return None, None, None

# Group threads by repo
by_repo = {}
for t in threads:
    by_repo.setdefault(t["repo"], []).append(t)

# --- Step 3: Batch issue states + comments + PR cross-references ---
# One GraphQL query per repo batch (up to BATCH_SIZE issues per query).
# Returns: issue_data[repo:issue] = {state, comments, prs}
issue_data = {}
gh_calls = 0

# The full pull fetches every chain. The cached pull fetches only the chains
# UniverseCache.plan_github names, most urgent first, until GITHUB_SHARE of the
# budget is spent; the rest are filled from the cache after this loop.
fetch_plan = by_repo
if cache is not None:
    thread_by_key = {f"{t['repo']}:{t['issue']}": t for t in threads}
    fetch_plan = {}
    for key in cache.plan_github(threads, {sid: s.get("last_active") for sid, s in sessions_by_id.items()}):
        t = thread_by_key[key]
        fetch_plan.setdefault(t["repo"], []).append(t)
    print(f"pull-universe: cached pull — {sum(len(v) for v in fetch_plan.values())} of {len(threads)} "
          f"chains to refetch ({len(cache.changed)} changed on GitHub, sync errors: {cache.sync_errors or 'none'}, "
          f"unreachable: {cache.unreachable or 'none'})",
          file=sys.stderr)

for repo, repo_threads in fetch_plan.items():
    owner, name = repo.split("/", 1)
    for batch_start in range(0, len(repo_threads), BATCH_SIZE):
        if budget_spent(GITHUB_SHARE):
            break
        batch = repo_threads[batch_start:batch_start + BATCH_SIZE]
        # Build aliased query fragments.
        # Use issueOrPullRequest (a union), NOT issue(number:) — a chain can be
        # keyed on a number that is actually a PR (32/61 active slang chains
        # were), and issue(number:) is strict-typed so it 404s on those, which
        # used to poison the whole batch. The PullRequest arm captures the chain's
        # own PR as its artifact (self_pr), so we_owe_next_step in scan.py sees a
        # PR and won't false-flip a PR-keyed chain to awaiting_us.
        fragments = []
        for t in batch:
            alias = f"i{t['issue']}"
            fragments.append(f"""
    {alias}: issueOrPullRequest(number: {t["issue"]}) {{
      __typename
      ... on Issue {{
        state
        comments(last: 5) {{
          nodes {{ author {{ login }} createdAt }}
        }}
        timelineItems(last: 30, itemTypes: [CROSS_REFERENCED_EVENT]) {{
          nodes {{
            ... on CrossReferencedEvent {{
              source {{
                ... on PullRequest {{
                  number state isDraft body headRefName
                }}
              }}
            }}
          }}
        }}
      }}
      ... on PullRequest {{
        state isDraft body headRefName
        comments(last: 5) {{
          nodes {{ author {{ login }} createdAt }}
        }}
      }}
    }}""")

        query = f'{{ repository(owner: "{owner}", name: "{name}") {{ {"".join(fragments)} }} }}'
        result = gh_graphql(query)
        gh_calls += 1

        if not result or "data" not in result:
            # Fallback: individual REST calls for this batch
            print(f"pull-universe: graphql fallback for {repo} batch {batch_start}", file=sys.stderr)
            for t in batch:
                if budget_spent(GITHUB_SHARE):
                    break
                try:
                    r = subprocess.run(
                        ["gh", "issue", "view", str(t["issue"]), "--repo", repo,
                         "--json", "state", "--jq", ".state"],
                        capture_output=True, text=True, timeout=15)
                    state = r.stdout.strip() if r.returncode == 0 else "OPEN"
                except Exception:
                    state = "OPEN"
                # `degraded`: a state-only stub without comments or PRs; the
                # cached pull keeps such a chain out of the gate's decision.
                issue_data[f"{repo}:{t['issue']}"] = {"state": state, "comments": [], "prs": [], "self_pr": None,
                                                      "degraded": True}
                gh_calls += 1
            continue

        repo_data = (result.get("data") or {}).get("repository") or {}
        for t in batch:
            alias = f"i{t['issue']}"
            node = repo_data.get(alias)
            if not node:
                if budget_spent(GITHUB_SHARE):
                    continue  # past the time box: leave it unfetched, keep parsing the batch
                # A salvaged partial batch leaves misses as null nodes; a single
                # REST issue-view recovers just this one without poisoning the rest.
                try:
                    r = subprocess.run(
                        ["gh", "issue", "view", str(t["issue"]), "--repo", repo,
                         "--json", "state", "--jq", ".state"],
                        capture_output=True, text=True, timeout=15)
                    state = r.stdout.strip() if r.returncode == 0 else "OPEN"
                except Exception:
                    state = "OPEN"
                issue_data[f"{repo}:{t['issue']}"] = {"state": state, "comments": [], "prs": [], "self_pr": None,
                                                      "degraded": True}
                gh_calls += 1
                continue

            # Parse comments (present on both Issue and PullRequest arms).
            comments = []
            for c in (node.get("comments", {}).get("nodes") or []):
                author = (c.get("author") or {}).get("login", "")
                comments.append({"author": author, "at": c.get("createdAt", ""), "is_bot": author in bot_logins})

            # If the chain number is itself a PR, that PR IS the artifact.
            self_pr = None
            if node.get("__typename") == "PullRequest":
                self_pr = {
                    "number": t["issue"],
                    "state": node.get("state", "OPEN"),
                    "isDraft": node.get("isDraft", False),
                    "body": node.get("body", ""),
                    "headRefName": node.get("headRefName", ""),
                }

            # Parse cross-referenced PRs (find bot PRs matching fix/issue-* pattern).
            prs = []
            for item in (node.get("timelineItems", {}).get("nodes") or []):
                src = (item or {}).get("source")
                if not src or not src.get("number"):
                    continue
                prs.append({
                    "number": src["number"],
                    "state": src.get("state", "OPEN"),
                    "isDraft": src.get("isDraft", False),
                    "body": src.get("body", ""),
                    "headRefName": src.get("headRefName", ""),
                })

            issue_data[f"{repo}:{t['issue']}"] = {
                "state": node.get("state", "OPEN"),
                "comments": comments,
                "prs": prs,
                "self_pr": self_pr,
            }

print(f"pull-universe: issue batch done — {len(issue_data)} issues, {gh_calls} graphql calls", file=sys.stderr)

# The cached pull fills each chain it did not refetch from the cache. A chain
# with neither (never fetched, and the time box ran out) stays absent here and
# Step 4b marks it cache_cold.
fetched_keys = set(issue_data)
if cache is not None:
    for t in threads:
        key = f"{t['repo']}:{t['issue']}"
        if key not in issue_data:
            cached = cache.cached_issue(key)
            if cached is not None:
                issue_data[key] = cached


def chain_bot_pr(idata, issue):
    """The chain's PR: the chain number itself when it is a PR (self_pr), else
    the cross-referenced bot PR on a fix/issue-<num> branch, else None."""
    bot_pr = idata.get("self_pr")
    if not bot_pr:
        for pr in idata.get("prs", []):
            head = pr.get("headRefName", "")
            if head == f"fix/issue-{issue}" or head.startswith(f"fix/issue-{issue}-"):
                return pr
    return bot_pr


# --- Step 4a: Batch PR details (comments, reviews, last commit) ---
# Collect all PR numbers we need details for. The cached pull asks only for the
# PRs of the chains it refetched in Step 3; the others come from the cache.
pr_nums_by_repo = {}
for repo, repo_threads in by_repo.items():
    for t in repo_threads:
        key = f"{repo}:{t['issue']}"
        if cache is not None and key not in fetched_keys:
            continue
        idata = issue_data.get(key, {})
        state = idata.get("state", "OPEN")
        is_open = state == "OPEN"
        if not is_open and not include_closed:
            continue
        bot_pr = chain_bot_pr(idata, t["issue"])
        if bot_pr:
            pr_nums_by_repo.setdefault(repo, set()).add(bot_pr["number"])

pr_details = {}  # "repo:pr_num" -> {comments, reviews, last_commit_date}
pr_attempted = set()  # "repo:pr_num" whose batch ran, found or not

for repo, pr_nums in pr_nums_by_repo.items():
    owner, name = repo.split("/", 1)
    pr_list = sorted(pr_nums)
    for batch_start in range(0, len(pr_list), BATCH_SIZE):
        if budget_spent(GITHUB_SHARE):
            break
        batch = pr_list[batch_start:batch_start + BATCH_SIZE]
        pr_attempted.update(f"{repo}:{num}" for num in batch)
        fragments = []
        for num in batch:
            alias = f"pr{num}"
            fragments.append(f"""
    {alias}: pullRequest(number: {num}) {{
      number state isDraft body headRefName
      comments(last: 10) {{
        nodes {{ author {{ login }} createdAt }}
      }}
      reviews(last: 10) {{
        nodes {{ author {{ login }} submittedAt state }}
      }}
      commits(last: 1) {{
        nodes {{ commit {{ committedDate }} }}
      }}
    }}""")

        query = f'{{ repository(owner: "{owner}", name: "{name}") {{ {"".join(fragments)} }} }}'
        result = gh_graphql(query)
        gh_calls += 1

        if not result or "data" not in result:
            print(f"pull-universe: graphql PR fallback for {repo}", file=sys.stderr)
            # Fallback: individual REST calls
            for num in batch:
                pr_comments = None
                try:
                    r = subprocess.run(
                        ["gh", "pr", "view", str(num), "--repo", repo,
                         "--json", "comments,reviews"],
                        capture_output=True, text=True, timeout=30)
                    if r.returncode == 0:
                        pr_comments = json.loads(r.stdout)
                except Exception:
                    pass
                push_ts = run(["gh", "api", f"repos/{repo}/commits",
                               "--jq", ".[0].commit.committer.date",
                               "-f", f"sha=fix/issue-{num}", "-f", "per_page=1"])
                pr_details[f"{repo}:{num}"] = {"raw": pr_comments, "last_push": push_ts}
                gh_calls += 2
            continue

        repo_data = result["data"].get("repository", {})
        for num in batch:
            alias = f"pr{num}"
            node = repo_data.get(alias)
            if not node:
                continue
            pr_comments = []
            for c in (node.get("comments", {}).get("nodes") or []):
                author = (c.get("author") or {}).get("login", "")
                pr_comments.append({"author": author, "at": c.get("createdAt", ""), "is_bot": author in bot_logins, "kind": "comment"})
            pr_reviews = []
            for r in (node.get("reviews", {}).get("nodes") or []):
                author = (r.get("author") or {}).get("login", "")
                pr_reviews.append({"author": author, "at": r.get("submittedAt", ""), "is_bot": author in bot_logins, "kind": "review"})
            last_commit = None
            commits = node.get("commits", {}).get("nodes") or []
            if commits:
                last_commit = commits[0].get("commit", {}).get("committedDate")
            pr_details[f"{repo}:{num}"] = {
                "comments": pr_comments,
                "reviews": pr_reviews,
                "last_commit": last_commit,
            }

print(f"pull-universe: PR batch done — {len(pr_details)} PRs, {gh_calls} total graphql calls", file=sys.stderr)

# --- Cached pull: store what Step 3/4a fetched, and decide which chains are
# cold. A refetched chain is current only if its PR's batch also ran; one whose
# PR batch was cut by the time box stays dirty for the next run. ---
cold_keys = set()
if cache is not None:
    for key in fetched_keys:
        t_repo, t_issue = key.rsplit(":", 1)
        idata = issue_data[key]
        bot_pr = chain_bot_pr(idata, int(t_issue))
        cache.record_issue(key, idata, bot_pr)
        pr_key = f"{t_repo}:{bot_pr['number']}" if bot_pr else None
        pr_cut = pr_key is not None and pr_key not in pr_attempted and (
            idata.get("state", "OPEN") == "OPEN" or include_closed)
        # A degraded stub is not retried every run (a malformed repo name
        # degrades every time); it stays cold until the MAX_AGE_S refetch.
        if pr_cut:
            cache.dirty.add(key)
        else:
            cache.dirty.discard(key)
    for key, details in pr_details.items():
        cache.record_pr(key, details)
    for t in threads:
        key = f"{t['repo']}:{t['issue']}"
        idata = issue_data.get(key)
        if idata is None or idata.get("degraded") or key in cache.dirty:
            cold_keys.add(key)
            continue
        bot_pr = chain_bot_pr(idata, t["issue"])
        if bot_pr:
            pr_key = f"{t['repo']}:{bot_pr['number']}"
            if pr_key not in pr_details:
                cached_pr = cache.cached_pr(pr_key)
                if cached_pr is not None:
                    pr_details[pr_key] = cached_pr

# --- Cached pull: reread the last outbound of every session of an open,
# non-cold chain whose cached read may be out of date (UniverseCache.
# outbound_is_current), most recently active first, OUTBOUND_JOBS at a time,
# until OUTBOUND_SHARE of the budget is spent. ---
outbound_read = set()  # session ids read this run
if cache is not None:
    to_read = {}
    for t in threads:
        key = f"{t['repo']}:{t['issue']}"
        idata = issue_data.get(key)
        if key in cold_keys or idata is None:
            continue
        if idata.get("state", "OPEN") != "OPEN" and not include_closed:
            continue
        for sid in t["sessions"]:
            s = sessions_by_id.get(sid) or {"id": sid}
            if not cache.outbound_is_current(s):
                to_read[sid] = s
    queue = sorted(to_read.values(), key=lambda s: s.get("last_active") or "", reverse=True)
    with ThreadPoolExecutor(max_workers=OUTBOUND_JOBS) as pool:
        for start in range(0, len(queue), OUTBOUND_JOBS):
            if budget_spent(OUTBOUND_SHARE):
                break
            chunk = queue[start:start + OUTBOUND_JOBS]
            for s, read in zip(chunk, pool.map(lambda s: session_last_outbound(s["id"]), chunk)):
                if read is None:
                    continue  # the read failed: the session stays out of date
                cache.record_outbound(s, read[0], read[1])
                outbound_read.add(s["id"])
    print(f"pull-universe: cached pull — reread {len(outbound_read)} of {len(queue)} out-of-date "
          f"session outbound(s)", file=sys.stderr)


def cached_chain_outbound(sess_ids):
    """(ts, text, cold) for a chain from the outbound cache: the newest outbound
    across its sessions, and whether any session's read is missing or out of date."""
    latest, latest_text, cold = None, None, False
    for sid in sess_ids:
        s = sessions_by_id.get(sid) or {"id": sid}
        read = cache.cached_outbound(sid)
        if read is None or (sid not in outbound_read and not cache.outbound_is_current(s)):
            cold = True
        if read is not None and read[0] and (latest is None or read[0] > latest):
            latest, latest_text = read
    return latest, latest_text, cold


# --- Step 4b: Assemble chain JSON from pre-fetched data ---
chains = {}
skipped_closed = 0
total = len(threads)

for i, t in enumerate(threads):
    thread = t["thread"]
    repo = t["repo"]
    issue = t["issue"]
    sess_ids = t["sessions"]

    if (i + 1) % 20 == 0 or i == 0:
        print(f"pull-universe: {i+1}/{total} — {thread}", file=sys.stderr)

    idata = issue_data.get(f"{repo}:{issue}", {})
    issue_state = idata.get("state", "OPEN")
    is_open = issue_state == "OPEN"

    if not is_open and not include_closed:
        skipped_closed += 1
        chains[thread] = {
            "repo": repo, "issue": issue, "sessions": sess_ids,
            "our_last_outbound": None, "our_last_push": None,
            "pr": None, "issue_open": False, "comments": [],
            "pending_ask_user": False,
        }
        continue

    chain = {
        "repo": repo, "issue": issue, "sessions": sess_ids,
        "our_last_outbound": None, "our_last_push": None,
        "pr": None, "issue_open": is_open, "comments": [],
        "pending_ask_user": False,
    }

    bot_pr = chain_bot_pr(idata, issue)

    if bot_pr:
        body = bot_pr.get("body", "")
        fixes_match = re.search(r"(?:Fixes|Closes|Resolves)\s+#(\d+)", body, re.IGNORECASE)
        fixes_issue = int(fixes_match.group(1)) if fixes_match else None
        # A self_pr's fixes-target is its own chain number when the body omits it.
        if idata.get("self_pr") is bot_pr and fixes_issue is None:
            fixes_issue = issue
        pr_num = bot_pr["number"]
        chain["pr"] = {
            "number": pr_num,
            "state": bot_pr.get("state", "OPEN"),
            "isDraft": bot_pr.get("isDraft", False),
            "fixes_issue": fixes_issue,
            "body_has_fixes": fixes_issue is not None,
        }

        # PR comments + reviews from batch
        pd = pr_details.get(f"{repo}:{pr_num}", {})
        if "raw" in pd:
            # Fallback REST data
            raw = pd["raw"]
            if raw:
                for c in (raw.get("comments") or []):
                    author = (c.get("author") or {}).get("login", "")
                    chain["comments"].append({
                        "author": author, "at": c.get("createdAt", ""),
                        "is_bot": author in bot_logins, "kind": "comment",
                    })
                for r in (raw.get("reviews") or []):
                    author = (r.get("author") or {}).get("login", "")
                    chain["comments"].append({
                        "author": author,
                        "at": r.get("submittedAt") or r.get("createdAt", ""),
                        "is_bot": author in bot_logins, "kind": "review",
                    })
            chain["our_last_push"] = pd.get("last_push")
        else:
            chain["comments"].extend(pd.get("comments", []))
            chain["comments"].extend(pd.get("reviews", []))
            chain["our_last_push"] = pd.get("last_commit")

    # Issue comments from batch
    for c in idata.get("comments", []):
        chain["comments"].append({
            "author": c["author"], "at": c["at"],
            "is_bot": c["is_bot"], "kind": "comment",
        })

    # Last outbound from our sessions (ncl — local, not GH). Keep the newest
    # outbound's text so we can derive an error class (a bounced a2a handoff
    # shows up as an error-shaped last outbound — the #12097 shape).
    if cache is None:
        lo_ts, lo_text, _lo_kind = ncl_last_outbound(sess_ids)
    else:
        lo_ts, lo_text, outbound_cold = cached_chain_outbound(sess_ids)
        if outbound_cold or f"{repo}:{issue}" in cold_keys:
            # Built from missing or out-of-date data: classify it, but the gate
            # leaves it out of its wake decision until a later run warms it.
            chain["cache_cold"] = True
    chain["our_last_outbound"] = lo_ts
    chain["last_outbound_text"] = lo_text
    chain["last_outbound_error_class"] = classify_error_text(lo_text)

    # Rehydrate disposition from the prior tick so scan.py's HUMAN_OWNED gate
    # fires on live data (pull-universe never populated this before → the gate
    # always saw None and over-flagged). Current-tick disposition is agent-
    # supplied later (§1a); the prior value is the durable carrier.
    prior_snap = prior_state.get(thread, {}) if isinstance(prior_state, dict) else {}
    if isinstance(prior_snap, dict) and prior_snap.get("disposition"):
        chain["disposition"] = prior_snap["disposition"]

    chains[thread] = chain

if cache is not None:
    cold_chains = sum(1 for c in chains.values() if c.get("cache_cold"))
    cache.save(
        live_keys=[f"{t['repo']}:{t['issue']}" for t in threads],
        live_sessions=list(sessions_by_id),
        report={
            "at": cache.now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "elapsed_s": round(time.time() - START, 1),
            "budget_s": BUDGET_S,
            "chains": total,
            "closed": skipped_closed,
            "changed_on_github": len(cache.changed),
            "sync_errors": cache.sync_errors,
            "unreachable": cache.unreachable,
            "issues_fetched": len(fetched_keys),
            "prs_fetched": len(pr_attempted),
            "outbound_reads": len(outbound_read),
            "dirty_left": len(cache.dirty),
            "cold_chains": cold_chains,
        })
    print(f"pull-universe: cached pull — {cold_chains} cold chain(s), {len(cache.dirty)} left dirty, "
          f"{round(time.time() - START, 1)}s", file=sys.stderr)

print(f"pull-universe: done — {total} chains, {skipped_closed} closed (skipped detail), {gh_calls} GH API calls total", file=sys.stderr)
json.dump(chains, sys.stdout)
PY

# --- 5. Assemble the full scan.py input ---
# STATE was already loaded and written to $TMPD/state.json before Step 4b (so
# disposition could be rehydrated per chain); reuse that same file here, and
# the sessions file written before Step 3.

NOW="$NOW" python3 - "$TMPD/gh_sessions.json" "$TMPD/chains.json" "$TMPD/state.json" <<'PY'
import json, sys, os
with open(sys.argv[1]) as f: sessions = json.load(f)
with open(sys.argv[2]) as f: chains = json.load(f)
with open(sys.argv[3]) as f: state = json.load(f)
payload = {
    "now": os.environ["NOW"],
    "sessions": sessions,
    "chains": chains,
    "state": state,
}
json.dump(payload, sys.stdout, indent=2)
print()
PY
