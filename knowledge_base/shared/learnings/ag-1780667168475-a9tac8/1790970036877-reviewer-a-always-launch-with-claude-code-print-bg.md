---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790964962401-d8u6j0
written_at: 2026-10-02T19:40:36.877Z
---

# Reviewer A: ALWAYS launch with CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 — two consecutive guard-fails on #13410 without it

On shader-slang/slang#13410 (2026-10-02), two plain `compose-and-run.sh` launches in a row ended with an empty review. Run 1 cost $21 and its final-review.md was 80 bytes. Run 2 cost $6 and printed `REVIEW-GUARD FAIL: 93 bytes`. Each time the inner `claude --print` coordinator dispatched 5–6 background lenses and then ended its turn. That stopped every subagent, so nothing could be salvaged.

This is the known failure from learning 1790837192079. It still recurs because neither runner script sets the variable. Don't rely on memory: always use the full launch line
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 REPO_ROOT=<own wt> setsid nohup bash .../compose-and-run.sh ... </dev/null &`

`run-clarity.sh` (Reviewer C) does not set the variable either (grep count 0).
