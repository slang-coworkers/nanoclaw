---
title: "[approver/human-disagreement] ABSTAIN_INFRA on a green-CI doc+mirror-arm PR: the abstain was procedurally right and outcome-wrong; log the shape, not the regret"
type: learning
topic: review-approval
source: learnings/1786117966658-approver-human-disagreement-abstain-infra-on-a-gre.md
---

# [approver/human-disagreement] ABSTAIN_INFRA on a green-CI doc+mirror-arm PR: the abstain was procedurally right and outcome-wrong; log the shape, not the regret

## Symptom

slangpy#1095: I recorded **ABSTAIN_INFRA / NO_REVIEW_SIGNAL** (all three review
sources absent or failed). **90 seconds later** the PR merged at *exactly* my
pinned commit `0370e7cb59c7` — single commit, **no follow-up commits**, approved
by `skallweitNV`, CI finishing 18/18 green with 0 failures.

So the pipeline could not decide, and the change was in fact fine. ABSTAIN_INFRA
rows are excluded from agreement scoring, so this costs no accuracy — but
discarding it as "not scored" wastes the strongest calibration signal available.

## Root cause

Two independent facts got conflated in my own read, and separating them is the
lesson:

- **The abstain was correct.** No bot review was harvested and Devin
  auth-failed → `reviewers_complete: false` → Step 2 short-circuits. That is the
  honest label; guessing from a diff I had only read advisorily would have been
  a self-review, which the procedure forbids precisely because it feels safe.
- **The change was low-risk in a way that was legible before the merge**, and I
  had already written down why in `investigation.md` without letting it update
  my sense of the *stakes* of abstaining.

I also flagged two gaps a human "should weigh" — no trigger-present test for the
CUDA arm, and an unreviewed 11-commit submodule bump. The domain expert on those
exact files approved anyway, immediately. Both gaps were real observations; my
implied severity was miscalibrated for this shape.

## How to catch it (the transferable part)

**Recognize the "mirror-arm + doc-sync" shape.** This PR's entire non-submodule
delta was: add an `else if (device_type == cuda)` arm that does, for `"nvrtc"`,
exactly what the adjacent pre-existing arm does for `"dxc"` — plus doc-comment
edits and their generated `py_doc.h` counterparts. Cheap positive signals that
this shape is low-risk, all available from the diff alone:

- **The precedent is in the same file.** `shader.cpp:389-396` already passed an
  nvrtc `DownstreamArgs` under the identical `device_type == cuda` guard. A new
  arm that mirrors an established call in its own neighborhood is far weaker
  evidence of risk than a novel code path.
- **Structural symmetry, not new logic.** No new state, no new ordering, no new
  lifetime. Both arms iterate the same user-supplied container into the same
  API with a different literal target name.
- **Generated-file consistency.** `py_doc.h` hunks matching the header
  doc-comments verbatim is evidence the author ran the generator — a small but
  real signal of care.
- **Cache-key safety was checkable and checked** (`getSessionDescDigest` at
  `shader.cpp:533-536` runs after the args are added).

For **gap severity on this shape**: an untested conditional whose guard is a live
runtime check on user-supplied input, where the trigger requires hardware CI does
not have (no CUDA runner on slangpy), is weaker than my `OPEN_GAP` lean implied.
Distinguish it sharply from the dead-flag case the standing probe targets — there
the guard has *no setter anywhere* and the guarded work can never run. Here the
setter is the caller. The both-directions probe should still *ask*, but "no CUDA
runner exists to assert it" is a different, milder finding than "this flag is
never set".

## Fix

Recorded `record_human_verdict` = APPROVED for
`shader-slang/slangpy#1095@0370e7cb59c7`. Keeping the ABSTAIN_INFRA as recorded —
it accurately names a pipeline defect, and the two sibling `[approver/*]`
learnings from this session (the Devin checks-panel false-clean, and the
zero-review-source coverage hole) are the actionable residue. The calibration
takeaway is narrow and specific: **mirror-arm + doc-sync changes with in-file
precedent are a low-risk shape, and "untestable in this CI" ≠ "dead code"** —
neither of which licenses inventing a verdict when the harness produced none.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786117966658-approver-human-disagreement-abstain-infra-on-a-gre.md`_
