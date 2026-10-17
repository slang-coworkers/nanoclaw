---
type: project
name: project_13446_spirv_int_matrix_column_major_layout_ignored
description: "slang#13446: on SPIR-V/GLSL/WGSL/Metal, legalizeMatrixTypes runs before buffer-storage lowering, so int/uint/bool buffer matrices ignore column_major while reflection honours it (silent wrong value; array form is a #12992 regression). jkwak-work chose option 1 (honour the layout). DRAFT PR #13699 @ e1d678088e (fixer q7uc6d, 2 review rounds done) held awaiting maintainer review; CI waits on maintainer approval. History in project_13446_history_triage_to_draft_pr."
metadata:
  node_type: memory
  type: project
---

# slang#13446: SPIR-V integer-matrix buffer members ignore column-major layout

**Bug.** `legalizeMatrixTypes` (`slang-ir-legalize-matrix-types.cpp:77-104`, called at slang-emit.cpp:2072) lowers every
int/uint/bool `matrix<T,R,C>` to `vector<T,C>[R]` at std430 stride 16 before `lowerBufferElementTypeToStorageType`
(:2617) can build the transposing `_MatrixStorage_*_ColMajor` form. Reflection honours `column_major`, so the shader reads
the wrong element: reflection puts `k` at 24, SPIR-V at 32; `float2x3` gives 24/24. Float is fine on every target. Int is
wrong on SPIR-V (direct and via GLSL), GLSL, WGSL and Metal; correct on HLSL/DXIL, CUDA and CPU. The single-member form
dates to #7687 (v2025.13); the `column_major` array form under a row-major default is a #12992 regression
(`a459ba415b`). Related: #13382.

**Decision.** jkwak-work (assignee) rejected option 2 (have reflection report the row-vector layout) on 10-15: *"we
shouldn't ignore "column_major" keyword."* So option 1: honour the layout, implemented by moving the pass order.

**Live state (10-16 15:00Z).**
- **DRAFT PR #13699**, head `fix/issue-13446` @ `e1d678088e`, 18 commits, 18 files, +981/−124, `pr: non-breaking`,
  closes #13446. Owned via PR mapping by slang-fixer `sess-1791310101653-q7uc6d` on `gh-issue-shader-slang/slang-13446`;
  triager `sess-1791304536740-1mhykc` holds the issue thread.
- Verified on L40S: master int reads 12/12 wrong, branch 0/12, float unchanged; 721/721 after the R2 fix.
- slang-reviewer ran its 2 capped rounds (R1 4 regressions, R2 1 crash), all fixed with tests. No R3.
- Issue comment 6212398869 (updated 14:56Z) and explanation comment 6212392566 are the GitHub artifacts.
- **CI:** dispatched run 38918751635 is `waiting` (workflow_dispatch approval); on PR run 38918760167
  `wait-for-human-priority`/`check-ci` skip and test jobs are skipped. It waits on a maintainer approval or priority
  call, not on the draft flag — I guessed wrong about that at 14:54Z.

**Parked.** Re-chase cap used (r1/r3), tracked in the task-hygiene parked register. Marking ready, approving CI and
merging belong to the operator or a maintainer; never mark ready or merge from the bot. Webhooks route to the fixer.

**Unfiled out-of-scope findings** (all also fail on master), offered to the operator: LLVM ConstantBuffer layout vs
reflection (any struct); GLSL `int << int2x2`; CPU/CUDA `int2x2 << int2x2`; CPU `column_major bool2x3` reflection size 6
(24 on LLVM/SPIR-V). WGSL bool storage is already #13590 / draft #13607.

**History** — filing, triage, the float/target answer, fixer handoff, the 10-16 credential and GPU-passthrough scares,
and both review rounds: [[project_13446_history_triage_to_draft_pr]].
