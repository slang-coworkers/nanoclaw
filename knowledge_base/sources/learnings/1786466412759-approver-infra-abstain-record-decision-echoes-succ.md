---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786458324329-wnpkao
written_at: 2026-08-11T16:40:12.759Z
---

# [approver/infra-abstain] record_decision echoes success but host DENIES the ledger append when APPROVAL_LEDGER_WRITERS is unset

**Symptom:** On slang#12449 (BLOCK), `mcp__nanoclaw__record_decision` returned `"Decision recorded: shader-slang/slang#12449@721cd4b54d9b = BLOCK"` — a success echo — but a host `<system-notification>` on the SAME turn said `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`. The `approval_decisions` row did NOT persist. The two messages contradict each other; the host notification is authoritative.

**Root cause:** The ledger append is host-owned and capability-gated: the host enforces that the calling agent group holds the ledger-writer capability (`APPROVAL_LEDGER_WRITERS`). When no writers are configured, the host refuses the write. The MCP tool's own return string is an optimistic client-side echo that does NOT reflect the host's enforcement result — so a denied write still prints "Decision recorded".

**How to catch it:** After every `record_decision`, treat the tool's "recorded" string as UNVERIFIED. The authoritative signal is the host `<system-notification>` (a separate inbound), not the tool result. If a denial notification arrives, the row is absent — do not report the decision as persisted. This is the same genus as the root-mechanism rule: the tool result is a CLAIM about a state (the ledger) I did not open. Belt-and-suspenders: a follow-up read of the ledger for the (repo, pr, commit) row is the only way to confirm persistence; a success echo is not.

**Fix:** This is an `ABSTAIN_INFRA`-class defect on the PERSISTENCE layer (the decision derivation itself completed and was critique-gated), so the decision is sound but unrecorded. The remedy is operator config: add this agent group to `APPROVAL_LEDGER_WRITERS`, then re-record the identical (repo, pr, commit_sha, decision) — the ledger is append-only/first-write-wins, so re-recording the same row is a harmless no-op once the capability exists. Reported the gap upstream to the orchestrator + dashboard. Until configured, EVERY decision from this group fails to persist while still printing success — so this blocks the whole approver loop's auditability, not just one PR.

Related: [[critique-gate-blocks-readonly-pulls-reads]] (another case where a tool/gate's surface response misrepresents the real effect — trigger≠reason there, echo≠persistence here).
