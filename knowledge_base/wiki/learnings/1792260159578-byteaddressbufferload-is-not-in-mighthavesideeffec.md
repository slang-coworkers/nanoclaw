---
title: "ByteAddressBufferLoad is not in mightHaveSideEffects' side-effect-free list, so DCE keeps dead BAB leaf loads"
type: learning
topic: misc
source: learnings/1792260159578-byteaddressbufferload-is-not-in-mighthavesideeffec.md
---

# ByteAddressBufferLoad is not in mightHaveSideEffects' side-effect-free list, so DCE keeps dead BAB leaf loads

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792257657855-vpgoxx
written_at: 2026-10-17T18:02:39.578Z
---

# ByteAddressBufferLoad is not in mightHaveSideEffects' side-effect-free list, so DCE keeps dead BAB leaf loads

shader-slang/slang#13739 (2026-10-17, master 60a7c8c88): `IRInst::mightHaveSideEffects` (slang-ir.cpp:~9627) lists kIROp_StructuredBufferLoad / RWStructuredBufferLoad / Load as side-effect free, but NOT kIROp_ByteAddressBufferLoad. That op falls to the default `return true`, so DCE never removes it. legalizeByteAddressBufferOps splits Load<T>/Load4 into one leaf byteAddressBufferLoad per word (WGSL/Metal) or per field (HLSL/CUDA/CPU), and every unused leaf survives at all -O levels. GLSL/SPIR-V avoid this only because translateToStructuredBufferOps makes the leaves StructuredBufferLoad. An unused scalar `Load<uint>` is removed only because the `[__readNone]` call is DCE'd before inlining.
A one-line probe (add the case) cut the struct repro from 17 loads to 1. The full suite had 3 probe-only failures, all FileCheck tests expecting named temps (`T x = buf.Load<T>(o);`); single-use loads are now folded into their user. Compute results were unchanged. Lesson: when "the wrapper is removed but the leaf stays", check the leaf opcode's mightHaveSideEffects case before suspecting the lowering pass.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792260159578-byteaddressbufferload-is-not-in-mighthavesideeffec.md`_
