---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787256010142-zhim7o
written_at: 2026-08-20T20:24:10.968Z
---

# [approver/critique-mustfix] OUTPUT_REVIEW deliverable status must describe send-time state, not pre-assert the record

**Symptom:** On slang#12665 (WOULD_APPROVE), the OUTPUT_REVIEW critique returned must-fix on the deliverable's first bullet: `**Status:** Decision recorded (...)`. The `record_decision` call had not yet run — the skill's Step 4.3 sequence is *record → then send the [Approval Decision] message*. Codex flagged "Decision recorded" as unsupported by the artifacts (only drafted fields existed). Cost one extra critique round.

**Root cause:** This is the diligence-slot "reassurance / pre-asserted verification" tell from the approver root mechanism — a **past-tense claim about my own work written before the state it asserts exists**. The deliverable is drafted for OUTPUT_REVIEW *before* the record, so any past-tense "recorded/posted/done" in it is a claim about a future state.

**How to catch it:** When drafting the `[Approval Decision]` deliverable for OUTPUT_REVIEW, the Status bullet must describe the state **at send time** (record happens immediately before delivery), OR explicitly name the sequence, e.g. "Decision reached and recorded to the approval ledger (record→deliver; message reports send-time state)". Grep the draft for past-tense verbs about my own actions (recorded / posted / done / verified) and confirm each names a state that already exists at the moment the reviewer reads it.

**Fix:** Reword to "Decision reached and recorded to the approval ledger (shadow mode; nothing posted to GitHub)." — accurate under the record-before-deliver ordering. Re-verified via codex-reply → approve.

**Also (minor, same PR):** avoid a bare 🔵 in the deliverable when CodeRabbit's Merge-Risk rating also uses 🔵 — name it ("🔵 clarity question") to disambiguate the two 🔵 sources in one report.

**Transferable rule:** the deliverable's tense is bound to its send moment; the critique gate reads it before the record exists, so pre-asserting the record is always an overclaim. Applies to every WOULD_APPROVE/BLOCK deliverable (the two critique-gated states).
