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

# --- 1. Pull all sessions, filter to gh-issue-* ---
ALL_SESSIONS=$(ncl sessions list --limit 10000 --json 2>/dev/null)
GH_SESSIONS=$(echo "$ALL_SESSIONS" | python3 -c '
import json, sys
data = json.load(sys.stdin)["data"]
gh = [s for s in data if (s.get("thread_id") or "").startswith("gh-issue-")]
json.dump(gh, sys.stdout)
')

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
CHAINS_JSON=$(python3 -c '
import json, sys, subprocess, re

threads = json.loads(sys.argv[1])
include_closed = sys.argv[2] == "true"
bot_logins = {"nv-slang-bot[bot]", "nv-slang-bot"}
BATCH_SIZE = 50

def run(cmd, default=""):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return r.stdout.strip() if r.returncode == 0 else default
    except Exception:
        return default

def gh_graphql(query):
    """Execute a GraphQL query via gh api graphql."""
    r = subprocess.run(
        ["gh", "api", "graphql", "-f", f"query={query}"],
        capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        print(f"pull-universe: graphql error: {r.stderr[:200]}", file=sys.stderr)
        return None
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return None

def ncl_last_outbound(sess_ids):
    latest = None
    for sid in sess_ids:
        out = run(["ncl", "sessions", "messages", "--id", sid, "--limit", "1", "--json"])
        if not out:
            continue
        try:
            data = json.loads(out)
            msgs = data.get("data") or data if isinstance(data, list) else data.get("data", [])
            if isinstance(msgs, list):
                for m in msgs:
                    ts = m.get("timestamp")
                    if ts and (latest is None or ts > latest):
                        latest = ts
        except (json.JSONDecodeError, TypeError):
            pass
    return latest

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
        # Build aliased query fragments
        fragments = []
        for t in batch:
            alias = f"i{t['issue']}"
            fragments.append(f"""
    {alias}: issue(number: {t["issue"]}) {{
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
                issue_data[f"{repo}:{t['issue']}"] = {"state": state, "comments": [], "prs": []}
                gh_calls += 1
            continue

        repo_data = result["data"].get("repository", {})
        for t in batch:
            alias = f"i{t['issue']}"
            node = repo_data.get(alias)
            if not node:
                issue_data[f"{repo}:{t['issue']}"] = {"state": "OPEN", "comments": [], "prs": []}
                continue

            # Parse comments
            comments = []
            for c in (node.get("comments", {}).get("nodes") or []):
                author = (c.get("author") or {}).get("login", "")
                comments.append({"author": author, "at": c.get("createdAt", ""), "is_bot": author in bot_logins})

            # Parse cross-referenced PRs (find bot PRs matching fix/issue-* pattern)
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
        # Find our bot PR (matching fix/issue-* branch)
        bot_pr = None
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

    # Find bot PR from cross-references
    bot_pr = None
    for pr in idata.get("prs", []):
        head = pr.get("headRefName", "")
        if head == f"fix/issue-{issue}" or head.startswith(f"fix/issue-{issue}-"):
            bot_pr = pr
            break

    if bot_pr:
        body = bot_pr.get("body", "")
        fixes_match = re.search(r"(?:Fixes|Closes|Resolves)\s+#(\d+)", body, re.IGNORECASE)
        fixes_issue = int(fixes_match.group(1)) if fixes_match else None
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

    # Last outbound from our sessions (ncl — local, not GH)
    chain["our_last_outbound"] = ncl_last_outbound(sess_ids)

    chains[thread] = chain

print(f"pull-universe: done — {total} chains, {skipped_closed} closed (skipped detail), {gh_calls} GH API calls total", file=sys.stderr)
json.dump(chains, sys.stdout)
' "$THREADS" "$INCLUDE_CLOSED")

# --- 5. Assemble the full scan.py input ---
STATE="{}"
if [[ -n "$STATE_FILE" && -f "$STATE_FILE" ]]; then
  STATE=$(cat "$STATE_FILE")
fi

python3 -c '
import json, sys
now, sessions_s, chains_s, state_s = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
payload = {
    "now": now,
    "sessions": json.loads(sessions_s),
    "chains": json.loads(chains_s),
    "state": json.loads(state_s),
}
json.dump(payload, sys.stdout, indent=2)
print()
' "$NOW" "$GH_SESSIONS" "$CHAINS_JSON" "$STATE"
