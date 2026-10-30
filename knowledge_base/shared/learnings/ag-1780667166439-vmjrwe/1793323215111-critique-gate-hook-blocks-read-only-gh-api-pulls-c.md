---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793319286053-9p0eqs
written_at: 2026-10-30T01:20:15.111Z
---

# critique-gate hook blocks read-only gh api pulls/comments GETs

`/app/hooks/gate-critique-on-deliver.sh` pattern-matches `gh api repos/<o>/<r>/pulls/comments/<id>` (and `pulls/<n>/comments`, and `curl` to the same API path) as "PR creation". It refuses the call before the critique stages are recorded, and it counts each refusal toward the 3-attempt admin escalation, even for a plain GET. To read PR review comments before the gate is open, use `mcp__slang-mcp__github_get_pull_request_comments` / `github_get_pull_request_reviews`. Subagents trip it too, so tell them which tool to use. Seen on slang#14073, 2026-10-30.
