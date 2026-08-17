---
title: "CORRECTION: Slang float3 CUDA slowdown is swizzle-base re-evaluation, NOT vec3 layout/register pressure"
type: learning
topic: slang-compiler
source: learnings/1783910402434-correction-slang-float3-cuda-slowdown-is-swizzle-b.md
---

# CORRECTION: Slang float3 CUDA slowdown is swizzle-base re-evaluation, NOT vec3 layout/register pressure

**This supersedes the earlier learning "Slang CUDA float3 loop arithmetic ~3x slower than float4 (vec3 layout + swizzle-constructor emission)".** That note's *emission* observation was right but its *causal attribution was wrong.* Corrected by slang-side GPU-free codegen inspection (emitted `.cu` at slang HEAD `8f0c3515d`), tracked at **shader-slang/slang#12073**.

**Wrong hypothesis (do not repeat):** that `float3`'s 12-byte/4-byte-aligned CUDA layout defeats NVRTC register allocation, and that it's CUDA-only. Both are false.

**Actual root cause — swizzle-base re-evaluation:** Slang's **C-family emitter** lowers a multi-component swizzle read (`.rgb`/`.xyz`) to a per-component brace-init `float3{ base.x, base.y, base.z }`, which **re-evaluates the base expression once per component**. When the base is a folded texture/buffer load, the load is emitted **3×**. Verified fetch counts in the #1059 repro: `f4_all`=1 `tex2Dfetch`, `f3_loop`=**3** (≈ the measured 2.87×), `f3_epi`=1.

**Scope:** affects the **CUDA target AND the CPU/C++ target** (shared C-family emitter) — NOT CUDA-alone. SPIR-V emits a single `OpVectorShuffle` and HLSL a native `.xyz`, both evaluating the base once → that's the real source of the backend asymmetry (not alignment).

**Trigger boundary (now characterized):** the slowdown fires when **the swizzle base is a non-trivial folded expression** (a texture fetch, a helper call, `saturate(...)`), which gets triplicated. It does NOT fire when the base is a cheap register-resident local — which is exactly why the minimal `f3_epi` (`.rgb` of a local) is fast while a production epilogue whose `.rgb` base was an expensive helper expr was slow. The number of components (float2/float3) matters only insofar as it multiplies the base evaluation; the vector *type/layout* is not the driver.

**Why the workaround works (unchanged guidance, better explanation):** `float4 s = tex[q]; ... s.r/s.g/s.b` binds the load to a register-resident local so the base isn't re-evaluated; lane assignment (`x.a=s.a; dst[tid]=x;`) avoids the constructor-swizzle triplication. All the reporter's workarounds amount to "don't put a folded expression under a multi-component swizzle."

**Meta-lesson for triage:** DeepWiki correctly described the *emission form* (`float3{a,b,c}` constructors vs `OpVectorShuffle`) but I mis-inferred the *consequence* (register spilling) from it. Confirming a perf hypothesis needs actual emitted-code evidence (fetch/instruction counts in the `.cu`), not architectural plausibility. `slangc -target cuda repro.slang -o repro.cu` then count the fetches per variant; `SLANGPY_PRINT_GENERATED_SHADERS` only dumps the wrapper, not the CUDA C++.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783910402434-correction-slang-float3-cuda-slowdown-is-swizzle-b.md`_
