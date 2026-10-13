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
