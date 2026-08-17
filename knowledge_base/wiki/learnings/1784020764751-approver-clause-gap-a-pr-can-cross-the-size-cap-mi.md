---
title: "[approver/clause-gap] A PR can cross the size cap mid-revision — re-score tier_eligible every revision, don't carry rev1 eligibility forward"
type: learning
topic: review-approval
source: learnings/1784020764751-approver-clause-gap-a-pr-can-cross-the-size-cap-mi.md
---

# [approver/clause-gap] A PR can cross the size cap mid-revision — re-score tier_eligible every revision, don't carry rev1 eligibility forward

**Symptom:** slang#11979 was an examples PR decided BLOCK on rev1/rev2 at ~1469-1481 changed lines (well within the 2000-line cap). On rev3 the author added a full CUDA backend (+157 main.cpp, +26 CMake) then a 507-line CUDA runtime unit test under `tools/slang-unit-test/`, pushing the full-PR diff to 2175 lines / 11 files. eval-clauses.py returned `tier_eligible=FAIL (2175 > 2000)` → terminal ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible.

**Why it matters:** Eligibility is NOT a property of the PR — it's a property of each revision's cumulative diff, and it can flip from pass to fail (or back) as the author pushes. A revision that adds a large test file or a second backend can cross the cap even though earlier revisions were comfortably under it. The prior revisions' clean `tier_eligible` never carries forward; run the script fresh on every settled head.

**How to catch it:** The clause script scores the FULL PR diff (base_ref...commit_sha, additions+deletions), not the incremental rev(n-1)→rev(n) delta — confirmed at eval-clauses.py:199/229. So a small per-push delta can still tip the cumulative total over the cap. Don't eyeball the last delta and assume eligibility holds; let eval-clauses.py compute it.

**Fix / correct outcome:** A size-cap FAIL is the policy working as intended (too large for shadow auto-review → human must look), NOT a defect to work around and NOT an infra abstain. It short-circuits Step 1 — do NOT run harvest/Devin/challenger (SKILL.md:57 maps clause FAIL→ABSTAIN_POLICY; :75 gates the challenger on Steps 1-2 passing). The co-occurring `commit_match=unevaluable` (review doc never synthesized because you short-circuited) is subordinate to the FAIL and does NOT make it ABSTAIN_INFRA. If earlier revisions had substantive findings (here: the runCpu uniformOffset OOB BLOCK), record them as *context for the human reviewer* only — never fold a prior-revision verdict into the current ABSTAIN_POLICY decision.

**Debounce note:** When the author is actively iterating (here: 4 pushes in ~30 min — CUDA backend → CMake fix → append-fix → unit test), a fixed 15-min timer must RESET on every head advance, not fire on the first. A watcher that re-fetches the head each loop and resets last_change on change handles this; one decision per settled head, not per push.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784020764751-approver-clause-gap-a-pr-can-cross-the-size-cap-mi.md`_
