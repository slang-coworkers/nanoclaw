---
title: "[approver/challenger-ci-gate] Confirmed: reverting a data-submodule bump restores fixtures and turns CI green — the fix for the #1082-class OPEN_GAP"
type: learning
topic: review-approval
source: learnings/1785495128502-approver-challenger-ci-gate-confirmed-reverting-a-.md
---

# [approver/challenger-ci-gate] Confirmed: reverting a data-submodule bump restores fixtures and turns CI green — the fix for the #1082-class OPEN_GAP

## Context (companion to the earlier [approver/challenger-ci-gate] note on submodule bumps)
slangpy#1082's first head (c27e1bfc9a1e) got ABSTAIN_POLICY/OPEN_GAP because a
`data` submodule bump `4c24c797`→`6ecdf7c` removed `bc7-unorm-{nonsquare,3d}.dds`,
turning CI red on 6/12 builds (unchanged `test_dds_file.cpp` couldn't open the
fixtures).

## What the fix looked like (confirmed on re-review @3a266be)
The author pushed a single commit "Restore data submodule" that reverts the pointer
back to base `main` (`6ecdf7c`→`4c24c797`). Verification that clinched WOULD-have-
approved-on-CI-grounds:
- `gh api compare <oldhead>...<newhead>` → exactly ONE changed file (`data`), all
  other files byte-identical. Confirms the push targeted only the flagged gap.
- The restored data ref contains the two fixtures again (228B / 468B).
- CI settled GREEN 12/12 (the 6 previously-red fresh-checkout jobs — linux gcc,
  macOS clang, windows msvc — all pass).

## Transferable rule
When re-reviewing a `synchronize` on a PR you abstained for a submodule/data-caused
CI regression: (1) `gh compare old...new` to see the minimal delta and confirm the
non-submodule code is unchanged; (2) re-check that the fixtures/inputs exist at the
new submodule ref; (3) WAIT for CI to fully settle on the new head before deciding —
don't decide on in-progress CI. A green re-run on a byte-identical-except-data diff
cleanly retires that specific OPEN_GAP.

## Caveat learned this round
Retiring the CI gap does NOT by itself yield WOULD_APPROVE if the head-current
review doc raises a fresh 🔴 (see [[approver-challenger-miss-head-current-red-caps-at-abstain]]).
Here Devin flagged a (false-positive) 🔴, which capped the re-review at ABSTAIN
despite green CI.
Related: [[review-approver-challenger-calibration]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785495128502-approver-challenger-ci-gate-confirmed-reverting-a-.md`_
