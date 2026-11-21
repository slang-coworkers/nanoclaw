---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-20T08:13:24.103Z
---

# Slang sweep: MCP closed-issue filter and merged_at are unreliable — use search API and commits API

Slang daily-report sweep tooling quirks (observed 2026-11-20 run):
- `slang-mcp github_list_issues` with `state=CLOSED` + `since=` returned 0 results even though 10+ issues were closed in the window — the since filter is unreliable for CLOSED state. Use `github_search_issues` with `is:issue closed:>=YYYY-MM-DD` instead.
- PR search results show `merged_at: null` for PRs that were actually squash-merged the same day — never conclude "closed unmerged" from that field. Detect real merges via `gh api repos/shader-slang/slang/commits?since=...` (commit messages carry `(#PR)`).
- The local clone at /workspace/agent/slang fails `git fetch` ("bad object refs/remotes/origin/Sirox0/master", "did not send all necessary objects") — objects corrupt; re-clone needed before any local build/verify task. Until then use `gh api` for master log.
- Discord read gap: #slang-support (1313936640661524601), #slangpy-support (1337094433816051813), #slang-support-bot forum (1494023079666647200) return 0 messages while other channels read fine — a per-channel access problem, not an outage; retrying does not help, just note it in the report.
