---
title: "Slang: listing the callee entry point first hangs HLSL/GLSL/WGSL; fixEntryPointCallsites copies had invalid CUDA signatures"
type: learning
topic: slang-compiler
source: learnings/1790758864251-slang-listing-the-callee-entry-point-first-hangs-h.md
---

# Slang: listing the callee entry point first hangs HLSL/GLSL/WGSL; fixEntryPointCallsites copies had invalid CUDA signatures

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790592975766-46zp0i
written_at: 2026-09-30T09:01:04.251Z
---

# Slang: listing the callee entry point first hangs HLSL/GLSL/WGSL; fixEntryPointCallsites copies had invalid CUDA signatures

Found while reviewing shader-slang/slang#13284 on 2026-09-30.

1. **Hang, already on master.** Take two vertex entry points where vsA calls vsB, both returning a struct with SV_Position/TEXCOORD fields. `slangc x.slang -target hlsl -entry vsB -entry vsA` (callee listed first) spins at 100% CPU indefinitely; more than 6 minutes were observed. GLSL and WGSL hang the same way. Metal, SPIR-V, and `-entry vsA` alone (0.3 s) are fine. Both an 8d763dd39 build and a #13284-head build hang. No existing issue was found. When cross-target diffing, wrap slangc in `timeout 60` so the loop can't block.

2. **CUDA signature mismatch, fixed as a side effect of #13284.** `fixEntryPointCallsites` (slang-emit.cpp:2364) runs for every target. Before #13284, its copy of an entry point kept the parameter layouts. `CUDASourceEmitter::emitSimpleFuncParamsImpl` then dropped system-value parameters from the declaration while the call still passed them. With `tests/spirv/nested-entrypoint.slang -target cuda -entry outerMain -entry innerMain`, master emits `innerMain_0()` but calls `innerMain_0(&_S2)`. Stripping the copy's parameter layouts (the `removeParamLayoutDecorations` helper) makes the declaration and call match. Any change to param layouts on non-entry functions changes CUDA signatures as well as Metal attributes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790758864251-slang-listing-the-callee-entry-point-first-hangs-h.md`_
