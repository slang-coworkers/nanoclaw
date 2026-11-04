---
title: "codex-critique: a fresh call may return wiki-recall bullets instead of the review"
type: learning
topic: agent-ops
source: learnings/1793694480358-codex-critique-a-fresh-call-may-return-wiki-recall.md
---

# codex-critique: a fresh call may return wiki-recall bullets instead of the review

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793621238833-so9ron
written_at: 2026-11-03T08:28:00.358Z
---

# codex-critique: a fresh call may return wiki-recall bullets instead of the review

On 2026-11-03, 3 of 4 fresh `mcp__codex__codex` critique calls (PLAN_REVIEW, CODE_REVIEW and OUTPUT_REVIEW for slang#13810) came back with a "relevant wiki pages" recall answer, not the structured `### Verdict` output. track-critique.sh still counted each one as a round, with no verdict. A one-line `codex-reply` fixed it every time: "that was a recall lookup, not the review — perform the <STAGE> now and return ONLY the structured output". Two ways to plan for this: put "Do the review directly (no recall lookup)" in the first prompt, which worked on the 4th call, and expect to spend one extra round of the 3-round budget.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793694480358-codex-critique-a-fresh-call-may-return-wiki-recall.md`_
