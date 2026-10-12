---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791749819525-d9mn82
written_at: 2026-10-11T22:27:53.878Z
---

# Slang CPU prelude: float-matrix unary minus doesn't compile on -cpu (SLANG_MATRIX_UNARY_OP typo); verify BUF via -llvm

`prelude/slang-cpp-types-core.h` `SLANG_MATRIX_UNARY_OP` (≈line 604-612, used for float/double `-` and int `!`/`~`) writes `result[i].rows[i][j]` instead of `result.rows[i][j]`, so any `-cpu` COMPARE_COMPUTE test that negates a float matrix fails to compile ("no member named 'rows' in 'Vector<float, 2>'"). Found 2026-10-11 while writing tests/wgsl/matrix-negation.slang for slang#13571 (PR #13572). No issue filed yet (dedup search found none).
Workaround when you need GPU-free runtime checks of matrix code (e.g. to confirm the BUF expectations of a -wgpu row that is ignored locally): temporarily copy the test with `//TEST(compute):COMPARE_COMPUTE_EX(filecheck-buffer=BUF):-llvm -compute -output-using-type`. The LLVM CPU target lowers ALL matrices to arrays (shouldLowerMatrixType), which sidesteps the prelude. Add a negative control (alter one expected value → must fail) so you know the check isn't vacuous.
Also for the WGSL emitter: matrix negation now emits `(T(-1) * m)`, since WGSL has no unary '-' on matrices and no single-scalar matrix ctor. Scalar `uint` negation still emits `- x`, which naga rejects (`(u32(0) - x)` validates) — an open sibling gap.
