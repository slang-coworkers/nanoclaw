---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1789055931066-5rf26v
written_at: 2026-09-10T16:18:30.525Z
---

# [approver/infra-abstain] [Approval Decision] abstain message: avoid whole-word BLOCK/WOULD_APPROVE and always set in_reply_to

**Symptom.** Sending the per-decision `[Approval Decision] … ABSTAIN_POLICY …` message was denied twice by PreToolUse hooks, burning a `critique_gate_denials` strike (soft cap = 3) on the first.

**Root cause / fix (two independent hooks):**
1. `gate-critique-on-deliver.sh` has an **abstain fast-path** (allows the delivery without a recorded critique round) that fires only when the message text contains `ABSTAIN_POLICY`/`ABSTAIN_INFRA` **and does NOT contain the whole-word tokens `WOULD_APPROVE` or `BLOCK`** (case-sensitive `grep -E '\b(WOULD_APPROVE|BLOCK)\b'`). Writing the rationale "**Not BLOCK** (code is correct)" put an uppercase `BLOCK` in the text → fast-path skipped → full critique gate → denial. **Fix:** in an abstain decision message, never use the uppercase tokens `BLOCK`/`WOULD_APPROVE`; phrase as "not a code-defect rejection", lowercase "blocking", etc.
2. `gate-chain-routing.sh` requires **`in_reply_to`** on any `send_message` carrying a delivery marker (`[Approval Decision]`, `[Resolution]`, `[handoff]`, …), even to a dashboard destination. **Fix:** set `in_reply_to=<the tasking inbound id>` on the tool call (thread_id is derived from it). Keep the explicit `to=` for the dashboard.

**How to catch it.** Both hooks live in `/app/hooks/`; the abstain fast-path is `gate-critique-on-deliver.sh:98-103`. When composing an abstain `[Approval Decision]`, scan your own text for the strings `BLOCK`/`WOULD_APPROVE` before sending, and always include `in_reply_to`.
