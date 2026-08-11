#!/usr/bin/env bash
# pull-universe.sh — Exhaustive chain universe pull for scan.py.
#
# Runs inside the orchestrator container. Enumerates ALL gh-issue-* sessions
# via ncl, resolves each chain's PR + comments + last outbound via gh/ncl,
# and writes the full scan.py input JSON to stdout.
#
# The LLM no longer assembles the chains payload by hand — this script does
# it deterministically and exhaustively, so scan.py sees every chain every tick.
#
# Usage:
#   bash scripts/pull-universe.sh [--state /path/to/supervisor-state.json] [--include-closed]
#
# By default, chains whose issue is closed/merged are included with minimal data
# (just issue_open: false) so scan.py can archive them, but the expensive
# PR/comments/outbound fetches are skipped. Pass --include-closed to fetch full
# data for closed issues too.
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

# --- 3. Batch-check issue state to skip closed ones cheaply ---
# Group issues by repo for batched gh api calls (1 call per 100 issues per repo).
ISSUE_STATES=$(echo "$THREADS" | python3 -c '
import json, sys, subprocess

threads = json.load(sys.stdin)
by_repo = {}
for t in threads:
    by_repo.setdefault(t["repo"], []).append(t["issue"])

states = {}  # "repo:issue" -> "OPEN" | "CLOSED"
for repo, issues in by_repo.items():
    # gh api with GraphQL for batch issue state
    for batch_start in range(0, len(issues), 100):
        batch = issues[batch_start:batch_start+100]
        nums = ",".join(str(n) for n in batch)
        # Use REST search endpoint: cheaper than N individual calls
        for num in batch:
            try:
                r = subprocess.run(
                    ["gh", "issue", "view", str(num), "--repo", repo,
                     "--json", "state", "--jq", ".state"],
                    capture_output=True, text=True, timeout=15)
                if r.returncode == 0 and r.stdout.strip():
                    states[f"{repo}:{num}"] = r.stdout.strip()
            except Exception:
                pass
json.dump(states, sys.stdout)
')

# --- 4. For each chain, fetch PR + comments + last outbound ---
CHAINS_JSON=$(python3 -c '
import json, sys, subprocess, re

threads = json.loads(sys.argv[1])
issue_states = json.loads(sys.argv[2])
include_closed = sys.argv[3] == "true"
bot_logins = {"nv-slang-bot[bot]", "nv-slang-bot"}
chains = {}
skipped_closed = 0

def run(cmd, default=""):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return r.stdout.strip() if r.returncode == 0 else default
    except Exception:
        return default

def gh_json(args):
    out = run(["gh"] + args)
    if not out:
        return None
    try:
        return json.loads(out)
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

total = len(threads)
for i, t in enumerate(threads):
    thread = t["thread"]
    repo = t["repo"]
    issue = t["issue"]
    sess_ids = t["sessions"]

    if (i + 1) % 20 == 0 or i == 0:
        print(f"pull-universe: {i+1}/{total} — {thread}", file=sys.stderr)

    issue_state = issue_states.get(f"{repo}:{issue}", "OPEN")
    is_open = issue_state == "OPEN"

    # For closed issues, emit a minimal chain so scan.py can see and archive it,
    # but skip the expensive gh/ncl calls.
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

    # PR: look for fix/issue-<num> branch
    pr_data = gh_json(["pr", "list", "--repo", repo, "--head", f"fix/issue-{issue}",
                        "--state", "all", "--json",
                        "number,state,isDraft,body,headRefName",
                        "--jq", ".[0]"])
    if pr_data and pr_data.get("number"):
        body = pr_data.get("body") or ""
        fixes_match = re.search(r"(?:Fixes|Closes|Resolves)\s+#(\d+)", body, re.IGNORECASE)
        fixes_issue = int(fixes_match.group(1)) if fixes_match else None
        chain["pr"] = {
            "number": pr_data["number"],
            "state": pr_data.get("state", "OPEN"),
            "isDraft": pr_data.get("isDraft", False),
            "fixes_issue": fixes_issue,
            "body_has_fixes": fixes_issue is not None,
        }

        # PR comments + reviews
        pr_num = pr_data["number"]
        pr_comments = gh_json(["pr", "view", str(pr_num), "--repo", repo,
                               "--json", "comments,reviews"])
        if pr_comments:
            for c in (pr_comments.get("comments") or []):
                author = (c.get("author") or {}).get("login", "")
                chain["comments"].append({
                    "author": author, "at": c.get("createdAt", ""),
                    "is_bot": author in bot_logins, "kind": "comment",
                })
            for r in (pr_comments.get("reviews") or []):
                author = (r.get("author") or {}).get("login", "")
                chain["comments"].append({
                    "author": author,
                    "at": r.get("submittedAt") or r.get("createdAt", ""),
                    "is_bot": author in bot_logins, "kind": "review",
                })

        # Last push by us on the PR branch
        push_ts = run(["gh", "api", f"repos/{repo}/commits",
                        "--jq", ".[0].commit.committer.date",
                        "-f", f"sha=fix/issue-{issue}", "-f", "per_page=1"])
        if push_ts:
            chain["our_last_push"] = push_ts

    # Issue comments (last 5, for ball-direction)
    issue_comments = gh_json(["issue", "view", str(issue), "--repo", repo,
                              "--json", "comments",
                              "--jq", "[.comments[-5:][] | {author: .author.login, at: .createdAt}]"])
    if issue_comments and isinstance(issue_comments, list):
        for c in issue_comments:
            author = c.get("author", "")
            chain["comments"].append({
                "author": author, "at": c.get("at", ""),
                "is_bot": author in bot_logins, "kind": "comment",
            })

    # Last outbound from our sessions (ncl)
    chain["our_last_outbound"] = ncl_last_outbound(sess_ids)

    chains[thread] = chain

print(f"pull-universe: done — {total} chains, {skipped_closed} closed (skipped detail)", file=sys.stderr)
json.dump(chains, sys.stdout)
' "$THREADS" "$ISSUE_STATES" "$INCLUDE_CLOSED")

# --- 5. Assemble the full scan.py input ---
STATE="{}"
if [[ -n "$STATE_FILE" && -f "$STATE_FILE" ]]; then
  STATE=$(cat "$STATE_FILE")
fi

TMPD=$(mktemp -d)
printf '%s' "$GH_SESSIONS" > "$TMPD/sessions.json"
printf '%s' "$CHAINS_JSON" > "$TMPD/chains.json"
printf '%s' "$STATE" > "$TMPD/state.json"
printf '%s' "$NOW" > "$TMPD/now.txt"
python3 -c '
import json, sys
d = sys.argv[1]
payload = {
    "now": open(d+"/now.txt").read().strip(),
    "sessions": json.load(open(d+"/sessions.json")),
    "chains": json.load(open(d+"/chains.json")),
    "state": json.load(open(d+"/state.json")),
}
json.dump(payload, sys.stdout, indent=2)
print()
' "$TMPD"
rm -rf "$TMPD"
