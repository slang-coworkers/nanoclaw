---
type: chain
title: "slang#13301 — header-guard PR #13742 (fixes slangpy#1204); slangpy#1206 parked on operator A/B/C"
description: "#13742 MERGED 10-22 (653bfdeef), #13301 closed. slangpy#1204/#1206 open: waiting on the operator's A/B/C pick and on a Slang release after v2026.20 plus a slangpy pin bump. Re-chase rechase-slangpy-1204-pr1-1158 (11-01 10:30Z)."
---

# slang#13301: header guard (#13742) and the slangpy#1204 / #1206 tail

Split out 2026-10-30 from the [#13169 index row](index.md) and
[[13169-bwd-diff-runtime-loop-hang.md]], which bundled this chain until then.

## Current state (2026-10-29 re-chase)

| item | state |
|---|---|
| slang#13742 (header guard, slang-fixer `sess-1789716207340-dwbdoz`) | **MERGED** 10-22 04:02:51Z by saipraveenb25, merge commit `653bfdeef`; worktree + sentinel removed |
| slang#13301 | closed as completed |
| slangpy#1204 | open, assigned saipraveenb25 |
| slangpy#1206 (draft workaround, head `27ddfd3b`) | open, CI green, no reviews, assigned jkwak-work; no human comments since 2026-10-09T22:37Z |
| Slang release containing `653bfdeef` | none: latest is v2026.20 (10-17), slangpy pin still `e7bb22421` |
| Re-chase | `rechase-slangpy-1204-pr1-1158` (11-01 10:30Z), thread `gh-issue-shader-slang/slangpy-1204` |

## Open decisions (operator, asked 10-19; re-reported 10-20/22/23/26/29)

- **#1206:** A = mark ready as the interim fix; B = hold until #13742 ships and the pin is bumped, then cut #1206
  down to the regression test; C = close. B's gate is the next Slang release after `653bfdeef` plus the pin bump.
- **Follow-up issue** for 3 spellings + 4 segfaults: still open, and nothing tracks it.
- **Docs example** at `docs/src/tensors/differentiable.rst:143`: fix or not.
- Moot: un-draft #13742 (a human did it), and the slangpy#1204 mention.

## History (condensed)

- 10-09 21:10Z: saipraveenb25 asked whether dropping `[Differentiable]` from functions with a custom derivative
  works (intended usage; the double-conformance bug should still be fixed). The fixer tested it: the workaround is
  partial, and it recommended the guard PR (21:56Z).
- 10-18 02:45Z: saipraveenb25: "open a PR with the header fix", closing #13301 and slangpy#1204; the conditional
  `__func_extension` case is deferred. Draft #13742 (`e2d4abb15`) opened 03:29Z; review APPROVE_WITH_NITS; its
  bot-dispatched CI sat `waiting` (priority-yield + falcor gate).
- 10-19: slangpy-fixer verified #13742 fixes slangpy#1204 on unmodified slangpy main (vk+cuda L40S: interface
  load/store 0→3; #1206 test 0/20→20/20), matching slang-reviewer. The #1206 question was re-framed as A/B/C.
- 10-21 07:29Z: saipraveenb25 marked #13742 ready (team `dev`); CI 39562318710 ran. 10-22: merged (above);
  `rechase-slang-13301-pr13-19d8` cancelled.
- 10-23, 10-26, 10-29 re-chases: no movement (no release after v2026.20; the only new slangpy main commit is
  slang-rhi bump `fc387a78c` #1248; no human comments; no operator answer).

New re-chase results append to the History section here, not to the index row.
