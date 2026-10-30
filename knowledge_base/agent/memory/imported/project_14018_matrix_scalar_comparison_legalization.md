---
type: project
name: project_14018_matrix_scalar_comparison_legalization
description: "slang#14018 (albertrodriguezclo, external, 10-29 14:29Z): Cmp(matrix, scalar) asserts in legalizeComparisonOperation on SPIR-V/GLSL (Metal/WGSL splat first). Triaged 14:37Z bug/medium/P2; reporter's own PR #14021 (14:35Z, Fixes #14018) already implements the recommended fix, so the chain is HELD with no fixer and no bot comment."
---

# slang#14018: matrix-vs-scalar comparison crashes matrix legalization on SPIR-V/GLSL

**Report (10-29 14:29Z, CONTRIBUTOR, same reporter as [[project_14010_metal_device_memory_barrier_scope]]).**
`m > 0.0` on a `float2x2` hits `SLANG_RELEASE_ASSERT(matrixTypeA && matrixTypeB)` in
`legalizeComparisonOperation` (`slang-ir-legalize-matrix-types.cpp:446`) for `-target spirv` and
`-target glsl`. The core module hits it too: `clip(float4x4)` uses `any(x < T(0))`.

**Routing.** Main webhook session `sess-1793284159468-krvyzi`. Live check before dispatch: open,
0 comments, no assignee, no timeline events, and no reporter PR yet. Forwarded to slang-triager on
`gh-issue-shader-slang/slang-14018` (triager session `sess-1793284235192-yvfqq7`), with a reporter
guard: re-check the reporter's PRs before recommending a fixer.

**Triage (14:37Z, reproduced on master `01dcd3568`).** bug / medium / P2, IR matrix legalization.
Not a duplicate, not a regression. `cmp(matrix, scalar)` is canonical IR (the core-module overloads
in `core.meta.slang:3229-3237` emit it, and HLSL/CUDA/C++ take it as is), so the consumer owns the
fix. Metal/WGSL only work because `legalizeScalarOperandsToMatchComposite` splats the scalar before
`legalizeMatrixTypes`. #11675 never considered the scalar case. Recommended fix A2: broadcast the
scalar once to a row vector and compare every row with it. Memo:
`/workspace/inbox/a2a-1793284676670-qqy2ko/triage-14018.md`.

**Held (14:38Z).** The reporter opened PR #14021 at 14:35Z, 6 minutes after filing (not a draft,
"Fixes #14018", head `a2f9e442a`, +24/−7, test `tests/bugs/matrix-scalar-comparison.slang`). It
implements A2. No fixer was dispatched, and the triager posted no issue comment: the linked
ready-for-review PR is the resumable artifact. The triager set label `reproduced` and type Bug
(verified). No timer: webhooks deliver the PR's close/merge.

**Resume on:** #14021 closed without merging, a maintainer request, or an @nv-slang-bot mention.
The memo already holds a fixer brief.
