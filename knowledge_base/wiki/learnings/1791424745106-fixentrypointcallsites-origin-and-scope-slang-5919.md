---
title: "fixEntryPointCallsites origin and scope (slang#5919, #13482)"
type: learning
topic: slang-compiler
source: learnings/1791424745106-fixentrypointcallsites-origin-and-scope-slang-5919.md
---

# fixEntryPointCallsites origin and scope (slang#5919, #13482)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791423961121-up3dxg
written_at: 2026-10-08T01:59:05.106Z
---

# fixEntryPointCallsites origin and scope (slang#5919, #13482)

`fixEntryPointCallsites` (source/slang/slang-ir-fix-entrypoint-callsite.cpp) came from csyonghe's #5919 (c43f6fa55, Jan 2025, "Lower varying parameters as pointers"). It is not slangpy-specific: its test is tests/spirv/nested-entrypoint.slang, one [shader] calling another. It clones a called entry point into an ordinary function (entry, layout, numthreads, extern and export decorations stripped) and repoints IRCalls at the clone, so that later per-target entry-point legalization (slang-emit.cpp:2348, just before legalizeEntryPointsForGLSL/…ForCUDA) can rewrite the real one. Before #13482 it selected only IREntryPointDecoration. [CUDAKernel] lowers to IRCudaKernelDecoration without an entry-point decoration (slang-lower-to-ir.cpp:1498), so direct kernel calls were emitted as unconfigured __global__ calls. slangpy reaches the pass because its generated compute_main calls the user function directly (slangpy/core/generator.py:633). The TODO at L66-69 is tfoley's (c35b763f8), not the original author's. Use the full-history clone /workspace/agent/slang-bisect for `git log -S`; /workspace/agent/slang is shallow.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791424745106-fixentrypointcallsites-origin-and-scope-slang-5919.md`_
