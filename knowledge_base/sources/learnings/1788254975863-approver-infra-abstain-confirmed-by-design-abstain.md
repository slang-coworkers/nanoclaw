---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786801515391-3iic2t
written_at: 2026-09-01T09:29:35.863Z
---

# [approver/infra-abstain] CONFIRMED by-design: ABSTAIN_INFRA is retired — use ABSTAIN_POLICY + infra reason_code (correction to prior atom's framing)

Correction/confirmation to my earlier atom ("record_decision host enum is 3-state … ABSTAIN_INFRA rejected"). I had framed the ABSTAIN_INFRA rejection as a possible skill-vs-host discrepancy "worth reconciling." The orchestrator verified against the authoritative host source: it is **not a bug — it is by design.**

`ABSTAIN_INFRA` was **deliberately retired (host task #14)**. The live `VALID_DECISIONS` set is exactly `{WOULD_APPROVE, BLOCK, ABSTAIN_POLICY}`, and `isValidDecision` now **rejects `ABSTAIN_INFRA` automatically**. The host source comment: *"'the pipeline couldn't decide' now records `ABSTAIN_POLICY` with an infra reason_code."*

**The prescribed pattern (do this, don't attempt the retired state):** for an infra-driven abstain, emit `decision:"ABSTAIN_POLICY"` with one of the infra `reason_code`s — `NO_REVIEW_SIGNAL`, `HARNESS_FAIL`, `CLAUSE_UNEVALUABLE:<name>`, `CHALLENGER_INCOMPLETE`, `CRITIQUE_UNAVAILABLE`, `STALE_STAGE`. Never emit `decision:"ABSTAIN_INFRA"` (it's accepted-then-ignored, so the decision silently doesn't record).

The `slang-pr-approver` SKILL.md still advertises a 4-state taxonomy (…| ABSTAIN_INFRA | ABSTAIN_POLICY) — that is **stale**; an operator update was requested. Treat ABSTAIN_POLICY as the only abstain state and carry infra-vs-policy in the reason_code (infra reason_codes above vs policy reason_codes CLAUSE_FAIL:<name>/OPEN_GAP/CHALLENGER_CONCERN/CRITIQUE_MUSTFIX/ESCALATED). Infra reason_codes are still excluded from agreement scoring; the state label just collapses to ABSTAIN_POLICY.

Note on reason_code choice when BOTH an infra gap and a merits gap exist (as in slang-rhi#841 R4): if you can still decide on the merits (e.g. clauses pass under the reconstructed policy-of-record, and the challenger independently reaches OPEN_GAP), record the merits reason_code (OPEN_GAP) and document+escalate the infra gap separately — the orchestrator explicitly endorsed this over forcing CLAUSE_UNEVALUABLE. Use an infra reason_code only when the infra gap actually prevents deciding.
