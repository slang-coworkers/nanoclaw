---
title: "float3/vec3 CUDA slowdown is swizzle-base re-evaluation, not float3 layout"
type: learning
topic: misc
source: learnings/1783910857099-float3-vec3-cuda-slowdown-is-swizzle-base-re-evalu.md
---

# float3/vec3 CUDA slowdown is swizzle-base re-evaluation, not float3 layout

**Symptom:** A hot loop reading a multi-component swizzle (`.rgb`/`.xyz`) can run ~3x slower on the CUDA backend than reading a whole `float4` or accumulating in scalars (reported: slangpy#1059, f3_loop 2.87x on an L40S/NVRTC 13).

**The plausible-but-WRONG "why"** (initially accepted by triage AND my first doc draft): float3 maps to a native 12-byte/4-byte-aligned CUDA float3, and that layout defeats NVRTC register allocation while float4 (16-byte) stays in registers. This is a real layout fact but it is NOT the cause of the slowdown.

**The VERIFIED cause** (proven by the slang side via GPU-free emitted-`.cu` inspection at slang HEAD `8f0c3515d`, now tracked as shader-slang/slang#12073): Slang's **C-family emitter** (`CLikeSourceEmitter`, shared by the **CUDA and CPU/C++ targets**) lowers a multi-component swizzle read to a per-component brace initializer `float3{ base.x, base.y, base.z }`, which **re-evaluates the base expression once per component**. When the base is a folded texture/buffer load or helper call, it is emitted 3×. Verified fetch counts: f4_all=1, f3_loop=**3** (≈ the 2.87×), f3_epi=1.

**Consequences that distinguish the two explanations:**
- Scope is **CUDA + CPU/C++** (shared C-family emitter), NOT CUDA-only. SPIR-V (single `OpVectorShuffle`) and HLSL (native `.xyz`) read the base once → that's the backend asymmetry.
- Trigger is **"the swizzle base is a non-trivial folded expression"** (helper / `saturate(...)` / texture fetch), NOT the float3 type or its layout. That's why a minimal `f3_epi` (base = cheap register-resident local) is fast while a production epilogue with an expensive helper base was slow.

**Fix/workaround (unchanged, now better explained):** bind the fetch to a named local FIRST (`float4 s = tex[q];` then use `s.r/.g/.b`), and write via lane assignment (`v.a = a; dst=v;`) not constructor-swizzle (`float4(shade(uv).rgb, a)`). Each removes a folded expression from directly under a multi-component swizzle so the base is evaluated once.

**Confirmation recipe:** `slangc -target cuda` (or `-target cpp` — same emitter) and count how many times an expensive base appears per `.rgb`/`.xyz`. NOTE: `SLANGPY_PRINT_GENERATED_SHADERS=1` dumps the Slang wrapper, NOT the emitted CUDA C++ — wrong tool for this.

**Meta-lesson:** a layout/alignment fact being TRUE does not make it the CAUSE. When a codegen perf asymmetry has a tidy structural explanation, still confirm it by counting operations in the actual emitted target code before writing it down as the mechanism. Relates to [[slang-cuda-constant-vs-param-codegen-check-slangpy]] (emitted-`.cu` inspection recipe) and [[slang-per-target-stride-for-structuredbuffer-float]] (the 12B float3 layout fact that is real but was a red herring here).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783910857099-float3-vec3-cuda-slowdown-is-swizzle-base-re-evalu.md`_
