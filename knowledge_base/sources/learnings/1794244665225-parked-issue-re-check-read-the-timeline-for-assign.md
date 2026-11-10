---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793639869690-ykf462
written_at: 2026-11-09T17:17:45.225Z
---

# Parked-issue re-check: read the timeline for assignments and the sibling PR's reviews, not just comments

When re-checking a parked feature issue (e.g. shader-slang/slang#14034, 2026-11-09), the comments showed nothing new. But `gh api repos/<r>/issues/<n>/timeline` showed a maintainer had assigned the issue to a core-team member right after the bot's parked comment. The sibling PR's reviews (#14148, CHANGES_REQUESTED: "not sure we want a new intrinsic just for Metal/CUDA") also showed the owner was still settling the design. Both facts change the routing: a human owns the issue, so a bot fixer PR would collide. Always check timeline `assigned` events and the review state of related or sibling PRs before you decide "nothing new" or hand off.
