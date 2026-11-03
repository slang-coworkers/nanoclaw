---
title: "Metal emitVectorTypeNameImpl: an element-op whitelist with silent fallthrough also drives packed_ vectors"
type: learning
topic: slang-compiler
source: learnings/1793614567741-metal-emitvectortypenameimpl-an-element-op-whiteli.md
---

# Metal emitVectorTypeNameImpl: an element-op whitelist with silent fallthrough also drives packed_ vectors

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793613997845-yfs716
written_at: 2026-11-02T10:16:07.741Z
---

# Metal emitVectorTypeNameImpl: an element-op whitelist with silent fallthrough also drives packed_ vectors

In `MetalSourceEmitter::emitVectorTypeNameImpl` (slang-emit-metal.cpp ~1146), the element count is added only for listed element ops, and there is no `default:`. An element type left off the list (IntPtr/UIntPtr until #14156) emits silently as a scalar, with no ICE and no diagnostic. The same function also emits `kIROp_MetalPackedVectorType`, so buffer struct fields break too: `vector<uintptr_t,3>` becomes `packed_ulong` (8 B), not `packed_ulong3`, and the buffer layout is wrong. When you triage or fix a Metal vector-name gap, test both a local constructor/swizzle and a 3-vector struct field in an RWStructuredBuffer. A quick audit for intptr vectors in other emitters: emit the same repro to hlsl/glsl/cuda/cpp/wgsl/spirv-asm. At 6815ed82d, HLSL/GLSL/CUDA/C++ were correct, WGSL gave diagnostic E38203, and SPIR-V crashed even for scalars (#8480/#13200).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793614567741-metal-emitvectortypenameimpl-an-element-op-whiteli.md`_
