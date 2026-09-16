---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789512432832-0wpb40
written_at: 2026-09-15T23:01:21.020Z
---

# CUDA static-const struct arrays localize via isSimpleConstantType struct gap (distinct from #12635 nested-literal bug)

There are TWO distinct CUDA `static const` global-array codegen bugs — don't conflate them.

**Bug A (#12635, FIXED by merged PR #12688):** a *nested-literal* array like `static const int v[2][2]={{1,2},{3,4}}` was emitted at global scope but with DYNAMIC `__device__` init — each inner row hoisted to its own `__device__` global, outer array referencing them by name; NVRTC rejects reading another `__device__` global's storage. Root: `shouldFoldInstIntoUseSites` returned false for MakeArray/MakeStruct (an explicit HACK). Symptom = global-with-dynamic-init.

**Bug B (#13107, OPEN, this triage):** a `static const` array of a **struct** type (e.g. `Record{uint a,b;} recs[2]`) is emitted as a PER-INVOCATION LOCAL `FixedArray` reconstructed INSIDE the kernel via synthesized `$init` ctor CALLS (`Record_x24init_0(1U,2U)`), never reaching global scope at all. A scalar `static const uint[]` control stays `__device__ static const`. Symptom = local reconstruction; divergence is by ELEMENT TYPE, not nesting.

**Bug B root cause (two joint gaps, both load-bearing):**
1. `inlineGlobalConstantsForLegalization` runs UNCONDITIONALLY for CUDA/CPU-kernel (slang-emit.cpp:1934-1938, "always inline global constants to avoid dynamic init of `__device__` vars rejected by NVRTC"). Its legality gate `GlobalInstLegalizationInliningContext::isSimpleConstantType` (source/slang/slang-ir-legalize-global-values.cpp:251-270) accepts ONLY scalar/vector/matrix + arrays-of-those; a struct or array-of-struct hits `return false` at :268 → the table is misclassified illegal-global → force-inlined into every using function.
2. struct elements lower to synthesized `$init` ctor CALLS (checker createInvokeExprForSynthesizedCtor, slang-check-conversion.cpp:853/942 → IRCall), not `MakeStruct`. The global brace-init folder `isInnerGlobalAggregate` (slang-emit-c-like.cpp:1461-1493) folds only MakeArray/MakeStruct/MakeArrayFromElement, never a Call → the elements can't be a compile-time-constant global regardless.

Complete fix needs BOTH: extend isSimpleConstantType to POD structs/arrays-of-struct (recurse fields, reject resource/pointer), AND fold constant synthesized-ctor calls → MakeStruct at module scope. Pass is CUDA/CPU-only ⇒ blast radius is the C-family emitter (CUDA/CPP/Torch share CPPSourceEmitter); SPIR-V/HLSL unaffected.

GPU-free repro/verify: `slangc t.slang -target cuda -o k.cu` (no GPU); grep the `.cu` for `FixedArray`/`x24init` inside the kernel body vs `__device__ static const` at file scope.
