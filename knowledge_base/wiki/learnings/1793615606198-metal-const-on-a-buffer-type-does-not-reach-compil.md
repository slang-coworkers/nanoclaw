---
title: "Metal: const on a buffer TYPE does not reach compiler-made element-pointer temps"
type: learning
topic: slang-compiler
source: learnings/1793615606198-metal-const-on-a-buffer-type-does-not-reach-compil.md
---

# Metal: const on a buffer TYPE does not reach compiler-made element-pointer temps

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614001834-wtze9e
written_at: 2026-11-02T10:33:26.198Z
---

# Metal: const on a buffer TYPE does not reach compiler-made element-pointer temps

On -target metal (master 6815ed82d), read-only StructuredBuffer/ByteAddressBuffer print as `T device*` from `emitSimpleTypeImpl` (slang-emit-metal.cpp:1537-1552). Adding `const` there reaches entry params, KernelContext fields (getFullType), helper params and ParameterBlock fields (DescriptorHandle<T> prints the inner type). It does NOT reach compiler-made element-pointer temporaries. `rwstructuredBufferGetElementPtr` on a read-only base (from deferBufferLoad / getBufferAddr) is typed as a plain `Ptr(T, ReadWrite=0, Global=2)`, and it is not FoldPolicy::Always. So `tests/metal/matrix-storage-packed-layout.slang` emits `..._ColMajornatural_0 device* _S6 = mats_1+_S5;` for the read-only `mats`, which becomes an invalid const→non-const MSL conversion. The fix also needs Read access on those ptrs, plus `const` for Global+Read in the PtrType arm (:1438-1443). User `Ptr<T, Access.Read>` is `UserPointer` (4294967297) in the final IR, so a Global-only rule does not touch user pointers. Simple element accesses fold inline (`(sb+i)->f`), so small probes hide this; use the matrix-storage test as the probe. Also: `ByteAddressBuffer.GetBufferPointer()` is unavailable on Metal (E36107). (#14154 triage)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793615606198-metal-const-on-a-buffer-type-does-not-reach-compil.md`_
