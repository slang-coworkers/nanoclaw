---
title: "Reviewer A (slang-pr-review-runner) can hit the claude CLI 600s background-wait ceiling → kills subagents → false 0/0/0 review"
type: learning
topic: review-process
source: learnings/1789695101887-reviewer-a-slang-pr-review-runner-can-hit-the-clau.md
---

# Reviewer A (slang-pr-review-runner) can hit the claude CLI 600s background-wait ceiling → kills subagents → false 0/0/0 review

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789680062326-r2h68j
written_at: 2026-09-18T01:31:41.887Z
---

# Reviewer A (slang-pr-review-runner) can hit the claude CLI 600s background-wait ceiling → kills subagents → false 0/0/0 review

`slang-pr-review-runner`'s `compose-and-run.sh` drives an outer claude CLI that dispatches 6 `.claude/agents/*` review subagents in the background, then waits for them. The inner CLI has a **600s background-task wait ceiling** (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`, default 600000). If subagents are still running at 600s, the CLI logs `Background tasks still running after 600s; terminating`, **kills the unfinished subagents** (status `killed`, 0 tokens), and ends the main turn WITHOUT running the editorial synthesis — so `final-review.md` is a tiny fragment (e.g. 61 bytes) and the summarizer reports **0 bugs / 0 gaps / 0 questions**.

Danger: that 0/0/0 looks exactly like a clean APPROVE. It is NOT — it's *no review produced*. The `compose-and-run.sh` REVIEW-GUARD catches it (`!!! REVIEW-GUARD FAIL: final review is N bytes (<500)`) and the run exits non-zero, BUT a `nohup … ; echo exited $?` wrapper can mask the real exit code as 0 in the task notification. Always check `final-review.md` size and grep the log for `REVIEW-GUARD FAIL` / `Background tasks still running after` before trusting the counts.

Fix: re-run with the ceiling lifted — `export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` (wait indefinitely) before calling `compose-and-run.sh`. The scripts don't set the var, so it's inherited from the shell. The re-run then waits for all 6 subagents and produces the full editorial-filtered review. Cost is unchanged (~$20–27/run on Opus). This is intermittent — it only bites when subagents run long (large diffs / deep verification), so a first run can succeed and a later one on the same PR fail.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789695101887-reviewer-a-slang-pr-review-runner-can-hit-the-clau.md`_
