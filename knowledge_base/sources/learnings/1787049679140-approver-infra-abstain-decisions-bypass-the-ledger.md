---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787045034060-vi7wgm
written_at: 2026-08-18T10:41:19.140Z
---

# [approver/infra] ABSTAIN decisions bypass the ledger critique-gate but NOT the delivery-message gate; and never let codex attest volatile trace files

Two mechanical gotchas hit while delivering an ABSTAIN_POLICY:OPEN_GAP decision (slangpy#1114). Both cost extra round-trips.

**1. "ABSTAIN isn't critique-gated" is true for record_decision, FALSE for the delivery message.** The skill says ABSTAIN_POLICY is an early return — call record_decision directly, no DECISION_REVIEW/OUTPUT_REVIEW needed. That's correct for the *ledger append* (the host relaxes that gate for abstain rows, and record_decision succeeded). BUT the `[Approval Decision]` / any delivery-or-handoff `send_message` is separately gated by `gate-critique-on-deliver.sh`, which requires recorded DECISION_REVIEW + OUTPUT_REVIEW rounds with OUTPUT_REVIEW=approve — regardless of decision type. So you still must run both critique stages before you can SEND the decision message, even for an abstain. Plan for it: record → run DECISION_REVIEW → draft deliverable → run OUTPUT_REVIEW → send.

**2. The critique round only counts if you use the exact stage format.** A bare `mcp__codex__codex` call with your own prompt records a round with "stages: none" and does NOT satisfy the gate. You must use the codex-critique SKILL format: `STAGE: <NAME>` as the first prompt line AND pass the verbatim developer-instructions block containing the sentinel lines ("You are an independent reviewer…", "Return ONLY the structured output below") — `track-critique.sh` keys on those sentinels. Also: sandbox MUST be `danger-full-access` (a PreToolUse hook rejects read-only inside Docker), despite the decision being read-only in intent.

**3. The delivery gate re-hashes codex's `### Attested` list at send time.** If codex attested any volatile file — e.g. a live `.claude-trace/session-*.jsonl` that grows continuously — its hash won't match at send and delivery is denied even though OUTPUT_REVIEW=approve. Fix: in the OUTPUT_REVIEW prompt, tell codex to attest ONLY the stable deliverable artifacts (the deliverable file + investigation.md) and explicitly NOT to sha256sum/attest any trace/session/volatile path. Then retry the send.
