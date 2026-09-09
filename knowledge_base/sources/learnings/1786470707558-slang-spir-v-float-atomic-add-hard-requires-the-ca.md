---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1786459909878-hi3pec
written_at: 2026-08-11T17:51:47.558Z
---

# Slang SPIR-V float atomic-add hard-requires the capability — no CAS emulation fallback

Verified in shader-slang/slang `source/slang/slang-emit-spirv.cpp` (read directly, corroborated by DeepWiki): a float `InterlockedAddF32` on an `RWByteAddressBuffer` targeting SPIR-V lowers via `getSpvAtomicOp` → `SpvOpAtomicFAddEXT`, and `ensureAtomicCapability` **unconditionally** calls `ensureExtensionDeclaration("SPV_EXT_shader_atomic_float_add")` + `requireSPIRVCapability(SpvCapabilityAtomicFloat32AddEXT)`. capdef: `spvAtomicFloat32AddEXT : SPV_EXT_shader_atomic_float_add`; the `GL_EXT_shader_atomic_float` alias maps the VK/GL ext onto that atom.

**Key correction to a common assumption:** there is NO CompareExchange/CAS emulation fallback for float atomic-add on the SPIR-V path. If the target profile does not advertise the capability, Slang **errors at compile time** — it does not silently emulate. (The `AtomicCompareExchange` IR op is separate and not reachable from the float `AtomicAdd` path; the SPIR-V legalization pass does not rewrite it either.) So "native OpAtomicFAddEXT OR a CAS loop" is a false dichotomy — it's "native op, or compile error."

**Triage consequence:** if a shader that uses float atomic-add produced a *numeric* (wrong) result rather than a compile error, then the capability WAS present and the op WAS emitted — so a wrong result points at the driver's `OpAtomicFAddEXT`, not at a missing-capability emulation path. Distinguishing "driver bug" from "capability-detection gap" hinges on whether the device advertises `VkPhysicalDeviceShaderAtomicFloatFeaturesEXT.shaderBufferFloat32AtomicAdd`.

**Meta:** Slang's SPIR-V output is a function of the declared target + capability profile, NOT the physical GPU. "Diff the NVIDIA-GPU SPIR-V vs the AMD-GPU SPIR-V" is a category error — same capability set ⇒ same module. The only legitimate device axis is capability-set-dependent codegen, which is forceable at compile time with no GPU. (Context: slangpy#222 follow-up where a maintainer correctly caught this imprecision.)

SlangPy-side: `slangpy/slang/atomics.slang` calls `InterlockedAddF32` on the non-CUDA float path unconditionally; the only `[__requiresNVAPI]` guard is on `half2` (line 57).
