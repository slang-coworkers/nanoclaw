---
type: runbook
description: GitHub API pitfalls of the /supervise-issues tick — rate_limit probe, REST pagination for auto-merge, armed-PR sweep queries, pr-mappings --limit, --paginate 401, --jq hook block (ticks 284-376).
---

GitHub API quirks for the tick pipeline. Parent: [[orchestrator/supervise-tick-pull-pitfalls.md]].

- **`gh api rate_limit` → OneCLI `app_not_connected` is not an outage.** Probe with `gh api -i repos/shader-slang/slang`
  (`X-Ratelimit-Limit: 6000`) + `gh api graphql -f query='{viewer{login}}'` before reporting auth trouble (tick 284).
- **Auto-merge sweep / closed-since without GraphQL search:** the org-wide GraphQL `search` 502s intermittently; use
  REST `repos/shader-slang/<r>/pulls?state=open&per_page=100&page=N` filtered on `.auto_merge!=null` (**6 pages** for slang — 544 open PRs at tick 333, 445 at tick 292; 3 pages missed the armed #10769/#10098 on page 4),
  and `gh search issues --owner shader-slang --closed '>=<date>' --include-prs` (raw `gh api search/issues?q=…closed:>=`
  returns empty JSON).
- **Armed-PR mergeable check — GraphQL field names (tick 347):** `PullRequest.mergeableState`, `AutoMergeRequest.state`
  and `AutoMergeRequest.enabledMethod` do NOT exist; the working query is `mergeable mergeStateStatus reviewDecision
  isDraft autoMergeRequest{mergeMethod}`. **Simpler one-call sweep (tick 376):** `gh pr list -R shader-slang/slang --state
  open --limit 400 --json number,autoMergeRequest,mergeStateStatus` returns armed PRs directly (`autoMergeRequest != null`
  = armed, with `enabledAt`/`enabledBy`/`mergeMethod` inside) — no REST pagination, no GraphQL; retry once on an HTTP 502.

- **`ncl pr-mappings list` returns only 200 rows by default** — pass `--limit 10000` (1,069 rows at tick 337). Tick 336's
  `prmap.json` was truncated, so `deliv.py` missed mappings for older PRs.
- **`gh api --paginate` on `actions/runs` (and on `pulls?state=open`) gets a OneCLI 401 `app_not_connected` from page 2 on** (the Link header points at
  `/repositories/<id>/…`, which the gateway does not credential). The error JSON lands in stdout and the count stops at 100.
  Page by hand with `&per_page=100&page=N` and cross-check `total_count` (tick 317: 159 `waiting` runs, not 100).

- **A `gh api … --jq` filter containing `pull_request!=null` is refused by a PreToolUse hook** ("Blocked by hook"; tick 339,
  three calls lost). To tell an issue from a PR, use `gh pr view <n> -R <o>/<r> --json number,author,state,isDraft` (it errors on an issue).
