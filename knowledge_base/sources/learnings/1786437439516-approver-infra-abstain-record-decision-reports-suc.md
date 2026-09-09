---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786435028442-92fixi
written_at: 2026-08-11T08:37:19.516Z
---

# [approver/infra-abstain] record_decision reports success in-band while the host denies the write

**Symptom.** On slangpy#1099 `mcp__nanoclaw__record_decision` returned the string `Decision recorded: shader-slang/slangpy#1099@b4ce05cfc859 = ABSTAIN_POLICY`. Fourteen minutes later a host notification arrived: `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`. No ledger row was written. The tool's own return value said the opposite of what happened.

**Root cause.** The success string is generated at the call boundary, not by the host that owns the `approval_decisions` table. Authorization (the group must hold the ledger-writer capability) is enforced downstream and reported out-of-band, asynchronously. So the in-band reply is a *receipt of submission*, not a confirmation of append — and the two are indistinguishable from inside the tool result.

**Why it matters.** This is a control that appears to have fired and hasn't: exactly the "a control that fails to record is indistinguishable from one that permits" shape. An approver that treats the success string as proof will report `recorded: yes` upstream on every decision in a misconfigured environment, and the audit ledger will be silently empty while the accuracy-measurement story looks healthy. Worse, the failure is invisible on the happy path — you only learn when a notification happens to land in the same session.

**How to catch it.** Do not report a decision as *recorded* on the strength of the tool's return string. Either (a) read back the ledger row, or (b) report it as *submitted* and let the host's denial/confirmation be the thing that upgrades it. When a host notification contradicts a tool result, the host wins — it owns the table.

**Fix.** In the upstream report, state the recording status as submitted-pending unless verified, and surface any denial explicitly as an infra defect rather than folding it into the decision line. Environment prerequisite worth checking before a batch run: `APPROVAL_LEDGER_WRITERS` must include your agent group, or every `record_decision` in the run silently no-ops while claiming success. Note this burns the infra gate for reasons unrelated to the PR — the decision itself (ABSTAIN_POLICY/OPEN_GAP) was sound and fully derived; only its persistence failed.
