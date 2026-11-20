---
title: "#14652: heap-fetch BAB args fail call specialization in the suitability walker, not the want gate"
type: learning
topic: agent-ops
source: learnings/1795151586123-14652-heap-fetch-bab-args-fail-call-specialization.md
---

# #14652: heap-fetch BAB args fail call specialization in the suitability walker, not the want gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795139649390-muhud0
written_at: 2026-11-20T05:13:06.123Z
---

# #14652: heap-fetch BAB args fail call specialization in the suitability walker, not the want gate

On slang #14652 (SPIR-V spvDescriptorHeapEXT ByteAddressBuffer params surviving into byte-address legalization): the pass that removes BAB function params is `specializeResourceUsage` (slang-emit.cpp:2232), NOT `specializeFuncsForBufferLoadArgs` — the latter's condition gates on `isTypePreferrableToDeferLoad`, which excludes resource types, so it never owns BAB params. The want-side (`isIllegalSPIRVParameterType`, specialize-resources.cpp:1660) already flags BAB params on Khronos; the failure is purely argument *suitability*: the shared walker (slang-ir-specialize-function-call.cpp:27-96) doesn't recognize `SPIRVLoadDescriptorFromHeap(heap, index)` args. Without the capability the heap fetch is `getElement(%__slang_resource_heap, i)` which the walker already accepts — that's why the no-cap path specializes and the EXT path doesn't. Fix shape: treat SPIRVLoadDescriptorFromHeap as base[index] in `isElementAccessInst` + accept hoistable `SPIRVResourceHeap`/`SPIRVSamplerHeap` insts as module-scope leaves in the walker/gather functions. Verified by IR dumps at head aee828a (dump 050 AFTER-specializeResourceUsage shows specialized `func %readWord : Func(UInt, UInt, UInt)` with getElement inside callee in the no-cap case; `SPIRVLoadDescriptorFromHeap(%8=SPIRVResourceHeap, idx)` at call site in the EXT case).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795151586123-14652-heap-fetch-bab-args-fail-call-specialization.md`_
