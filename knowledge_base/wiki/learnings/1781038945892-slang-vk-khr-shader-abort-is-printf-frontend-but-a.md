---
title: "slang VK_KHR_shader_abort is printf-frontend but a core OpAbortKHR, not an OpExtInst"
type: learning
topic: slang-compiler
source: learnings/1781038945892-slang-vk-khr-shader-abort-is-printf-frontend-but-a.md
---

# slang VK_KHR_shader_abort is printf-frontend but a core OpAbortKHR, not an OpExtInst

Triaging shader-slang/slang#11528 (Support VK_KHR_shader_abort). The reporter said "implement like printf" — true for the frontend, but the SPIR-V emit diverges in a way that's easy to get wrong:

- **SPIR-V extension token is `SPV_KHR_abort`** (per `external/spirv-headers/.../spirv.core.grammar.json`), NOT `SPV_KHR_shader_abort`. The *Vulkan* extension is `VK_KHR_shader_abort`; the *SPIR-V* one is `SPV_KHR_abort`. Don't conflate.
- `OpAbortKHR` = opcode **5121**, class **Control-Flow**, `hasResult=false`/`hasResultType=false`. Operands are `{Message Type (IdRef→OpTypeStruct), Message' (IdRef→packed struct value)}`. Capability `AbortKHR` = **5120**.
- **Both `SpvOpAbortKHR=5121` and `SpvCapabilityAbortKHR=5120` are ALREADY in the vendored spirv-headers** (`spirv.h` + grammar JSON) as of master HEAD a005a9d15 — no submodule bump needed for the enums.
- Divergence from printf: printf is a *value-producing* `OpExtInst` into `NonSemantic.DebugPrintf` (instr #1) and flattens varargs into the ExtInst operand list (`slang-emit-spirv.cpp:5524`). `OpAbortKHR` is a terminator-shaped core op that takes a struct **type id + value id**, so emit must build a real `OpTypeStruct` + `OpCompositeConstruct` (proposal: 8-byte size/payload pairs, 8-byte aligned). That message-struct construction is the genuinely novel work, not copy-pasteable from printf.
- abort's message is retrieved host-side via `VK_KHR_device_fault` — a DIFFERENT channel from printf's DebugPrintf, so "lower abort to printf+terminate" is semantically wrong.

printf precedent map (the model to copy), HEAD a005a9d15: decl `source/slang/hlsl.meta.slang:14014`; capability atoms `slang-capabilities.capdef:966/1043/2404`; IR opcode `slang-ir-insts.lua:1432` + `slang-ir-insts-stable-names.lua:297`; legalize `slang-ir-legalize-types.cpp:823` (`legalizePrintf`); SPIR-V emit `slang-emit-spirv.cpp:5524` (+ `getNonSemanticDebugPrintfExtInst` :1541); GLSL `slang-emit-glsl.cpp:2751`; C-like `slang-emit-c-like.cpp:3077`; VM `slang-emit-vm.cpp:1049`.

Caveat: runtime behaviour needs a GPU + VK_KHR_device_fault, so CI can only do emit-shape filecheck tests (`tests/spirv/...` with `-emit-spirv-directly`).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781038945892-slang-vk-khr-shader-abort-is-printf-frontend-but-a.md`_
