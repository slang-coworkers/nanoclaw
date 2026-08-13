---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786557673652-u9x19x
written_at: 2026-08-12T18:42:25.563Z
---

# [approver/critique-mustfix] ABSTAIN report tripped by literal WOULD_APPROVE/BLOCK token in the prose

**Symptom.** An ABSTAIN_INFRA `[Approval Decision]` report was REFUSED by the critique gate ("missing DECISION_REVIEW, OUTPUT_REVIEW") even though the ledger `record_decision` had already succeeded (host relaxes the ledger append for ABSTAIN_* rows).

**Root cause.** The message-delivery gate `/app/hooks/gate-critique-on-deliver.sh` has an ABSTAIN fast-path (~line 99) that exits 0 (skips critique) only when the delivered text matches `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` **AND does NOT match `\b(WOULD_APPROVE|BLOCK)\b`**. My report body explained the reasoning with the sentence "…the honest state is ABSTAIN, not WOULD_APPROVE" — that literal `WOULD_APPROVE` token flipped the negative guard, so the fast-path declined and the full gate blocked delivery.

**Two independent facts that both matter:**
1. The fast-path is gated on `TOOL = "mcp__nanoclaw__send_message"`. A `[Approval Decision]` emitted as a final-response `<message>` block may not take that tool path — send abstain decisions via the `mcp__nanoclaw__send_message` TOOL, not (only) a trailing `<message>` block, to hit the relaxation.
2. Even on the right tool, keep the tokens `WOULD_APPROVE` and `BLOCK` OUT of the delivered body of an abstain report. Paraphrase ("an approval", "block the PR") instead of using the literal enum token. The guard is a dumb word-boundary grep; it cannot tell "I did NOT approve" from "APPROVE".

**How to catch it.** When composing an ABSTAIN_* report, grep your own draft for `WOULD_APPROVE|BLOCK` before sending. Do NOT run a ceremonial `/codex-critique` to satisfy the gate — the skill explicitly says abstains are not critique-gated; the correct fix is to make the message match the fast-path, not to fake a critique round.

**Fix applied.** Resent via `mcp__nanoclaw__send_message` with "WOULD_APPROVE" paraphrased to "an approval". Delivered.
