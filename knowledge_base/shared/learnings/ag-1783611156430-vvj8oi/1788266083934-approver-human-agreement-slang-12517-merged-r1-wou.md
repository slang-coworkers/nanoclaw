---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786701827585-pla3ju
written_at: 2026-09-01T12:34:43.934Z
---

# [approver/human-agreement] slang#12517 merged: R1 WOULD_APPROVE vindicated; R2 ABSTAIN was a lost-mount false-abstain

**Outcome:** shader-slang/slang#12517 merged at head 3ded8daa (merged_by jvepsalainen-nv) ⇒ human-APPROVED-equivalent. Two approver decisions existed for this PR:
- **R1 @ c1453dd7 = WOULD_APPROVE** (policy v0-shadow-wide). The merged change carried the IDENTICAL code fix (the one-line `getSimpleVal(context, val)` materialize in `visitMakeOptionalExpr`); the only diffs c1453dd7→merged were a test rewrite responding to review nits + a master rebase. → **R1 agreed with the human outcome; confirmed correct.**
- **R2 @ 3ded8daa = ABSTAIN_POLICY (CLAUSE_FAIL:author_trust)**, caused by a LOST POLICY MOUNT (operator-confirmed: the mounted v0-shadow-wide source at `/ephemeral/approver-policy` was recycled, so eval-clauses fell back to the stricter bundled v0-shadow, which drops CONTRIBUTOR from trusted_associations). Human approved → the R2 abstain was an **infra-caused false-abstain**, not a genuine policy judgment. Under the intended (restored) wide policy, R2 would also have been WOULD_APPROVE.

**Transferable signal (the class to probe next time):**
1. **A policy-mount loss silently converts correct WOULD_APPROVEs into spurious ABSTAIN_POLICY:CLAUSE_FAIL:author_trust rows.** These pollute the agreement metric as "abstains" while really being would-have-agreed. On ANY author_trust (or protected_paths / tier_eligible) fail, first check that the resolved `policy_version` matches the expected mounted one; if it silently fell back to the bundled default, tag the row `policy-mount-lost (pending operator confirm)` so it isn't scored as a genuine policy deferral. Diffing policy_version across revisions of the same PR (R1 v0-shadow-wide → R2 v0-shadow) is the cheap detector.
2. **Fix-shape confirmation:** a narrow AST→IR lowering fix that materializes an Optional payload via the canonical `getSimpleVal` (making the site consistent with its sibling `emitMakeOptionalValue` call sites) merged unchanged and was human-approved. The only post-R1 churn was test robustness (fragile `-dump-ir` IR check → a `-target spirv-asm` OpEntryPoint-completion check; `out`-param compute entry → a proper `computeMain`). Reinforces: for this shape, the code read at R1 was right; the review round-trips were about test hygiene, not the fix. Materialize-at-r-value-consumer (not producer) is the correct, mergeable layer for Ptr-flavored upcast payloads.
3. **Devin head-staleness reminder (from R2):** Devin's app.devin.ai review lagged the rebased head; don't let a stale review's commit alignment be faked — but it did not affect the outcome here.
