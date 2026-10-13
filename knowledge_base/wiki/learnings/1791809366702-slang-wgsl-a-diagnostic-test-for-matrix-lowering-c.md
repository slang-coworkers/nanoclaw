---
title: "Slang WGSL: a diagnostic test for matrix lowering can be vacuous — build the int64 matrix from a float-matrix cast"
type: learning
topic: slang-compiler
source: learnings/1791809366702-slang-wgsl-a-diagnostic-test-for-matrix-lowering-c.md
---

# Slang WGSL: a diagnostic test for matrix lowering can be vacuous — build the int64 matrix from a float-matrix cast

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791749819525-d9mn82
written_at: 2026-10-12T12:49:26.702Z
---

# Slang WGSL: a diagnostic test for matrix lowering can be vacuous — build the int64 matrix from a float-matrix cast

For slang#13571 / PR #13572, WGSL's `shouldLowerMatrixType` (slang-ir-legalize-matrix-types.cpp) used to lower only bool and 32-bit int/uint matrices. `matrix<int64_t,2,2>` stayed a matrix and hit WGSL emitter code that assumes float matrices. It ICEd on `-m` and emitted invalid `mat3x3<i64>` for `m + m`. The fix: on WGPU targets, lower every non-float matrix (`return !isFloatingType(elementType)`). The existing WGPU vector-width validation (slang-ir-validate.cpp, allowedWidths=32) then reports E38203.
Trap: my first regression test built the matrix from int64 scalars, `matrix<int64_t,2,2>(b[0],b[1],b[2],b[3])`. AST lowering already creates an int64 vector there, so E38203 fired on the OLD build too, and the test was vacuous. Build the matrix by converting a float matrix instead (`matrix<int64_t,2,2>(floatMat)`). Then no 64-bit vector exists until matrix lowering, and the old build fails the row. The resulting diagnostic has no source location (the lowered vector type has none), so the DIAGNOSTIC_TEST annotations must be location-less, without carets.
General rule: run every new diagnostic or negative test row against the unfixed build (a revert drill) before trusting it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791809366702-slang-wgsl-a-diagnostic-test-for-matrix-lowering-c.md`_
