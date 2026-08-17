---
title: "[approver/challenger-miss] #11917 pass-gating early-outs: verify the skip predicate is a safe superset of every mutation site, and that any scan blind-spot is matched by the pass's own bail"
type: learning
topic: review-approval
source: learnings/1783997718788-approver-challenger-miss-11917-pass-gating-early-o.md
---

# [approver/challenger-miss] #11917 pass-gating early-outs: verify the skip predicate is a safe superset of every mutation site, and that any scan blind-spot is matched by the pass's own bail

## Symptom / shape
The #11917 backend-pass-gating epic ships one PR per pass, each adding an
early-out that SKIPS a pass when a predicate says "no work here". PR #11987
("Skip legalizeMatrixTypes when no matrix needs legalizing") is the canonical
shape: two early-outs on `legalizeMatrixTypes` — an O(1) target-family check
(`targetLegalizesMatrixTypes` false → skip) and an O(#globals) presence scan
(`hasAnyMatrixToLegalize` false → skip). Approver decided WOULD_APPROVE (CLEAN),
Devin-only fallback tier (production review skips bot-authored PRs).

## Root cause of the risk (what the challenger MUST probe on this shape)
Gating/skipping a pass is a miscompile iff the skip predicate can be
**stale-FALSE** — says "nothing to do" when the pass actually would have mutated
something. Safe only if the predicate is a **safe superset** of everything the
pass mutates. Two things to verify, every time:

1. **Trace every mutation site back to the predicate.** For #11987 the only
   mutation is `processModule` → `getReplacement`, and every rewrite branch
   gates on `shouldLowerMatrixType`. On a `!targetLegalizesMatrixTypes` target
   that predicate is *always false*, so early-out #1 skips a provable no-op.
   Also confirm the extracted predicate is byte-identical to the old inline one
   (this PR: pure refactor of the target-family switch) — a subtle change there
   would be the actual bug.
2. **A scan-based early-out's blind spot must be matched by the pass's own
   blind spot.** `hasAnyMatrixToLegalize` scans only *hoisted global*
   `IRMatrixType` insts. Its blind spot — a matrix type living only inside an
   un-specialized generic (not hoisted) — is exactly matched by
   `addToWorkList`'s `IRGeneric`-parent bail: the pass never rewrites
   generic-nested insts either. Scan and pass share the identical blind spot ⇒
   a false "nothing to legalize" can only occur where the pass would also no-op.
   The subtle case (a cast whose RESULT type needs no lowering but whose OPERAND
   type does — `(float2x2)uint2x2`) is caught because BOTH types are hoisted
   globals; it's pinned by `matrix-legalize-early-out-mixed-cast.slang`.

## How to catch it
On any #11917-shape PR: (a) grep the pass for every `replaceUsesWith` /
worklist-mutation site and confirm each is downstream of the skip predicate;
(b) if the early-out is a *scan* narrower than the pass's full walk, find the
pass's own skip/bail (here `IRGeneric`) and prove the scan's blind spot ⊆ the
pass's blind spot; (c) confirm GPU-free regression tests exist for both the
"early-out fires" (absent) and "pass must run" (present) cases, plus the exact
soundness edge the narrowed scan is built for. #11917 wants GPU-free emission
guards precisely because behavioral value-correctness is already GPU-tested.

## Fix / outcome
Both early-outs verified safe supersets; blind spot matched; edge pinned by
test. No 🔴, no unresolved 🟡. This is the transferable lesson for the remaining
#11917 slices (prior: #11920 pass #1 merged, #12068 in the same epic family):
the review is not "does the predicate look right" but "is the predicate a proven
superset of the mutation set, and is every narrowing sound against the pass's
own coverage." Related awaiting-join rows track the human-verdict calibration.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783997718788-approver-challenger-miss-11917-pass-gating-early-o.md`_
