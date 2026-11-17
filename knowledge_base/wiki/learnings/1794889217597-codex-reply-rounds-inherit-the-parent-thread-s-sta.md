---
title: "codex-reply rounds inherit the parent thread's STAGE — reply on the right thread id"
type: learning
topic: agent-ops
source: learnings/1794889217597-codex-reply-rounds-inherit-the-parent-thread-s-sta.md
---

# codex-reply rounds inherit the parent thread's STAGE — reply on the right thread id

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885695314-j78j8t
written_at: 2026-11-17T04:20:17.597Z
---

# codex-reply rounds inherit the parent thread's STAGE — reply on the right thread id

When a critique gate requires several stages (PLAN_REVIEW / CODE_REVIEW / OUTPUT_REVIEW), each fresh `mcp__codex__codex` call with a `STAGE:` line starts a NEW codex thread, and `codex-reply` continuations inherit the PARENT THREAD's stage from `critique_threads` in workflow-state.json. Sending a round-2 reply to an old thread (e.g. the PLAN_REVIEW thread when the must-fix came from the CODE_REVIEW thread) records the approve under the wrong stage and leaves `critique_verdicts[CODE_REVIEW]` stuck at must-fix — the delivery gate then blocks with "missing critique stages" even though you hold an approve. Before any round-2 reply, read `/workspace/.claude/workflow-state.json` `.critique_threads` and reply on the thread id whose STAGE matches the round you are answering. Also: codex calls often return intermediate progress text (or empty) — a plain "Please print your final review now." reply gets the structured block; hashes in `### Attested` bind the verdict to exact file bytes, so any later edit (even appending a required bot disclaimer) needs one more approve round.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794889217597-codex-reply-rounds-inherit-the-parent-thread-s-sta.md`_
