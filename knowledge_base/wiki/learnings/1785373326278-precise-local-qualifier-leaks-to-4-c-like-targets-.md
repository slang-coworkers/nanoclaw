---
title: "precise local qualifier leaks to 4 C-like targets, not just CUDA/C++ (#12279)"
type: learning
topic: ci-tooling
source: learnings/1785373326278-precise-local-qualifier-leaks-to-4-c-like-targets-.md
---

# precise local qualifier leaks to 4 C-like targets, not just CUDA/C++ (#12279)

**Finding (verified @HEAD 6462d7d2f, compile-only repro w/ Debug slangc):** The `precise` qualifier on a *local variable* is lowered to `IRPreciseDecoration` and emitted verbatim as the token `precise ` by the SHARED base `CLikeSourceEmitter::emitTempModifiers` (source/slang/slang-emit-c-like.cpp:4683-4689). Because the inheritance chain is `CUDASourceEmitter → CPPSourceEmitter → CLikeSourceEmitter`, the HLSL-only spelling leaks to **every** C-like target, not just the two named in issue #12279's title.

**Empirical per-target result** (`precise float r = gOut[0]*2.0f;`):
- HLSL: `precise float r_0` — VALID (native)
- GLSL: `precise float r_0` — VALID (GLSL 4.20+ `precise` qualifier)
- CUDA: `precise float r_0` — INVALID → `-target ptx` fails NVRTC parse `identifier "precise" is undefined`, no PTX
- C++/CPU: `precise float r_0` — INVALID
- Metal: `precise float r_0` — INVALID MSL
- WGSL: `precise var r_0 : f32` — INVALID WGSL

**Load-bearing consequence for the fix:** the correct guard predicate is **source-language support** (keep for HLSL+GLSL, drop for CUDA/C++/Metal/WGSL). A naive "emit only for HLSL" guard is WRONG (drops valid GLSL); a "CUDA/C++-only" guard is INCOMPLETE (leaves Metal+WGSL broken). The emit site has `getSourceLanguage()`/`getTarget()`/`isCUDATarget()` and a diagnostic sink (`getSink()->diagnose()`, precedent at :307/:2354/:2819) — so a token-drop + optional target-specific warning both fit there. Producer (`addVarDecorations`, slang-lower-to-ir.cpp) is correctly target-agnostic; gating belongs at emit.

**Lesson:** when a bug is reported against a shared base emitter method, always sweep ALL C-like targets before scoping the fix — the reporter's title named 2, the real blast radius was 4. Distinct from #12198 (SPIR-V drops `precise`→no NoContraction) and #11933 (fp-mode precise NoContraction, FIXED).

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785373326278-precise-local-qualifier-leaks-to-4-c-like-targets-.md`_
