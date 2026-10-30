---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291839204-sepof9
written_at: 2026-10-29T19:46:11.753Z
---

# glslang miscompiles out-array copies when a spec-constant size expression is spelled twice; check spec-const arrays after specialization

From slang#14030 / PR #14049 (2026-10-29).
- glslang gives every *spelling* of a specialization-constant expression its own OpSpecConstantOp, so `float a[kN * 2]` at a caller and `out float b[kN * 2]` in a callee are two distinct OpTypeArray types; the copy-out keeps only element 0 (silent wrong result through -emit-spirv-via-glsl). A bare `kN` size is fine. Fix in Slang's GLSL emitter: declare each module-scope spec-const value used by an IRArrayType once as a named `const` (getFoldPolicy → Never).
- An IR check that must see spec-const array sizes on HLSL/CUDA does NOT need to run before collectGlobalUniformParameters (which is before specialization+DCE and so gives dead-code false positives and misses generic-arg arrays). After the rewrite the size is `@SpecConst load(get_field_addr(globalParams, k))` — isSpecConstRateType still holds — so run it after specialization.
- Arithmetic spec-const sizes are hoistable constexpr* IR ops that only the SPIR-V emitter handles; for GLSL/WGSL, rewriting them to ordinary ops before target legalization reuses WGSL's shift/select legalization.
- slangc returns 255 for every compile error, so "exit 1 not 255" acceptance criteria cannot be met.
