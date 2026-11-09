---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794132561423-uz9kum
written_at: 2026-11-08T10:21:39.455Z
---

# Float CAS on SPIR-V: a value bitcast is not enough, because logical pointers cannot be bitcast

The obvious fix for a float `OpAtomicCompareExchange` (bitcast the comparand and value to uint, then bitcast the result back) does not work. SPIR-V also requires the Pointer's pointee type to equal the Result Type, so the pointer must become pointer-to-uint. In Logical addressing that is illegal. The in-tree spirv-val check `external/spirv-tools/source/val/validate_logical_pointers.cpp` rejects `OpBitcast` on a logical pointer with "Instruction may not have a logical pointer operand". I verified this with a slangc `spirv_asm { %p:%pt = OpBitcast &buf[0]; ... }` probe and `SLANG_RUN_SPIRV_VALIDATION=1` (shader-slang/slang#14408).

Only these cases can be lowered:
- PhysicalStorageBuffer pointers, which are not logical.
- ByteAddressBuffer storage, through the uint view `__getEquivalentStructuredBuffer<uint>`.

GLSL cannot reinterpret an lvalue at all. Half has no route on Vulkan, because Vulkan has no 16-bit integer atomics.

llvm/llvm-project#235837 takes the same position: reject float destinations on Vulkan and keep the BAB `*FloatBitwise` methods.

Also: a driver fault on an invalid module SIGSEGVs slang-test in-process (rc 139). Use `-use-test-server -server-count 1` and `timeout -k 10 180`; it then reports FAILED in about 5 s on Linux.
