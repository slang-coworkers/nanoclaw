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
#
# Requires: ncl, gh, python3
set -euo pipefail

# Scratch dir for passing large JSON blobs between steps via files instead of
# argv (argv overflows "Argument list too long" once the chain universe grows
# past ~170 chains / ~0.5MB payloads).
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT

STATE_FILE=""
INCLUDE_CLOSED=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --state) STATE_FILE="$2"; shift 2 ;;
    --include-closed) INCLUDE_CLOSED=true; shift ;;
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

# --- 1b. Stamp each gh-issue session with its live cost-cap status (ncl,
#         local — same cost class as the per-chain `ncl sessions messages`
#         calls in Step 4b, not a GitHub round-trip). scan.py's classify()
#         short-circuits a nudge for a session that's deliberately `stopped`
#         pending a human cost decision (dashboard Continue/Stop), instead of
#         reading the resulting long silence as ordinary staleness — see
#         scan.py::any_session_cost_stopped. `cost_status` is 'unknown' when
#         the session predates cost-cap or the `ncl cost-cap status` call
#         itself fails; scan.py treats 'unknown' exactly like "no signal"
#         (never cost_stopped). ---
printf '%s' "$GH_SESSIONS" > "$TMPD/gh_sessions_precost.json"
GH_SESSIONS=$(python3 - "$TMPD/gh_sessions_precost.json" <<'PY'
import json
import subprocess
import sys

with open(sys.argv[1]) as f:
    sessions = json.load(f)


def cost_status(session_id):
    try:
        r = subprocess.run(
            ["ncl", "cost-cap", "status", "--session", session_id, "--json"],
            capture_output=True, text=True, timeout=15)
        if r.returncode != 0 or not r.stdout.strip():
            return "unknown"
        parsed = json.loads(r.stdout)
        data = parsed.get("data") if isinstance(parsed, dict) else None
        status = (data or {}).get("status")
        return status if isinstance(status, str) and status else "unknown"
    except Exception:
        return "unknown"


stopped = 0
for s in sessions:
    sid = s.get("id")
    status = cost_status(sid) if sid else "unknown"
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

INCLUDE_CLOSED="$INCLUDE_CLOSED" python3 - "$TMPD/threads.json" "$TMPD/state.json" <<'PY' > "$TMPD/chains.json"
import json, sys, subprocess, re, os

with open(sys.argv[1]) as _f:
    threads = json.load(_f)
with open(sys.argv[2]) as _f:
    prior_state = json.load(_f)
include_closed = os.environ["INCLUDE_CLOSED"] == "true"
bot_logins = {"nv-slang-bot[bot]", "nv-slang-bot"}
BATCH_SIZE = 50

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
        out = run(["ncl", "sessions", "messages", "--id", sid,
                   "--limit", "10", "--reverse", "--full", "--json"])
        if not out:
            continue
        try:
            data = json.loads(out)
            msgs = data.get("data") or data if isinstance(data, list) else data.get("data", [])
            if isinstance(msgs, list):
                # Rows arrive newest-first; take the first 'out' row per session.
                for m in msgs:
                    if m.get("direction") != "out":
                        continue
                    ts = m.get("timestamp")
                    if ts and (latest is None or ts > latest):
                        latest = ts
                        latest_text = m.get("text")
                        latest_kind = m.get("kind")
                    break
        except (json.JSONDecodeError, TypeError):
            pass
    return latest, latest_text, latest_kind

# Group threads by repo
by_repo = {}
for t in threads:
    by_repo.setdefault(t["repo"], []).append(t)

# --- Step 3: Batch issue states + comments + PR cross-references ---
# One GraphQL query per repo batch (up to BATCH_SIZE issues per query).
# Returns: issue_data[repo:issue] = {state, comments, prs}
issue_data = {}
gh_calls = 0

for repo, repo_threads in by_repo.items():
    owner, name = repo.split("/", 1)
    for batch_start in range(0, len(repo_threads), BATCH_SIZE):
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
                try:
                    r = subprocess.run(
                        ["gh", "issue", "view", str(t["issue"]), "--repo", repo,
                         "--json", "state", "--jq", ".state"],
                        capture_output=True, text=True, timeout=15)
                    state = r.stdout.strip() if r.returncode == 0 else "OPEN"
                except Exception:
                    state = "OPEN"
                issue_data[f"{repo}:{t['issue']}"] = {"state": state, "comments": [], "prs": [], "self_pr": None}
                gh_calls += 1
            continue

        repo_data = (result.get("data") or {}).get("repository") or {}
        for t in batch:
            alias = f"i{t['issue']}"
            node = repo_data.get(alias)
            if not node:
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
                issue_data[f"{repo}:{t['issue']}"] = {"state": state, "comments": [], "prs": [], "self_pr": None}
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

# --- Step 4a: Batch PR details (comments, reviews, last commit) ---
# Collect all PR numbers we need details for
pr_nums_by_repo = {}
for repo, repo_threads in by_repo.items():
    for t in repo_threads:
        idata = issue_data.get(f"{repo}:{t['issue']}", {})
        state = idata.get("state", "OPEN")
        is_open = state == "OPEN"
        if not is_open and not include_closed:
            continue
        # Find our PR: a chain keyed on a PR number IS that PR (self_pr);
        # otherwise a cross-referenced bot PR (fix/issue-* branch).
        bot_pr = idata.get("self_pr")
        if not bot_pr:
            for pr in idata.get("prs", []):
                head = pr.get("headRefName", "")
                if head == f"fix/issue-{t['issue']}" or head.startswith(f"fix/issue-{t['issue']}-"):
                    bot_pr = pr
                    break
        if bot_pr:
            pr_nums_by_repo.setdefault(repo, set()).add(bot_pr["number"])

pr_details = {}  # "repo:pr_num" -> {comments, reviews, last_commit_date}

for repo, pr_nums in pr_nums_by_repo.items():
    owner, name = repo.split("/", 1)
    pr_list = sorted(pr_nums)
    for batch_start in range(0, len(pr_list), BATCH_SIZE):
        batch = pr_list[batch_start:batch_start + BATCH_SIZE]
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

    # The chain's PR: a chain keyed on a PR number IS that PR (self_pr);
    # otherwise a cross-referenced bot PR (fix/issue-* branch).
    bot_pr = idata.get("self_pr")
    if not bot_pr:
        for pr in idata.get("prs", []):
            head = pr.get("headRefName", "")
            if head == f"fix/issue-{issue}" or head.startswith(f"fix/issue-{issue}-"):
                bot_pr = pr
                break

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
    lo_ts, lo_text, _lo_kind = ncl_last_outbound(sess_ids)
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

print(f"pull-universe: done — {total} chains, {skipped_closed} closed (skipped detail), {gh_calls} GH API calls total", file=sys.stderr)
json.dump(chains, sys.stdout)
PY

# --- 5. Assemble the full scan.py input ---
# STATE was already loaded and written to $TMPD/state.json before Step 4b (so
# disposition could be rehydrated per chain); reuse that same file here.

# Read the big blobs from files (not argv) to avoid "Argument list too long".
printf '%s' "$GH_SESSIONS" > "$TMPD/gh_sessions.json"

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
