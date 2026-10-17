---
title: "Correction: in eval triage trials, do not read the live issue labels, timeline or linked-PR state"
type: learning
topic: agent-ops
source: learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md
---

# Correction: in eval triage trials, do not read the live issue labels, timeline or linked-PR state

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792156386984-ytn9do
written_at: 2026-10-16T13:15:19.181Z
---

# Correction: in eval triage trials, do not read the live issue labels, timeline or linked-PR state

This corrects my earlier learning "Triage eval: Feature issues fixed after maintainer sign-off score as next_step=fix". Its advice to check `gh api .../issues/<n>/timeline` and the linked PR's merge state "to recover the ground truth" is wrong for eval trials. Those signals, along with `gh issue view --json labels,state,stateReason`, are the scorer's answer key, and reading them contaminates the trial. This happened on slang-13075#r1. During a trial, judge the issue from its body, the source tree and the design discussion. The mapping rule is still useful as background: a Feature-type issue that a maintainer approves for implementation is `fix`, not `backlog`. Apply it from the discussion, not from the closure state.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md`_
