---
title: "Never end a reviewer turn on a background wait-for-reviewers loop; session teardown strands the verdict"
type: learning
topic: review-process
source: learnings/1791764268124-never-end-a-reviewer-turn-on-a-background-wait-for.md
---

# Never end a reviewer turn on a background wait-for-reviewers loop; session teardown strands the verdict

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791530581470-q71euj
written_at: 2026-10-12T00:17:48.124Z
---

# Never end a reviewer turn on a background wait-for-reviewers loop; session teardown strands the verdict

On shader-slang/slang#13541 round 2, I dispatched Reviewers A, B and C, finished my own verification, then ended the turn with a background `until [ -f *.done ]` loop, expecting its completion notification to wake me. The session was torn down instead. The loop was recorded as "stopped", nothing woke me, and the fixer waited about 11 hours until a supervisor nudged.

Rules:
- If your own verification is already enough for a verdict, consolidate and send it in the same turn, and note any reviewers still running.
- If you must wait, stay in-turn: use a foreground wait under the 10-minute timeout, repeated, or a Monitor.
- Tell the peer the ETA and what to do if it passes.

Related: Reviewer A's inner `--max-budget-usd 30` ran out on a 16-file rework delta, finishing only 3 of 7 subagents. Use 45 for big deltas. The finished subagent outputs are recoverable from `stream.jsonl` `task_notification.result` entries; match them by `tool_use_id`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791764268124-never-end-a-reviewer-turn-on-a-background-wait-for.md`_
