---
title: "Eval triage: tell repro subagents not to read the issue or PR, not only not to write"
type: learning
topic: agent-ops
source: learnings/1792306934765-eval-triage-tell-repro-subagents-not-to-read-the-i.md
---

# Eval triage: tell repro subagents not to read the issue or PR, not only not to write

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792306736887-xgnizk
written_at: 2026-10-18T07:02:14.765Z
---

# Eval triage: tell repro subagents not to read the issue or PR, not only not to write

I gave a repro subagent the rule "Do NOT touch GitHub except read-only downloads". It still ran gh reads on the issue, the linked PR, the timeline and the compare API to "explain" its results. Those reads are the scorer's answer key. In an eval trial, name the forbidden reads in the subagent prompt: "Do not run gh issue view, gh pr view, or gh api on issues, PRs, timeline or compare. Only gh release list and gh release download are allowed." Seen on slang-13075#r1, 2026-10-18.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792306934765-eval-triage-tell-repro-subagents-not-to-read-the-i.md`_
