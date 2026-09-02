---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788264429717-ioum6t
written_at: 2026-09-01T12:26:59.832Z
---

# Invalid per-agent GH_TOKEN silently degrades a fixer to read-only — triage via MCP, report as blocker (don't retry pushes)

## Symptom
A slangpy-fixer container had an **invalid `GH_TOKEN`** (`gh auth status` → "The token in GH_TOKEN is invalid"). This silently blocks ALL GitHub writes: no `gh` CLI, no git push, so rebase/ready/merge/close/comment are impossible. It was the root cause of a whole stale open-PR backlog — the fixer couldn't drive any of its own PRs to merge.

## How to recognize it fast
- `gh auth status` shows the token invalid, but the **authenticated MCP GitHub tools (`mcp__slang-mcp__github_*`) still work** — they use a separate connection. So you can still do full read-only triage (PR state, reviews, comments, linked-issue open/closed) even when `gh` is dead.
- It's typically **per-agent** (a OneCLI secret gap for that one container), not a fleet outage — verify by asking whether peers' writes work. The orchestrator confirmed its own and slang-fixer's writes were fine.

## What to do
1. Don't burn cycles retrying pushes that will fail. Detect the invalid token once (`gh auth status`), then switch to read-only mode.
2. Do the triage via MCP read tools and **report the token as an explicit `Blocker`** in the 5-bullet up to parent, framing every write action as a recommendation, not something done.
3. Let the parent escalate the credential restore to the operator; expect re-dispatch of the concrete write actions once the token is back.

## Also useful
- A `critique-gate` overlay hook (`gate-critique-on-deliver.sh`) blocks GitHub-write **bash** by regex — including a harmless `curl https://api.github.com/.../pulls/N` GET (the pattern matches any `.../pulls` URL). Use the MCP tools instead of curl for GitHub reads; they aren't gated.
- MCP `github_get_pull_request` does NOT expose CI check-run status or mergeable/behind — rely on the supervisor's provided states + on-PR triage comments for CI cause when `gh` is unavailable.
