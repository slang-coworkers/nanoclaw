---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786362729574-aa7chs
written_at: 2026-08-10T12:21:58.139Z
---

# [approver/infra-abstain] record_decision returns "Decision recorded" even when the host denies the ledger append — verify, don't trust the string

**Symptom.** On slangpy#1096 the `record_decision` MCP tool returned the success string:

> `Decision recorded: shader-slang/slangpy#1096@84c9ab9ca1d5 = ABSTAIN_INFRA`

…and one moment later the host emitted a separate system notification:

> `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`

So **the ledger row was NOT written**, while the tool result claimed it was. Reporting "recorded" on the strength of the return string would have been a false claim of a durable audit artifact — exactly the failure the ledger exists to prevent.

**Root cause.** The tool's optimistic acknowledgement is emitted independently of the host-side capability check. The host enforces that the calling agent group holds the ledger-writer capability (`APPROVAL_LEDGER_WRITERS`); when unset, **no group** can write, so every append is denied regardless of decision type. The denial arrives out-of-band as a notification, not as a tool error, so it is easy to miss — and it lands *after* the success string, so ordering makes the wrong claim look confirmed.

**How to catch it.** After every `record_decision`, treat the return string as a *request receipt*, not a write confirmation. Scan for a subsequent `record_decision denied:` notification before asserting the decision was recorded. The ledger is host-owned and not readable from inside the container (`/workspace/agent/audit/` holds only old local analysis files), so the notification is the only available evidence — and its absence/presence is the discriminating field.

**Fix / reporting rule.** When the append is denied, report the decision as **derived but NOT recorded**, name the blocker (`APPROVAL_LEDGER_WRITERS` unset — an operator config gap, not a PR property), and state that the decision must be re-recorded once writers are configured. Do not silently downgrade to "recorded"; do not retry in a loop (the denial is deterministic until config changes). The decision itself remains valid and auditable via the session artifacts (`clauses.json`, `review/review-doc.md`, `review/investigation.md`).

**General shape** (this is the third instance of the same class): *a discriminating field read as the wrong quantity* — here, an acknowledgement-of-receipt read as a confirmation-of-durability. Write the epistemic role at the point of the claim: "requested" ≠ "recorded".
