---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788065699290-u7npmh
written_at: 2026-09-03T16:40:24.703Z
---

# [approver/human-disagreement] MERGED at my ABSTAIN(tier_eligible) commit — the challenger crash-find shipped as a fix; size-cap abstains on trusted+green PRs join as approved

**PR:** shader-slang/slang#12830 MERGED at 2c465113b90f — the EXACT commit of my R3 decision (ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible), no post-decision commits, self-merged by the author-maintainer (tangent-vector/Theresa Foley), reviewDecision=REVIEW_REQUIRED (core-maintainer self-merge, no formal GitHub approval review).

**Outcome vs my decisions (3 revisions, all ABSTAIN):**
- R1 (41872045): ABSTAIN ci_green_on_sha — I challenger-found + BUILD-REPRODUCED a SIGSEGV (isSlang202cOrLater dereffed null m_module on the reflection API path) that BOTH the fresh production review AND Devin cleared as "0 bugs / memory-safety clean."
- R2 (2e2484d9): that null-deref was FIXED; a new primary-review 🔴 (SLANG_RELEASE_ASSERT module abort) appeared. ABSTAIN tier_eligible.
- R3 (2c465113): the R2 🔴 was FIXED (createForOptionalModule factory). ABSTAIN tier_eligible. → MERGED here.

**Transferable calibration lessons:**
1. **The build-verified challenger crash-find was the highest-value output of the whole engagement, and it SHIPPED as a fix.** Both production bots missed a real SIGSEGV; my independent reproduction (running the pre-existing reflection unit test at head vs master) caught it, and the author fixed exactly that (plus its cascade) before merge. Confirms: when a stale review flags a 🔴 and a redesign RELOCATES the flagged call, re-derive + reproduce at head — the defect often survives, and catching it pre-merge is worth the build cost. Do NOT trust "N bots agree it's clean" over a reproduction.
2. **tier_eligible ABSTAINs on {trusted-author (MEMBER/OWNER) + CI-green + all review-🔴 resolved} predictably join as MERGED/approved.** A ~1101-line refactor merged as-is at the commit I abstained on purely for size. This is the size cap WORKING AS INTENDED (defer large PRs to a human), and ABSTAIN is excluded from agreement scoring — it is NOT a miss. But when reporting such an abstain, frame it explicitly as "code looks clean; deferring to a human only because of size," not as latent risk — otherwise a reader misreads a policy-abstain as "still broken."
3. **A core maintainer self-merging with reviewDecision=REVIEW_REQUIRED is the norm here** — the merge IS the human approval signal even without a formal approve review. Map merged⇒approved regardless of reviewDecision.
4. **When the merged head == your last decision commit, there is no decision→merge gap to mine** — the PR shipped exactly as you last assessed it; the calibration signal is purely decision-vs-outcome, which here validates both the challenger find (fixed) and the size-cap policy (correctly deferred).
