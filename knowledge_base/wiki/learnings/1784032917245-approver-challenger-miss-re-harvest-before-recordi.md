---
title: "[approver/challenger-miss] Re-harvest before recording — primary review can post mid-session after a Devin-only draft (slang#11377)"
type: learning
topic: review-approval
source: learnings/1784032917245-approver-challenger-miss-re-harvest-before-recordi.md
---

# [approver/challenger-miss] Re-harvest before recording — primary review can post mid-session after a Devin-only draft (slang#11377)

## Symptom

On slang#11377 (`synchronize` on a PR whose head was a fresh master-merge), the
first `harvest-reviews.py` returned **exit 10 (stale-only)**: the production
`github-actions[bot]` review existed only against the pre-merge commit. I
correctly fell to the Devin-only tier, and Devin came back **0 bugs / 0 flags**.
An initial doc + challenger reached a preliminary **WOULD_APPROVE**. The
DECISION_REVIEW critique gate (codex) then read live GitHub state and found the
production review had **posted a head-current review at 12:19:50Z** — mid-session,
while I was synthesizing — with **🔴 1 bug + 4 gaps**. Re-harvest flipped the
tier to primary and the decision to **BLOCK**.

## Root cause

The claude-pr-review bot re-runs on every push and takes **15–40 min** on complex
autodiff PRs. When the head is a fresh push/merge, harvest at t0 legitimately
returns exit-10/22, but the primary review lands minutes later. A decision
recorded off the Devin-only draft would have been a **false-safe** (Devin missed
the bug the primary caught).

## The bug Devin missed (why diff-shaped reviewers win here)

The 🔴 was a **switch-completeness gap**: `isReadNoneCallee`'s `IRTranslateBase`
switch handles `kIROp_TrivialBackwardDifferentiatePropagate` and
`kIROp_BackwardPropagateFromLegacyBwdDiffFunc` but NOT plain
`kIROp_BackwardDifferentiatePropagate` → `default: return false` → the new
`isReadNoneCalleeAndAllDerivatives` gate mis-fires on concrete
auto-differentiated `[__readNone][Differentiable]` callees → spurious E41031,
re-introducing the #11286 false-positive the PR meant to preserve. Devin's
narrative reviewer glossed it; a diff/enum-completeness reviewer catches it.
**Lesson: a missing `case` in an unwrapping/translation switch is a high-value
probe whenever a PR adds a helper that layers on top of such a switch.**

## How to catch it

1. **On harvest exit 10/20/22, don't record off Devin-only until you re-harvest
   at decision time.** If a review bot check-run is `in_progress` on the pinned
   head (`gh api commits/<sha>/check-runs | select(.name=="review")`, or the
   "Claude PR Review" workflow run in_progress), the primary signal is IMMINENT —
   poll it to settle, then re-harvest. I waited ~40 min and it still hadn't shown
   as posted via the check-run, but it HAD posted as a review; **re-harvest, don't
   trust the check-run status alone.** The last action before `record_decision`
   should be a fresh `harvest-reviews.py`.
2. The critique gate (DECISION_REVIEW) reading live state is the backstop that
   caught this — but don't rely on it; re-harvest proactively.

## Fix

Procedure: after the challenger and immediately before assembling the ledger row,
re-run `harvest-reviews.py` one final time. If it now returns exit 0 (primary
posted), rebuild the review doc from the primary body and re-run the full
Step 1–2 parse before recording. One decision per settled revision — and
"settled" includes "the primary reviewer has finished," not just "the author
stopped pushing."

## Line-number gotcha (audit accuracy)

The harvested review body cites **diff-hunk line numbers** (`slang-ir-util.cpp:89`),
not pinned-head source lines (the real `default: return false` was `:3255`; `:89`
is `isPointerOfType`). When writing `reason_code`, resolve the finding to a
source-accurate `file:line` at the pinned commit; keep the verbatim review block
unedited and add a reconciliation note outside it. OUTPUT_REVIEW will (correctly)
must-fix a reason_code that cites the diff-hunk line.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784032917245-approver-challenger-miss-re-harvest-before-recordi.md`_
