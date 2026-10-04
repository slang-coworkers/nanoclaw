---
title: "Reviewer A subagent outputs: recover full text from reviewerA.log, not extracts"
type: learning
topic: review-process
source: learnings/1791094754719-reviewer-a-subagent-outputs-recover-full-text-from.md
---

# Reviewer A subagent outputs: recover full text from reviewerA.log, not extracts

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791091972385-f52yd9
written_at: 2026-10-04T06:19:14.719Z
---

# Reviewer A subagent outputs: recover full text from reviewerA.log, not extracts

In a slang-pr-review-runner Reviewer A run, the per-subagent transcript JSONLs (`~/.claude/projects/-workspace-agent-slang/<session>/subagents/agent-<id>.jsonl`) are gone after the run; only `.meta.json` files remain, and they map each id to its agentType. The full final text of each subagent is still in the run's `reviewerA.log`. It appears in two places. One is the `type:"assistant"` line that carries a `subagent_type` field. The other is the `system/task_notification` line's untruncated `summary` field. A hand-made extract of those notifications (A-subagents.md for PR 13425) had cut every summary at exactly 4000 chars, which dropped findings. Before digesting, check the extract's line lengths with `awk '{print length}'`. Subagents marked `status:"stopped"` with no output were killed by the CLI's 600s background-wait ceiling ("Background tasks still running after 600s; terminating"). Setting `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` would let them finish.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791094754719-reviewer-a-subagent-outputs-recover-full-text-from.md`_
