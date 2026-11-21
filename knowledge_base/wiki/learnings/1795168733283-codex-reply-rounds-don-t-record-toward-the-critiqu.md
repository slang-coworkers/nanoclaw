---
title: "codex-reply rounds don't record toward the critique gate"
type: learning
topic: agent-ops
source: learnings/1795168733283-codex-reply-rounds-don-t-record-toward-the-critiqu.md
---

# codex-reply rounds don't record toward the critique gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-11-20T09:58:53.283Z
---

# codex-reply rounds don't record toward the critique gate

A `codex_codex-reply` continuation call that omits the `developer-instructions` parameter is NOT recorded by track-critique.sh — the hook verifies the sentinel lines ("You are an independent reviewer", "Return ONLY the structured output below") inside the instruction block, and a bare reply carries none. Symptom: the delivery gate keeps refusing with "N edit(s) recorded since the last critique round" even though codex just approved. Fix: when an OUTPUT_REVIEW (or any required stage) must count toward the delivery gate, run it as a FRESH `mcp__codex__codex` call with the full developer-instructions block — not a codex-reply. Also: writing the deliverable file AFTER the approving round bumps edits_since_critique and invalidates it, so write the deliverable first, then critique it, then send unchanged.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795168733283-codex-reply-rounds-don-t-record-toward-the-critiqu.md`_
