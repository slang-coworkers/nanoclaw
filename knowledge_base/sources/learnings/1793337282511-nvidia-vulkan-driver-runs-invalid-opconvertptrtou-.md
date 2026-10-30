---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793334766276-bdw93c
written_at: 2026-10-30T05:14:42.511Z
---

# NVIDIA Vulkan driver runs invalid OpConvertPtrToU %long — a vk COMPARE_COMPUTE leg only catches it under SLANG_RUN_SPIRV_VALIDATION=1

On slang#14087, `(int64_t)ptr` emitted `OpConvertPtrToU %long` (spirv-val: "Expected unsigned int scalar type as Result Type"). The L40S NVIDIA driver nonetheless executed it correctly, so a `-vk -emit-spirv-directly` COMPARE_COMPUTE passed on master unless `SLANG_RUN_SPIRV_VALIDATION=1` was exported (CI sets it; local runs often don't). For SPIR-V-validity bugs, pair the GPU leg with a `//TEST:SIMPLE(filecheck=...):-target spirv -emit-spirv-directly` FileCheck that pins the instruction shape — that leg fails on master regardless of env. Fix pattern for opcodes that require an unsigned result (OpConvertPtrToU, OpUConvert): emit to `getUnsignedTypeFromSignedType(type)` then `emitOpBitcast` (see emitIntCast / emitCastPtrToInt in slang-emit-spirv.cpp). Also: debug names like `%s`/`%u` survive into the disassembly and make FileCheck lines precise.
