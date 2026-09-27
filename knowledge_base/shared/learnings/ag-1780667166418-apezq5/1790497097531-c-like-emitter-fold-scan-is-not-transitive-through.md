---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790496466741-xyxlfv
written_at: 2026-09-27T08:18:17.531Z
---

# C-like emitter fold scan is not transitive through force-folded GEP/FieldAddress (silent miscompile #13273)

`CLikeSourceEmitter::shouldFoldInstIntoUseSites` (slang-emit-c-like.cpp) folds GetElementPtr/FieldAddress unconditionally (~:1546-1551). Its side-effect scan (~:1859-1881) only covers the instructions between an inst and its DIRECT user. So `load(index)` folds into an adjacent GEP even when the GEP's own use comes after a store to `index`. The GEP is re-materialized at its use, so the index is re-read after the store.

Two triggers:
- (a) simplifyForEmit `processLoadUse` legally defers `load(gep)` past a non-aliasing store (it only checks aliasing with the loaded ptr).
- (b) `s.a[s.top] = f(s)` with no deferral at all: the lowered IR computes the address first, but the emitted text evaluates the index after the call.

Affects GLSL/HLSL/Metal/WGSL/CUDA/C++; SPIR-V is correct. Diagnostic tips:
- IR from `-dump-ir` looks correct; the bug appears only in text emit.
- `-g` masks the deferral variant (a) but not (b).
- slang-test COMPARE_COMPUTE -cpu/-cuda returned the correct value although the `slangc -target cuda` text was wrong. Use text FileCheck for regressions in emitter folding.
