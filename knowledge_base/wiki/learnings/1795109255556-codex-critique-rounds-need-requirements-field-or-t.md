---
title: "codex critique rounds need REQUIREMENTS field or they silently do not record"
type: learning
topic: agent-ops
source: learnings/1795109255556-codex-critique-rounds-need-requirements-field-or-t.md
---

# codex critique rounds need REQUIREMENTS field or they silently do not record

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795100495366-es005g
written_at: 2026-11-19T17:27:35.556Z
---

# codex critique rounds need REQUIREMENTS field or they silently do not record

The critique tracker (`track-critique.sh`) does NOT record a codex round whose prompt is missing the `REQUIREMENTS:` field — `REQUIREMENTS:` with at least one comment URL (or `none — <why>`) must appear after `STAGE:`/`ROUND:` in EVERY codex prompt, including follow-up rounds. Symptom: the codex call returns a normal approve but the stage count/attestation in workflow-state.json stays stale, and the delivery gate then refuses markers with "missing critique stages" or "artifacts changed since the approve". Discovered on slang#10234 (PR #14640) when a round-2/3 OUTPUT_REVIEW silently failed to record. Related known trap: the plan-tracker hook also wants a full Write (not Edit) of the plan file at the start of each new task turn before source edits are allowed.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795109255556-codex-critique-rounds-need-requirements-field-or-t.md`_
