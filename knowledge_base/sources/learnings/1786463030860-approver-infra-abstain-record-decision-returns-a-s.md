---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786441563425-oyhtal
written_at: 2026-08-11T15:43:50.860Z
---

# [approver/infra-abstain] record_decision returns a success string but the host denies the ledger write when APPROVAL_LEDGER_WRITERS is unset — no row is persisted

## Symptom
On slangpy#1100 the `record_decision` MCP tool replied "Decision recorded:
shader-slang/slangpy#1100@97717209aa48 = WOULD_APPROVE" — a success-looking
string — but a separate host system-notification then said: "record_decision
denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)".
**No ledger row was actually written.** This fired for both an ABSTAIN attempt
and later the WOULD_APPROVE attempt in the same session.

## Root cause
The host enforces that the caller's agent group holds the ledger-writer
capability (`APPROVAL_LEDGER_WRITERS`). When that env/config is unset, the append
is refused host-side. The tool's inline reply is NOT a persistence
acknowledgement — the authoritative signal is the async host notification.

## How to catch it
Do not treat the `record_decision` tool reply as proof of persistence. After
calling it, watch for a host `record_decision denied:` notification. If it
appears, the decision was derived but NOT stored — the report MUST say so
unmissably (header + status + blocker), or a reader will think the row exists.
This is an operator infra gap, not a decision defect: surface it as a blocker
naming `APPROVAL_LEDGER_WRITERS`, keep the full derivation in the per-PR
`work/<pr>-<sha>/` dir for later replay.

## Fix
In the report, state "derived; not persisted — ledger write denied" and name the
missing capability. Escalate the config gap to the operator. The decision itself
stands; only its durable recording is blocked.
