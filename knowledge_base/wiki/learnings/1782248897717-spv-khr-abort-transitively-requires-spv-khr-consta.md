---
title: "SPV_KHR_abort transitively requires SPV_KHR_constant_data; message is OpConstantDataKHR not a runtime composite"
type: learning
topic: misc
source: learnings/1782248897717-spv-khr-abort-transitively-requires-spv-khr-consta.md
---

# SPV_KHR_abort transitively requires SPV_KHR_constant_data; message is OpConstantDataKHR not a runtime composite

Follow-up to the VK_KHR_shader_abort / shader-slang#11528 triage. The canonical SPV_KHR_abort spec (https://github.com/KhronosGroup/SPIRV-Registry/blob/main/extensions/KHR/SPV_KHR_abort.asciidoc) has a dependency that's easy to miss and that reshapes the emit:

- **"This extension requires SPV_KHR_constant_data."** So `OpAbortKHR` is NOT self-contained — a correct implementation must also declare the `SPV_KHR_constant_data` extension + `ConstantDataKHR` capability (5146; `OpConstantDataKHR`=5147, hasResult=true; all present in vendored spirv-headers at master HEAD a005a9d15).
- **Emit shape:** the `OpAbortKHR` `Message` operand is **constant data → `OpConstantDataKHR`**, NOT a runtime `OpCompositeConstruct`. This is why the spec says "Message Type must be a concrete type" with "explicit layout" — it's a compile-time constant-data blob. A printf-style runtime composite-construct of the message is the wrong emit.
- **capdef:** Slang's `slang-capabilities.capdef` has NO `constant_data` atom — adding `abort` support means adding `def SPV_KHR_constant_data : _spirv_1_0;` AND making the `abort`/`SPV_KHR_abort` atom require it (conjunction).
- Confirmed-normative from the canonical asciidoc: OpAbortKHR is a block terminator ("must be the last instruction in a block"); the per-format-specifier UTFEncodedKHR/ArrayStride message chunking shown in the spec is ILLUSTRATIVE, not normative (Message Type just needs concrete type + explicit layout); extension requires SPIR-V 1.0.

General lesson: for a brand-new SPIR-V extension intrinsic, read the canonical .asciidoc's "requires" line — Khronos extensions frequently chain-depend on a sibling extension (here constant_data), and the dependency dictates the emit primitive (OpConstantDataKHR) rather than the obvious runtime-composite approach a printf-parallel plan would assume.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782248897717-spv-khr-abort-transitively-requires-spv-khr-consta.md`_
