---
title: "PR-review heuristic: when a fix adds a null-possible invariant + helper, audit ALL structurally-identical sites"
type: learning
topic: review-process
source: learnings/1781792411472-pr-review-heuristic-when-a-fix-adds-a-null-possibl.md
---

# PR-review heuristic: when a fix adds a null-possible invariant + helper, audit ALL structurally-identical sites

When a Slang PR fixes a null-deref by (a) establishing a new invariant ("`m_param` can be null while the entry-point *result* is legalized") and (b) adding a safe-access helper (`getUnsupportedVaryingDiagnosticLoc()` → falls back to `m_entryPointFunc->sourceLoc`), grep for EVERY structurally-identical access of the same member, not just the ones on the path that crashed.

Concrete case (shader-slang/slang#11661, fixing #11659): PR converted the two `diagnoseUnsupported{System,User}Val` helpers in `slang-ir-legalize-varying-params.cpp` but left a third identical `m_param->sourceLoc` read at ~`:2112` in the CUDA `HitAttributes` path (`createLegalUserVaryingValImpl`). That override IS reachable from result legalization (`processEntryPoint:459 → createLegalVaryingVal → _createLegalVaryingVal → createSimpleLegalVaryingVal → createLegalUserVaryingValImpl`) with the PR's new reset making `m_param` deterministically null there. Whether it's a latent crash hinges on an unproven reachability hop (can a *result* be classified `HitAttributes`?). Both the correctness reviewer (Reviewer A) and the clarity reviewer (Reviewer C) flagged it independently — strong convergence signal.

Why this matters for reviewing: a missed sibling site reads as either an oversight or a latent crash of the same class as the bug just fixed. The reviewer's ask should be "assert the invariant (`SLANG_ASSERT(m_param)` documenting it's never a result here) OR reuse the helper for consistency" — a justification, not necessarily a code change.

Related companion finding: a per-entry-point scratch-state reset comment that resets BOTH `m_param` and `m_paramLayout` may over-claim — verify which member is actually read on the hazard path. In #11661 only `m_param` is read during result legalization; `m_paramLayout` is read solely in the param path (set fresh before its reads), so resetting it is hygiene, not a result-path UAF fix. Flag the comment, not the reset.

How to apply: on any PR that adds a null-guard/fallback helper for a member, `grep` the whole file for `<member>->` and confirm each remaining raw deref is either unreachable under the new null-possible condition or asserts/uses the helper. Same logic applies to use-after-free resets — check the comment names the member that's actually read on the dangerous path.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781792411472-pr-review-heuristic-when-a-fix-adds-a-null-possibl.md`_
