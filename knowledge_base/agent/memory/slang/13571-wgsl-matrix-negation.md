---
type: chain
title: slang#13571 — WGSL matrix negation emitted as `matNxM<f32>(0) - m`
description: "andy-slater, human-filed WGSL codegen bug: unary minus on a matrix emits an invalid single-scalar matrix constructor. Follow-on to #12908 / our merged PR #12909. Dispatched to slang-triager 2026-10-11."
---

# slang#13571

**2026-10-11 19:2xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments,
no labels, no assignee, human-filed by andy-slater, `updated_at` = `created_at`, live body length
matches the payload. The only session on `gh-issue-shader-slang/slang-13571` was this Main
webhook session, so nobody owned it.

Context: #12908 (natevm, closed) was the vector-negation parenthesization bug; our PR #12909
(merged 2026-09-12) fixed the parentheses for vectors and matrices but left the
`matNxM<f32>(0) - m` form, which WGSL rejects (no single-scalar matrix constructor, no unary `-`
on matrices). Reporter's accepted forms: `m * -1.0f` or per-column `matNxM(-m[0], -m[1])`.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13571`.

**2026-10-11 20:15Z, triaged** (slang-triager, [cmt 6113276208](https://github.com/shader-slang/slang/issues/13571#issuecomment-6113276208)):
bug / P2 / target-emit (WGSL), labels `reproduced` + `WebGPU`, Type=Bug. Root cause is the WGSL
`kIROp_Neg` case in `slang-emit-wgsl.cpp:1756-1778`, which lowers both vector and matrix negation
to `(T(0) - x)`. It isn't a #12909 regression: the `T(0)` form came in with #7936 (v2025.14,
mirroring Metal), and the older base `-m` was never valid WGSL either. #12909's test
`tests/wgsl/neg-vector-precedence.slang:41` pins the invalid form and has to be updated.
Recommended fix A is `(T(-1) * x)` for matrices, which keeps -0 parity. The prototype passes naga on 17
variants. Rejected: B `matCxR<T>() - x` (loses -0), C IR legalization, D per-column.

**20:16Z, handed to `slang-fixer`** (`sess-1791749819525-d9mn82`, same canonical thread):
draft PR `Fixes #13571`, non-breaking. The triager owns the issue side and the fixer owns the PR side.

**Open side decision (operator):** sibling gap where scalar `uint` negation emits `- x`, which naga
rejects, and `(u32(0) - x)` validates. It's out of the PR scope and mentioned publicly in the
triage comment. Not filed. Whether to file it is the operator's call.

**2026-10-11 22:21Z, draft PR [#13572](https://github.com/shader-slang/slang/pull/13572)** (verified live): head
`d08201af30`, `fix/issue-13571`, `pr: non-breaking`, closes #13571, 3 files +115/−12 (`slang-emit-wgsl.cpp`,
new `tests/wgsl/matrix-negation.slang`, updated `neg-vector-precedence.slang`). The pr-mapping goes to the fixer session.
The fixer is waiting on the slang-reviewer verdict before sending its final [Fix Report]. The triager edited its comment to say "fix in draft PR #13572". Re-chase: `rechase-13571-wgsl-matne-de5e` (10-13 16:00Z),
which also re-asks the operator about the scalar-uint sibling if it's still open.

**2026-10-12 14:00Z, triage resolved** (verified live). Draft #13572 is at head `46ac7f64a7`: 9 bot commits, 5 files
+160/−17. It adds `legalizeMatrixTypes` (`slang-ir-legalize-matrix-types.{cpp,h}`), which lowers every non-float matrix on WGPU so that
int64/int16/uint8 never reach the float-only Neg branch. Master already rejects those types with E38203, and the test pins it.
Internal slang-reviewer ran 2 rounds, both REQUEST_CHANGES with 0 bugs and 2 gaps each. All gaps are fixed, but the round-2 fixes
weren't re-reviewed because of the 2-round cap. Devin timed out in both rounds. The PR description uses the repo hook's 4-section format, not the CLAUDE.md 5-part one
(rationale: explain cmt 6114547878). jkwak-work is assignee and requested reviewer, with 0 GitHub reviews so far. CI run 38259151868 is
`waiting` on the workflow_dispatch approval gate. Re-chase `rechase-13571-wgsl-matne-de5e` has been refreshed.

**Unfiled follow-ups (operator call, asked 10-11 / 10-12):** (1) scalar `uint` `-u` emits `- x` on WGSL; (2) the CPU
prelude `SLANG_MATRIX_UNARY_OP` indexes `result[i].rows[i][j]` (wrong index), so float-matrix `-m` breaks on `-cpu`;
(3) double matrices ICE on WGSL and BFloat16 matrices emit invalid WGSL; (4) float-matrix `%` emits invalid WGSL.

**2026-10-13 16:00Z, re-chase (no change).** Verified live: draft #13572 is still at head `46ac7f64a7`, last updated 10-12 13:55Z, with 0 reviews
and no human comments on #13571 or #13572. The only event is jkwak-work milestoning #13571 to "Q4 2026 (Fall)" (10-12 16:22Z). CI run 38259151868
is still `waiting`, and the pull_request CI jobs are SKIPPED because the PR is a draft. The status went to orchestrator-dashboard only. The 4 follow-ups
were re-asked there (3rd ask, msg id 11); none is filed (search confirmed). Next one-shot is `rechase-13571-wgsl-matne-7189` at 10-16 16:00Z.
If that ask is still unanswered then, park it and don't re-ask.

**2026-10-16 16:00Z, re-chase (no change).** Verified live: draft #13572 is still at head `46ac7f64a7`, last updated 10-12 13:55Z.
It has 0 reviews (jkwak-work is the requested reviewer and assignee) and no human comments or timeline events on #13571 or #13572
since 10-13 16:00Z. CI run 38259151868 is still `waiting`. The fixer session `sess-1791749819525-d9mn82` is active but its container
is stopped, last active 10-12. Nothing was routed. Status went to orchestrator-dashboard only.
**The 4 follow-ups are PARKED-UNANSWERED.** I read the dashboard session from seq 498209 to 505358 (10-10 to 10-16 15:51Z) and found no
operator reply to the 10-13 3rd ask (row 500418). Per the standing order I don't ask again. None is filed (GitHub search, created ≥10-11).
Act on them only if the operator brings them up. Next one-shot: `rechase-13571-wgsl-matne-ef8e` at 10-20 16:00Z.

**2026-10-20 16:00Z, re-chase `-ef8e` (unchanged #3 of 3) → PARKED.** Verified live: draft #13572 is still OPEN at head
`46ac7f64a7`, last updated 10-12 13:55Z, 9 commits. It has 0 reviews (jkwak-work is the requested reviewer and assignee),
0 inline comments, and no timeline events on #13571 or #13572 since 10-16 16:00Z. #13571 is OPEN with labels `WebGPU` +
`reproduced` and the Q4 2026 (Fall) milestone. **CI run 38259151868 now returns 404 and the head SHA has 0 Actions runs or
check-runs.** The gated run was removed, not completed. The same thing happened to #13590's gated run 38462553148, so it is a
repo-wide cleanup of old `waiting` runs (the oldest live `waiting` run is from 09-16) and not specific to this PR. Whoever flips the PR
ready has to re-trigger CI. Nothing was routed and nothing was posted to GitHub. Status went to orchestrator-dashboard only.
The dashboard session from seq 505360 to 506340 (10-16 16:02Z to 10-20 15:54Z) has no operator answer on the 4 follow-ups, so they
stay PARKED-UNANSWERED and I didn't re-ask. None is filed. **No re-chase re-armed.** The chain is in the parked-chain register
(`.task-hygiene/state.json` `parked["shader-slang/slang#13571"]`, refs #13571 + #13572, count 3), and `reports/parked-chains.md`
was regenerated. Webhooks still deliver review and comment events to the fixer session through the pr-mapping. To resume, run
`task-hygiene.py unpark shader-slang/slang#13571`.
