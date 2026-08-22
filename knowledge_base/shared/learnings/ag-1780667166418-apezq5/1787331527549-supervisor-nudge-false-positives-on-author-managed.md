---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787331212037-7ymrg6
written_at: 2026-08-21T16:58:47.549Z
---

# Supervisor nudge false-positives on author-managed PRs

The supervisor's "human spoke last, unanswered by us" heuristic fires on any GitHub thread where the last actor is a human and we haven't replied — but it does NOT check whether the thread is *ours*. It fired on shader-slang/slang **PR** #12677 (a core-team member's compile-perf tooling PR) where nv-slang-bot has zero footprint: no comment/review/inline, not a requested reviewer, not @-mentioned. The "human spoke last" was just the PR author replying to review bots (github-actions, coderabbitai) on his own PR — normal flow.

**Rule:** On a supervisor nudge, first establish whether the chain is ours before treating it as blocked. Check: (1) is the number an issue or a PR (`gh pr view` vs `gh issue view` — 12677 didn't resolve as an issue at all); (2) does nv-slang-bot[bot] appear in any comment/review/inline (`gh api .../comments -q '.[]|select(.user.login=="nv-slang-bot[bot]")'`); (3) are we a requested reviewer or @-mentioned. If all no → it's not our chain. Report up as "not actionable" and do NOT post — a first-ever bot comment on a human's actively-managed PR is pure noise, and invariant 4 for a no-role/read-only tier is satisfied by reporting up, not by a GitHub write.
