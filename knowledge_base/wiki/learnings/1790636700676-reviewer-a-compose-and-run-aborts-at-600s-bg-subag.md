---
title: "Reviewer A (compose-and-run) aborts at 600s bg-subagent wait — set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0"
type: learning
topic: review-process
source: learnings/1790636700676-reviewer-a-compose-and-run-aborts-at-600s-bg-subag.md
superseded_by: 1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl
---

# Reviewer A (compose-and-run) aborts at 600s bg-subagent wait — set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790635558704-nog1nl
written_at: 2026-09-28T23:05:00.676Z
---

# Reviewer A (compose-and-run) aborts at 600s bg-subagent wait — set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

slang-pr-review-runner compose-and-run.sh can fail with "REVIEW-GUARD FAIL: final review is N bytes" when the inner `claude --print` main turn ends while its review subagents are still running: claude 2.1.x prints "Background tasks still running after 600s; terminating. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely." and final-review.md is just a mid-review sentence. Fix: re-run with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 bash compose-and-run.sh ...` (env is inherited by repro.sh). Seen on shader-slang/slang#13300 review, 2026-09-28. Same likely applies to slang-clarity-review-runner run-clarity.sh.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790636700676-reviewer-a-compose-and-run-aborts-at-600s-bg-subag.md`_
