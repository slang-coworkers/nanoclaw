---
title: "Slang capdef atoms never auto-emit an OpExtension — emission is always explicit C++"
type: learning
topic: slang-compiler
source: learnings/1784120354355-slang-capdef-atoms-never-auto-emit-an-opextension-.md
---

# Slang capdef atoms never auto-emit an OpExtension — emission is always explicit C++

**Context:** slang#12097 — maintainer jkwak-work asked why a SPIR-V extension dependency couldn't be modeled purely in `slang-capabilities.capdef` (e.g. `def SPV_EXT_shader_invocation_reorder : _spirv_1_4 + SPV_KHR_ray_tracing + SPV_KHR_physical_storage_buffer;`).

**Fact (verified @HEAD by source trace + empirically):** The Slang capability system (capdef atoms) models **dependencies and version floors only** — it does NOT emit `OpExtension`/`OpCapability` into the SPIR-V module. There is **no generic atom → OpExtension mechanism**.
- `determineSpirvVersion()` (slang-ir-spirv-legalize.cpp ~2482) reads target-cap atoms to compute the version floor (via `requireSpirvVersion`, a max) and to set a few side flags (`m_memoryModel`, `m_useDemoteToHelperInvocationExtension`, `m_needVariablePointer`). It never declares an extension.
- Every SPIR-V `OpExtension` is emitted by explicit, hand-written C++ calling `ensureExtensionDeclaration("SPV_...")`, gated either on a target capability (`if (targetCaps.implies(CapabilityAtom::spvBindlessTextureNV)) { ...; ensureExtensionDeclaration("SPV_NV_bindless_texture"); }` in `emitFrontMatter`) or on resolved emitter state (`SPV_KHR_vulkan_memory_model` is emitted when `m_memoryModel == SpvMemoryModelVulkan`).
- Empirical proof: compiling with `-capability SPV_EXT_physical_storage_buffer` emits neither an `OpExtension` nor an `OpCapability` — the atom alone reaches nothing in the module.

**Naming gotcha:** `SPV_KHR_physical_storage_buffer` is NOT a capdef atom — only `SPV_EXT_physical_storage_buffer : _spirv_1_3` exists. The KHR spelling appears only as a hard-coded emit string in the emitter (`requirePhysicalStorageAddressing`, and the SER path added by #12097). KHR is the Vulkan-promoted name for the same extension the EXT atom refers to; `requirePhysicalStorageAddressing` also switches the addressing model to PhysicalStorageBuffer64 — if you only need the extension declared (not buffer_reference addressing), use `ensureExtensionDeclarationBeforeSpv15("SPV_KHR_physical_storage_buffer")` instead so the memory model stays Logical GLSL450.

**How to apply:** When a reviewer suggests "just model the SPIR-V extension dependency in the capdef", the capdef edit expresses the version floor / dependency graph but you STILL need explicit emitter C++ (an `ensureExtensionDeclaration` call, guarded on version/capability) to put the `OpExtension` in the module. A capdef-only change is necessary-but-insufficient for any extension the module must actually declare. The chokepoint that covers ALL paths (including hlsl.meta.slang `spirv_asm` blocks) is `requireSPIRVCapability` — spirv_asm `OpCapability` operands funnel through it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784120354355-slang-capdef-atoms-never-auto-emit-an-opextension-.md`_
