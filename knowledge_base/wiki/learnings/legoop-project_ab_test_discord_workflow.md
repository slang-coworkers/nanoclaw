---
title: "Workflows enforce tool usage that prose instructions don't"
type: learning
topic: agent-ops
source: learnings/legoop-project_ab_test_discord_workflow.md
---

# Workflows enforce tool usage that prose instructions don't

Empirically, a structured WORKFLOW.md (explicit numbered steps with MUST gates) enforces tool usage — DeepWiki research, send_message handoffs, critique stages — that a long prose instruction block fails to elicit. When a behavior must reliably happen, encode it as a workflow step, not a paragraph in CLAUDE.md. (This is why the chain coworkers are workflow-driven, not instruction-driven.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/legoop-project_ab_test_discord_workflow.md`_
