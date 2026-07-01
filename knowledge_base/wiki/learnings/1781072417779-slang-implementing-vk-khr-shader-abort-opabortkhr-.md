---
title: "Slang: implementing VK_KHR_shader_abort (OpAbortKHR) — printf-parallel but it's a terminator"
type: learning
topic: slang-compiler
source: learnings/1781072417779-slang-implementing-vk-khr-shader-abort-opabortkhr-.md
---

# Slang: implementing VK_KHR_shader_abort (OpAbortKHR) — printf-parallel but it's a terminator

For adding the `VK_KHR_shader_abort` builtin to Slang (issue #11528), the model to copy is `printf` (builtin decl in `hlsl.meta.slang` → dedicated IR opcode → per-target emit), with three load-bearing differences:

1. **Names:** the *SPIR-V* extension is `SPV_KHR_abort` (NOT `VK_KHR_shader_abort` — that's the Vulkan-side name). Opcode `OpAbortKHR` = 5121 (class Control-Flow, hasResult=false, hasResultType=false), capability `AbortKHR` = 5120. **Both enums are ALREADY vendored** in `external/spirv-headers/include/spirv/unified1/spirv.h` (`SpvOpAbortKHR`, `SpvCapabilityAbortKHR`) — no submodule bump needed.

2. **It's a block terminator, not a value-producing ExtInst.** printf emits `OpExtInst` into `NonSemantic.DebugPrintf` and flattens varargs into the operand list. `OpAbortKHR` is a Control-Flow terminator (must be the last inst in its block, like OpKill/OpUnreachable) taking *Message Type (an `OpTypeStruct` id) + Message (the struct value id)*. So the SPIR-V emit must (a) build a real message `OpTypeStruct` + composite value from the format string + varargs, and (b) terminate the block + run unreachable-cleanup (model `discard`/OpKill at `slang-emit-spirv.cpp` + the unreachable-cleanup pass in `slang-ir-spirv-legalize.cpp`). The message-struct construction is the genuinely new work; everything else is printf-shaped. The SPV_KHR_abort core spec does NOT mandate per-format-specifier `UTFEncodedKHR` chunking — any concrete struct type with explicit member Offsets is valid at the SPIR-V level.

3. **Name collision (maintainer decision):** `void abort();` ALREADY EXISTS at `source/slang/hlsl.meta.slang:7393` (HLSL SM 4.0 "terminate current draw/dispatch") plus a Metal `abort()`. A message-taking VK `abort(...)` would be an overload with totally different semantics (device-fault + device-loss) — so naming (overload vs `shaderAbort`/`abortKHR`) is a real design fork, not free.

**CI:** runtime behaviour needs a GPU + `VK_KHR_device_fault`; cannot be validated locally/CI. Only emit-shape filecheck tests are possible (`-emit-spirv-directly`, checking `OpCapability AbortKHR` / `OpExtension "SPV_KHR_abort"` / `OpAbortKHR`). No GLSL `abort()` spelling/extension exists yet → SPIR-V-direct only initially.

printf reference points (HEAD ~29e69b0bf): decl `hlsl.meta.slang:14094` (`__intrinsic_op($(kIROp_Printf))`); IR op `slang-ir-insts.lua:1432`; legalize `slang-ir-legalize-types.cpp` `legalizePrintf`; SPIR-V emit `slang-emit-spirv.cpp` `case kIROp_Printf`; capdef atoms in `slang-capabilities.capdef`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781072417779-slang-implementing-vk-khr-shader-abort-opabortkhr-.md`_
