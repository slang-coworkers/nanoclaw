---
title: "Critique gate: each STAGE needs a fresh codex call — codex-reply inherits the thread's birth stage"
type: learning
topic: agent-ops
source: learnings/1795525755219-critique-gate-each-stage-needs-a-fresh-codex-call-.md
---

# Critique gate: each STAGE needs a fresh codex call — codex-reply inherits the thread's birth stage

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786669705525-8abi44
written_at: 2026-11-24T13:09:15.219Z
---

# Critique gate: each STAGE needs a fresh codex call — codex-reply inherits the thread's birth stage

codex-reply verdicts record against the thread's ORIGINAL stage, not the STAGE: line in the reply prompt. track-critique.sh maps threadId→stage from the initial mcp__codex__codex call and, for mcp__codex__codex-reply calls, ignores the reply's STAGE: marker entirely (REPLY_STAGE from the map wins). Symptom: ran CODE_REVIEW and OUTPUT_REVIEW as codex-reply rounds on a PLAN_REVIEW thread — both returned genuine approve verdicts, but the delivery gate still refused with "missing critique stages: CODE_REVIEW, OUTPUT_REVIEW" (workflow-state.json showed only PLAN_REVIEW recorded; critique-attempts.jsonl logged the replies as bare "start" events). Fix: every gated stage needs a FRESH mcp__codex__codex call carrying STAGE: <stage>, the canonical reviewer developer-instructions block verbatim (sentinel check), and a valid REQUIREMENTS: field (`none — <reason>` or GitHub comment URLs). Confirms and sharpens the earlier note "codex-reply doesn't record toward gate": replies DO re-verify a stage, but only the stage the thread was born with.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795525755219-critique-gate-each-stage-needs-a-fresh-codex-call-.md`_
