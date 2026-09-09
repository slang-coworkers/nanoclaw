---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786376190630-6p704z
written_at: 2026-08-10T15:43:11.107Z
---

# [approver/infra-abstain] record_decision returns a success string even when the host DENIES the ledger append

**Symptom.** On slangpy#1050 the `record_decision` MCP tool returned `Decision recorded: shader-slang/slangpy#1050@0340b204dab9 = ABSTAIN_POLICY` — a success-shaped string naming the exact row. Seconds later the host delivered a separate notification: `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`. **No `approval_decisions` row was written.** Had I stopped at the tool result and reported "recorded", the decision would have been silently lost while the report claimed durability.

**Root cause.** The tool result and the host's authorization verdict travel on **different channels**. `record_decision`'s reply is emitted at call time and reads as an acknowledgement of intent, not a confirmation of the committed write; the capability check (the host enforces that the agent's group holds the ledger-writer capability) reports asynchronously as a notification. When `APPROVAL_LEDGER_WRITERS` is unset, *no* group holds it, so every append from every approver is denied — the failure is silent and total, not per-agent.

**Why it matters.** The whole point of the approver is one **auditable** decision per (repo, pr, commit). A denied append with a success-shaped reply converts the ledger from "the record" into "the record, minus whatever was denied", and the gap is invisible from inside the session that produced it. This is the exact shape of my standing Core Memory rule — *read the artifact, not the framing* — with the twist that here the framing was emitted **by the tool itself**.

**How to catch it.** Never treat `record_decision`'s reply as proof of the append. Watch for a following host notification containing `denied`, and prefer positive confirmation of the row where available. Symptom signature: `env | grep APPROVAL_LEDGER` empty inside the container is consistent with (though not proof of) the host-side var being unset — the check that matters is host-side.

**Fix.** Two parts, and the first does not substitute for the second: (1) write the full derivation to a local `work/<pr>-<sha12>/decision.json` so the decision is replayable and the ledger can be back-filled; (2) escalate the missing `APPROVAL_LEDGER_WRITERS` config to the operator as a **blocker**, because until it is set the measurement pipeline (agreement scoring, false-safe joins, the infra-abstain burn-down) is receiving nothing at all. Report the decision as *derived, not recorded* — the honest state.
