---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787174255485-l33xs6
written_at: 2026-08-19T21:28:06.706Z
---

# CUDA nested static-const arrays emit as dynamic __device__ init (shared C-like fold gap)

**Symptom:** `slangc -target ptx` on a literal-only nested `static const int values[2][2]={{1,2},{3,4}}` fails NVRTC with `dynamic initialization is not supported for a __device__ variable`. (shader-slang/slang#12635, triaged 2026-08-19.)

**Root cause is emit-time, NOT an IR pass.** The IR stores the aggregate inline (`IRGlobalConstant → MakeArray(outer) → {MakeArray(row0),MakeArray(row1)} → IntLits`, verified via `-dump-ir`). But `CLikeSourceEmitter::shouldFoldInstIntoUseSites` (`source/slang/slang-emit-c-like.cpp:1535`) returns **false** for `MakeArray`/`MakeStruct`/`MakeArrayFromElement` (an explicit `// HACK`), so each inner `MakeArray` — a module-scope child of the outer literal aggregate — is emitted as its own `__device__ static const _Sn = {...}` global and the outer array references `{ _S1, _S2 }`. NVRTC treats reading another `__device__` global's storage as a runtime (dynamic) initializer → reject.

**Why CUDA-only symptom:** HLSL/GLSL/Metal/CPU emit the SAME hoisted `_S1/_S2` shape but accept a constant global referencing another constant global; only CUDA's `__device__` rule forbids it. Flat 1D arrays are fine (no nested aggregate → nothing to hoist). So the emit defect is shared but the compile failure is CUDA/PTX-specific.

**Fix precedent (reusable):** WGSL PR #11628 (commit 43e44e843) fixed the *identical* nested-aggregate shape for issue #6747 via a `WGSLSourceEmitter::shouldFoldInstIntoUseSites` override (`slang-emit-wgsl.cpp:1430`) that folds a module-scope aggregate inline when ALL its uses are constituents of another aggregate (`onlyConstituent` predicate), leaving only the outermost runtime-indexed array as a declaration. The right fix for the C-family is the same predicate applied in the shared C-like path (gated on global-scope + only-constituent, since the function-body expression-context reason the HACK exists still holds), OR a narrower CUDA-local `MakeArray` case in `_emitInitializerListValue` (`slang-emit-cuda.cpp:525`).

**#8313 is NOT a duplicate** of this class: its initializer referenced a runtime buffer pointer (genuinely dynamic); the nested-literal case is statically foldable.

**Repro/verify GPU-free-ish:** emit `.cu` and grep for `_S[0-9]`/`FixedArray` to see the hoist without a GPU; the prod slang-fixer container has an L40S + NVRTC 12.6 for a real end-to-end PTX check.
