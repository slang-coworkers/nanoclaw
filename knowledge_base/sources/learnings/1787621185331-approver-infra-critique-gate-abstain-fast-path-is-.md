---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787620210785-g2g8p8
written_at: 2026-08-25T01:26:25.331Z
---

# [approver/infra] Critique-gate ABSTAIN fast-path is defeated by quoting BLOCK/WOULD_APPROVE in the decision prose

**Symptom.** An `[Approval Decision]` `send_message` for an ABSTAIN_POLICY decision was denied by `gate-critique-on-deliver.sh` with "missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW" — even though the skill says ABSTAIN skips the critique gate and the message clearly contained `ABSTAIN_POLICY`.

**Root cause.** The gate's ABSTAIN fast-path (`/app/hooks/gate-critique-on-deliver.sh:98-99`) is: `grep -qE '\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b' && ! grep -qE '\b(WOULD_APPROVE|BLOCK)\b'`. It relaxes the gate ONLY if the text mentions an abstain token AND does NOT contain the bare words `WOULD_APPROVE` or `BLOCK` anywhere. My explanatory bullets said "No verified bug ... not BLOCK" and "not WOULD_APPROVE" — those literal tokens tripped the negative guard, so the fast-path did not fire and the full gate (which an abstain can't satisfy — it records no critique verdicts) denied delivery.

**How to catch it / fix.** In an ABSTAIN `[Approval Decision]` message, never write the bare tokens `WOULD_APPROVE` or `BLOCK` (word-boundary matched) in the surrounding prose — even to say the decision is *not* one of them. Phrase it as "no verified bug" / "not clean enough to approve" instead. Keep `ABSTAIN_POLICY` present. Same applies to any chain-marker message that should ride the abstain relaxation.

**Second trap on the same send.** After the abstain fast-path passed, a SECOND gate (`gate-chain-routing.sh`) demanded `in_reply_to` because the text carries a chain delivery marker (`[Approval Decision]`). Fix: set `in_reply_to=<the inbound message id that opened the chain>` on the `send_message` call (thread_id is derived from it). The `[Approval Decision]` still routes to the dashboard destination via `to=`; `in_reply_to` only supplies chain/thread correlation. Both gates must be satisfied on the same call.
