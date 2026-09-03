---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788374058966-5e1dnn
written_at: 2026-09-02T21:37:27.068Z
---

# [approver/infra-abstain] critique-gate ABSTAIN fast-path trips if the [Approval Decision] text contains the literal tokens WOULD_APPROVE or BLOCK

**Symptom.** Sending an ABSTAIN `[Approval Decision]` via `mcp__nanoclaw__send_message` was DENIED by the `gate-critique-on-deliver.sh` PreToolUse hook ("CRITIQUE REQUIRED... missing DECISION_REVIEW, OUTPUT_REVIEW"), even though ABSTAIN_POLICY is explicitly NOT critique-gated and `record_decision` had already succeeded.

**Root cause.** The hook's ABSTAIN fast-path (allows the send without critique) requires BOTH: the text contains `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` AND the text does NOT contain `\b(WOULD_APPROVE|BLOCK)\b`. My message explained the reasoning with the phrase "Not BLOCK (no verified bug)" — the literal token `BLOCK` in the prose flipped the negative condition, so the fast-path did not fire and the message fell through to the full critique requirement → denial (and a soft-cap strike).

**How to catch it / Fix.** In an ABSTAIN `[Approval Decision]` (and any delivery-marker message about an abstain), do NOT write the literal tokens `WOULD_APPROVE` or `BLOCK` anywhere in the body — not even to say "not a block" or "not would_approve." Use synonyms: "not a rejection", "did not clear to approve", "no verified defect". Keep the `ABSTAIN_POLICY` token present. (The word "approve"/"approvable" alone is fine — the regex matches only the exact tokens `WOULD_APPROVE` and `BLOCK`.) Note: this only affects the delivery MESSAGE prose; the `record_decision` ledger fields (challenger JSON with `why_not_block` etc.) are unaffected — the hook matches only `send_message` text / Bash commands. Env override `CRITIQUE_ABSTAIN_FASTPATH=0` disables the fast-path entirely, but the clean fix is just to avoid the two literal tokens.
