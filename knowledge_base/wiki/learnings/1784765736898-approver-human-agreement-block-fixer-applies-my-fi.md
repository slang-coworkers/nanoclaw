---
title: "[approver/human-agreement] BLOCK→fixer-applies-my-fix→APPROVED-merge is a vindication; but merge-join onto an earlier BUGGY commit is NOT (guard the false-safe)"
type: learning
topic: review-approval
source: learnings/1784765736898-approver-human-agreement-block-fixer-applies-my-fi.md
---

# [approver/human-agreement] BLOCK→fixer-applies-my-fix→APPROVED-merge is a vindication; but merge-join onto an earlier BUGGY commit is NOT (guard the false-safe)

**Context:** slang #12122 (bot-authored, Devin-only tier) went: @9fe3de9e WOULD_APPROVE (false-safe, recorded on incomplete CI) → @1499ff68 BLOCK (RED_BUG: new E00046 diagnostic false-positived on pre-existing valid command lines like `glsl_450+spirv_1_5`, verified by 29 test-slang failures) → fixer pushed the family-match narrowing → further review hardening (csyonghe + jkwak, 07-16→07-19) → **MERGED @6b5ba29f by jkwak-work (≠author), reviewDecision=APPROVED.**

**Vindication signal (the BLOCK was right):** The merged code shipped **exactly the fix my BLOCK identified as required** — `doesCapabilityRaiseTargetVersionAboveProfile` now takes an explicit `targetVersionFamily` derived from `profile.getFamily()` and gated on the output target (`isSPIRV`/`isMetalTarget`), plus a `!conflictingProfilesSet` guard, later generalized to DX/GLSL families with capdef-derived bounds. My R2 root-cause (the old code inferred the version family from "first version atom found," so a GLSL profile's SPIR-V floor atom made `+spirv_1_5` misread as a raise) was precisely what the fix addressed. **BLOCK → the fix I predicted → APPROVED-merge is a clean end-to-end shadow hit:** a Devin-clean PR (Devin doesn't run tests, missed it) whose real regression I caught via CI-verification, and which had to be fixed before it could merge.

**The false-safe trap to guard against:** `record_human_verdict` on a merge maps the terminal APPROVED onto EVERY decided commit row for that PR — including the earliest one. So my @9fe3de9e WOULD_APPROVE row ALSO shows human_verdict=APPROVED. **That is coincidental, not vindication.** The code at 9fe3de9e was genuinely buggy and I approved it on incomplete CI; what shipped is a *different, fixed* version. A naive agreement-scorer that reads "WOULD_APPROVE row + human APPROVED = hit" would launder a false-safe into a success and erase the lesson. When a PR has multiple decided revisions and merges after fixes, only the revision whose CODE matches the merged code can claim genuine agreement; earlier superseded/fixed revisions must be scored on whether THAT revision's code was sound, not on the terminal merge state.

**Transferable rules:**
1. A merge-APPROVED join is strongest evidence for the decision on the revision that actually shipped (or is byte-identical to it). For earlier revisions that were fixed before merge, the join is mechanical noise — judge them on their own commit's correctness.
2. A BLOCK that is followed by "fixer implements the exact fix you named, then it merges APPROVED" is the ideal calibration outcome — record it as a hit and note the predicted-fix match, because it proves the shadow reviewer added real value (caught a regression a clean Devin-only doc missed).
3. Reconfirm the vindication by diffing the merged head's relevant logic against your BLOCK rationale — don't assume the merge means your specific concern was addressed; here I verified the family-match code shipped at merged-head options.cpp:4477-4525.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784765736898-approver-human-agreement-block-fixer-applies-my-fi.md`_
