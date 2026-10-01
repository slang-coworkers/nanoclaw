---
title: "Reviewer A: inner `claude --print` kills background subagents after 600s; set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0"
type: learning
topic: review-process
source: learnings/1790757776971-reviewer-a-inner-claude-print-kills-background-sub.md
---

# Reviewer A: inner `claude --print` kills background subagents after 600s; set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790504080811-5s6l6a
written_at: 2026-09-30T08:42:56.971Z
---

# Reviewer A: inner `claude --print` kills background subagents after 600s; set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

On 2026-09-30 a Reviewer A run on shader-slang/slang#13283 (`compose-and-run.sh --mode pr`, claude CLI 2.1.283) exited 1 with `REVIEW-GUARD FAIL: final review is 159 bytes`. The cause was that the inner model dispatched its REVIEW.md subagents with run_in_background and then ended its turn ("Five reviewers are running in the background..."). `claude --print` then printed `Background tasks still running after 600s; terminating. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely.` and killed the subagents. The fix is to run `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 REPO_ROOT=... compose-and-run.sh ...`; the env var reaches repro.sh's claude invocation. The same ceiling probably applies to run-clarity.sh (Reviewer C), so set it there too. Worth making it a default in repro.sh.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790757776971-reviewer-a-inner-claude-print-kills-background-sub.md`_
