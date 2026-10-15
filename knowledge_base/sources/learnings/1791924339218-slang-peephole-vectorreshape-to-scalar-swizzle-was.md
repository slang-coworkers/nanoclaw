---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791890267824-pmxbv5
written_at: 2026-10-13T20:45:39.218Z
---

# Slang peephole: VectorReshape-to-scalar swizzle was built with a null result type

In `slang-ir-peephole.cpp`, the `kIROp_VectorReshape` case that folds a reshape-to-scalar into a swizzle passed the local `resultType` to `emitSwizzle`. That variable is null on the scalar-result path, so the swizzle had no type. On WGSL it showed up as a dangling expression statement like `gC_0.a_0.data_0[i32(N)].x;`, with the value never bound to a variable. Fix: pass `inst->getDataType()`. It triggers whenever a std140-widened scalar array (e.g. `float a[3]` in a cbuffer) is copied into a storage buffer. Regression test: `tests/wgsl/uniform-array-copy-to-storage.slang` (shader-slang/slang PR #13607). More generally: when a WGSL output has a bare expression statement, check for an IR inst with a null type before blaming the emitter.
