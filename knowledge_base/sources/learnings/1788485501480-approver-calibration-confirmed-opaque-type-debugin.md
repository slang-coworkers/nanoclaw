---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788227517717-7yikf3
written_at: 2026-09-04T01:31:41.480Z
---

# [approver/calibration-confirmed] Opaque-type DebugInfoNone SPIR-V fix merged unchanged — advisory doc/coverage nits were correctly non-blocking

**Signal.** slang#12858 ("Fix SPIR-V debug info for opaque types") merged at the exact commit the approver decided on (62f6564f6825), with a formal human `APPROVED` from maintainer jkwak-work and no follow-up commits. The approver had returned ABSTAIN_POLICY (`CLAUSE_FAIL:head_provenance`, fork head) on both revisions.

**Calibration — the abstain was correct-by-design, not a miss.** A fork-head ABSTAIN says "a human must look"; the human looked, approved, and merged. ABSTAIN rows are excluded from agreement scoring, so this is neither a false-safe nor a scored disagreement — it is the fork-head policy gate resolving exactly as intended. Do not treat "abstained, then it merged" as an error to correct.

**Transferable gap-severity lesson (the part that sharpens future Step-3 calls).** The review's three findings — (1) numeric struct-size path only tested at size 0, (2) missing doc comment on the new `getDebugInfoNone()`, (3) unexplained/asymmetric `"@"` linkage-name convention — were all merged **unaddressed**. This vindicates grading them advisory/non-blocking. The reusable rule for this *class* of change (a SPIR-V debug-info emit fix that swaps a literal-0 Size operand for a cached `DebugInfoNone` on opaque composites): when the numeric-size branch is only a mechanical `IRInst*`→`SpvInst*` adaptation via `ensureInst(...)` that emits the identical operand it always did, the absence of a non-zero-size regression test is genuinely inconsequential (the branch is exercised by every existing struct-with-members debug test), and doc-comment / linkage-name-convention findings are clarity nits, not gaps that undermine the fix.

**False-safe probe outcome (confirms the discipline works).** The prior-learning probe "would the regression test go RED on pre-fix output?" was satisfied here: the new test's end-anchored (`{{$}}`) `DebugTypeComposite` lines require a new `@`-prefixed `OpString` linkage name AND the `DebugInfoNone` size operand, both absent pre-fix, plus an empty-struct control asserting a genuine size-0 struct still emits `%uint_0`. The clean merge confirms that end-anchored operand-count discrimination + a same-file control is a sufficient test shape for opaque-type debug-info fixes — no under-discrimination false-safe materialized.
