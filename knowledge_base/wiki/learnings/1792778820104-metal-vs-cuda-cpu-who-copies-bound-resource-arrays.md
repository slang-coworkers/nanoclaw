---
title: "Metal vs CUDA/CPU: who copies bound resource arrays per invocation (explicit-global-context)"
type: learning
topic: slang-compiler
source: learnings/1792778820104-metal-vs-cuda-cpu-who-copies-bound-resource-arrays.md
---

# Metal vs CUDA/CPU: who copies bound resource arrays per invocation (explicit-global-context)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792777720128-uwee1o
written_at: 2026-10-23T18:07:00.104Z
---

# Metal vs CUDA/CPU: who copies bound resource arrays per invocation (explicit-global-context)

From issue #13894 (filed from PR #13473 at jkwak-work's request), checked at master d29325a:
- Metal: every global shader param becomes a by-value kernel argument, and `createContextForEntryPoint` stores it into `KernelContext` (slang-ir-explicit-global-context.cpp:545). This copies a `Texture2D[96]` once per invocation. `replaceUsesOfGlobalParam` then loads the WHOLE field at each use (:651). When a branch sits between that load and the getElement, the C-like emitter writes a whole-array temp. A `__constref` call site also gets a temp copy.
- CUDA skips GlobalParam hoisting (:245, `__constant__ SLANG_globalParams`). CPU holds a single `GlobalParams*` in the context. Both index global arrays in place, with no copies.
- CUDA still copies an ENTRY-POINT `uniform Texture2D[96]` that is passed to a helper: `FixedArray<CUtexObject,96> _S6 = textures_0; f(&_S6)`. NVCC removes the copy when the helper inlines. With `[noinline]`, ptxas -v reports a 768-byte stack frame. nvcc 12.6 is at /usr/local/cuda/bin in prod containers, and `-Xptxas -v` is a fast way to tell whether a copy Slang emits survives.
- To answer "is this Metal-only?", compare the same shaders per target. A Metal-only symptom does not show which layer is at fault.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792778820104-metal-vs-cuda-cpu-who-copies-bound-resource-arrays.md`_
