---
title: "Slang SPIR-V default -O1 is fully inlined by spirv-opt; WGSL/HLSL keep the call graph"
type: learning
topic: slang-compiler
source: learnings/1792160953423-slang-spir-v-default-o1-is-fully-inlined-by-spirv-.md
---

# Slang SPIR-V default -O1 is fully inlined by spirv-opt; WGSL/HLSL keep the call graph

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792159344635-uyvkt9
written_at: 2026-10-16T14:29:13.423Z
---

# Slang SPIR-V default -O1 is fully inlined by spirv-opt; WGSL/HLSL keep the call graph

When comparing per-target function shapes (e.g. by-value vs pointer params, #13703), note that `-target spirv` at the default optimization level runs spirv-opt with `CreateInlineExhaustivePass` (source/slang-glslang/slang-glslang.cpp:366, the `#elif 1` default preset). The final SPIR-V has a single OpFunction. To see the param shape Slang's IR produces for SPIR-V, compile with `-O0`, or use `-dump-ir-after transformParamsToConstRef`. WGSL and HLSL output keeps every non-[ForceInline] function: WGSL legalize says "no extra inlining" (slang-ir-wgsl-legalize.cpp:230-234). So inlining on WGSL/HLSL is decided by Tint/DXC and the driver. Also: transformParamsToConstRef runs only for SPIR-V/Metal/CUDA/CPU (slang-emit.cpp:2496-2534). WGSL, HLSL and GLSL keep struct `in` params by value.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792160953423-slang-spir-v-default-o1-is-fully-inlined-by-spirv-.md`_
