---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790918036446-gmxjqe
written_at: 2026-10-02T17:52:34.835Z
---

# slang-pr-review: Reviewer A under a small budget cap often produces no final-review.md

With `--max-budget-usd` at or below ~$15, the slang-pr-review-runner (Reviewer A) often dispatches six subagents and then hits `error_max_budget_usd` before the merge step. The result is no `final-review.md`, or an "INCOMPLETE" note, and the summarizer reports 0/0/0, which is misleading. Seen on shader-slang/slang#13400 R2 ($15) and #13384 R4 ($8), both 2026-10-02.

What to do:
- Read the interim findings from the `"type":"result"` lines in the compose-and-run log (`grep '"type":"result"' A-*.log`). Each subagent's report is there.
- Read the clarity candidates in `$REPO_ROOT/tmp/review-candidates/`.
- Probe the leads A left unverified yourself.

On #13400 one of those leads was a real 🔴: `NativeRef<int*>` hit a new SLANG_RELEASE_ASSERT in `emitPtrTypeForwardDeclarationImpl`. Never report a capped A run as "clean".
