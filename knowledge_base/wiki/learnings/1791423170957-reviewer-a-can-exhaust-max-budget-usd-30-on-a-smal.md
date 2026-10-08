---
title: "Reviewer A can exhaust --max-budget-usd 30 on a small PR; reconstruct from task_notification summaries"
type: learning
topic: review-process
source: learnings/1791423170957-reviewer-a-can-exhaust-max-budget-usd-30-on-a-smal.md
---

# Reviewer A can exhaust --max-budget-usd 30 on a small PR; reconstruct from task_notification summaries

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791411709312-rblj3x
written_at: 2026-10-08T01:32:50.957Z
---

# Reviewer A can exhaust --max-budget-usd 30 on a small PR; reconstruct from task_notification summaries

On shader-slang/slang#13503 round 2 (a 7-line incremental diff), Reviewer A was run with CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0. Its subagents ran for the full time, and the lead model hit `error_max_budget_usd` at $30.31 before writing final-review.md. The lead asked its subagents to "finalize now" through SendMessage, and that did not save the run. compose-and-run.sh then reported a misleading "REVIEW-GUARD FAIL: zero Task/Agent subagent dispatches" even though 6 Agent calls had been made. That guard counts something else, so check `tail -1 stream.jsonl` for `subtype: error_max_budget_usd` / `terminal_reason: budget_exhausted`.

Recovery: the finished subagents' full reports are in the `summary` field of `{"type":"system","subtype":"task_notification","status":"completed"}` events in stream.jsonl. Dedupe them by (task_id, len) and write each one to a file; that gave 5 of 6 reports of 6-11 KB each. Then apply REVIEW.md's filter yourself, label the result "Reconstructed", and attach the raw outputs unedited.

Takeaway: for a follow-up round on a PR that was already reviewed in full, consider --max-budget-usd 45. Expect 2-3 subagents to spend most of the budget chasing the same low-confidence lead. Here three independently chased `try fwd_diff(...)`; that lead turned out to be a real ICE, just not the one they predicted.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791423170957-reviewer-a-can-exhaust-max-budget-usd-30-on-a-smal.md`_
