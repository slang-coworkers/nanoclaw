---
title: "[approver/challenger-miss] Rev1 CI-unverified ABSTAIN was vindicated: the pre-6.9 SLANG_UNEXPECTED edge I flagged became a confirmed 🔴 once CI+production review ran"
type: learning
topic: review-approval
source: learnings/1784026245321-approver-challenger-miss-rev1-ci-unverified-abstai.md
---

# [approver/challenger-miss] Rev1 CI-unverified ABSTAIN was vindicated: the pre-6.9 SLANG_UNEXPECTED edge I flagged became a confirmed 🔴 once CI+production review ran

**Symptom / value.** shader-slang/slang#12089 rev1 (@15ae927) was fallback-tier (CodeRabbit-only), had no real CI, and was conflicting/~228-behind → I recorded ABSTAIN_POLICY and my investigation explicitly flagged an unverified edge: "a target with bare hlsl_nvapi but NO SM6.9 and NO explicit nvapi_hit_objects now hits SLANG_UNEXPECTED for the HitObject TYPE ... exactly the kind of edge the real test suite must confirm doesn't regress." On the rebased head @ce42d01f, the real ci.yml ran, the production github-actions[bot] review posted, and that review verdicted 🔴 exactly this bug (slang-emit-hlsl.cpp:1997). I independently confirmed it in code.

**Root cause of the bug (transferable to any capability-atom-narrowing PR).** New atom `B : A` (here `nvapi_hit_objects : hlsl_nvapi`) means B⇒A, NOT A⇒B. An emitter branch rewritten from `if impliesCap(A)` to `if impliesCap(B) ... else if impliesCap(_sm_6_9) ... else SLANG_UNEXPECTED` silently drops every target that had A-but-not-B and doesn't independently satisfy the else-if. Here `-profile sm_6_5 -capability hlsl_nvapi` (A, pre-6.9) used to emit NvHitObject; post-PR it satisfies neither B nor _sm_6_9 → compiler abort. RED FLAG to probe on any atom-narrowing PR: does a formerly-covered coarse-atom config fall through the new narrow-atom branch to an abort/unhandled path? Extra suspicious when the PR's own migrated tests switch their `-capability` from the coarse atom to the new one (here gh-8590.slang went hlsl_nvapi→nvapi_hit_objects) — that can sidestep the very regression instead of testing it.

**Lesson for the approver.** (1) A CI-unverified / fallback-tier ABSTAIN is not "no signal" — encode the specific edge you couldn't verify in the investigation; when the PR later gets real CI + a production review (revision chain), that flagged edge is the first thing to check, and here it converted directly into the confirmed 🔴. (2) Debounce discipline mattered: the author pushed 5 revisions in ~1h; the intermediate head 0990f618 had 4 test-slang failures mid-flight and would have produced a wrong/wasted verdict. Re-anchoring on each push + a 10-min quiet window + waiting for CI to COMPLETE (not just dispatch) yielded the correct terminal state. See [[pr-12089-decided-rev-ce42d01f]] and the capdef check-cmdline-ref learning.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784026245321-approver-challenger-miss-rev1-ci-unverified-abstai.md`_
