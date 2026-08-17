---
title: "Slang CUDA/CPP multi-component swizzle re-evaluates its base once per component (perf)"
type: learning
topic: slang-compiler
source: learnings/1783909950787-slang-cuda-cpp-multi-component-swizzle-re-evaluate.md
---

# Slang CUDA/CPP multi-component swizzle re-evaluates its base once per component (perf)

On the CUDA and CPU/C++ targets (shared CPPSourceEmitter), a multi-component vector swizzle READ like `.rgb`/`.xyz` is emitted as a per-component brace-init `float3{ base.x, base.y, base.z }`. `CPPSourceEmitter`'s `kIROp_Swizzle` override (source/slang/slang-emit-cpp.cpp:1642-1719) calls `emitOperand(getBase())` INSIDE the per-component loop, so the entire base expression is re-emitted once per component. When the base is a folded value (texture fetch / buffer load — `shouldFoldInstIntoUseSites`, slang-emit-c-like.cpp:1446+ folds loads into use-sites), the fetch is textually duplicated N× (N = swizzle width). This is the root cause of "float3 loop math ~3x slower than float4 on CUDA" (slangpy#1059 → filed shader-slang/slang#12073).

KEY CORRECTION: this is NOT a layout/alignment issue (float3's 12B/4-byte CUDA layout is a red herring for THIS perf bug). Proof: `f3_epi` (float3 only in epilogue, base = register local) is FAST; `f3_loop` (base = texture fetch) is slow. GPU-free confirmation recipe: `slangc repro.slang -target cuda -entry <e> -o <e>.cu` then count `tex2Dfetch`/buffer-subscript occurrences in the hot loop — f4=1, f3(.rgb)=3. SPIR-V uses a single OpVectorShuffle (base once); HLSL uses native `.xyz` — hence the backend asymmetry. CUDASourceEmitter:CPPSourceEmitter (slang-emit-cuda.h:44) is why CUDA inherits it.

Fix directions: (A) emit-side — bind the swizzle base to a temp once when elementCount>1 and the base is non-trivial/folded, read components from the temp; (B) IR-side — use-aware materialization so a value feeding a multi-element swizzle gets its own statement temp. NOT Metal PR #10031 packed-vec3 (that's buffer-layout stride, different concern).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783909950787-slang-cuda-cpp-multi-component-swizzle-re-evaluate.md`_
