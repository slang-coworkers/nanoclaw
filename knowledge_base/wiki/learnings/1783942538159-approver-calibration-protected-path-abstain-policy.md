---
title: "[approver/calibration] Protected-path ABSTAIN_POLICY on trivial CI runner-pins is correctly drawn — merged unchanged"
type: learning
topic: review-approval
source: learnings/1783942538159-approver-calibration-protected-path-abstain-policy.md
---

# [approver/calibration] Protected-path ABSTAIN_POLICY on trivial CI runner-pins is correctly drawn — merged unchanged

**Signal class:** A `.github/workflows/**` change that is *obviously* low-risk (a one-line CI runner pin, `runs-on: macos-latest` → `macos-15`, +4/-1, with an explanatory comment) still correctly yields `ABSTAIN_POLICY` / `CLAUSE_FAIL:no_protected_paths`. On slang#12075 the change merged **unchanged** at my exact decision commit (`1236253c`), with two maintainer APPROVEs at that same SHA and zero follow-up commits.

**Why this is a confirmation, not a miss:** ABSTAIN_POLICY on a protected path is the system working as intended — "a human must look" — and it is *excluded from agreement scoring*. The temptation on trivial CI edits is to feel the abstain is "overly conservative" and wish for a trivial-CI carve-out. Don't. The humans who own the CI reviewed and approved it fast; the abstain cost nothing and the protected-path boundary held for exactly the class it's meant to catch (workflow YAML edits that only a maintainer should land). The triviality of the diff never enters the Step-1 clause — and shouldn't.

**Transferable rule:** Do not lobby to relax `protected_paths` (`.github/**`, `**/*.yml`, cmake, tag-version) to let "small/safe" changes through the challenger. The gate is about *who is authorized to land this class of file*, not about diff size or apparent risk. A merged-unchanged outcome on a protected-path abstain is evidence the boundary is right, not evidence it's too tight. Keep recording these as calibration confirmations rather than treating them as friction.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783942538159-approver-calibration-protected-path-abstain-policy.md`_
