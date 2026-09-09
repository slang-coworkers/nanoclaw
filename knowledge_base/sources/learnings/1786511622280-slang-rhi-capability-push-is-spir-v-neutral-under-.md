---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786498006806-gju8c0
written_at: 2026-08-12T05:13:42.280Z
---

# slang-rhi capability push is SPIR-V-neutral under default (non-restrictive) profile

When triaging a slang-rhi "we advertise capability X off the wrong Vulkan device bit → Slang emits an unsupported SPIR-V op" bug (e.g. slang-rhi#833, float atomic-add off `shaderBufferFloat32Atomics` instead of `shaderBufferFloat32AtomicAdd`): fixing the capability advertisement is correct for ACCOUNTING but, by itself, does NOT change the emitted SPIR-V.

MEASURED (slangc, `-target spirv-asm -capability spirv_1_5`, RWByteAddressBuffer.InterlockedAddF32): capability atom PRESENT vs ABSENT in the target profile → **byte-identical SPIR-V**, both emitting `OpAtomicFAddEXT` with only `warning[E41012] profile implicitly upgraded`, exit 0. slang-rhi (`src/slang-context.h`) passes no `-restrictive-capability-check`, so an unsatisfied capability is an IMPLICIT UPGRADE (warning), not a refusal. Only `-restrictive-capability-check` turns a missing atom into hard `error[E41013]`.

Why: Slang emits atomic ops based on the IR (the shader USED atomic-add); the target profile's capabilities gate error/warning/clean, not whether the instruction is emitted. `getSpvAtomicOp`→`SpvOpAtomicFAddEXT`, `ensureAtomicCapability`→`requireSPIRVCapability` unconditionally when the op is present.

Two more traps in this family:
1. slang-rhi's Vulkan backend pushes the COARSE extension atom `SPV_EXT_shader_atomic_float_add`, but the intrinsics `[require]` the FINER per-width atoms (`spvAtomicFloat32AddEXT + spvAtomicFloat32MinMaxEXT`, via `GL_EXT_shader_atomic_float`). A parent atom does NOT imply its derived atoms (DeepWiki + measured), so even the happy path warns E41012 today. The finer atoms exist in `capabilities.h` but are never pushed.
2. If a downstream consumer (SlangPy) steers behavior off `hasFeature("atomic-float")`, and the coarse `Feature::AtomicFloat` bit is still set on the base device bit, the fix doesn't reach the consumer's decision. The operative symptom fix is then the Feature base-vs-add SPLIT, not just the capability gate.

⇒ For such bugs: land the capability-gate fix, but do NOT assume it changes emitted code or fixes a downstream silently-wrong-result symptom. Check the default-vs-restrictive capability-check posture and whether the downstream steers off `hasFeature` (coarse) vs the capability.

Also: `SIMPLE_EXTENSION_FEATURE`'s gate bit (`vk-device.cpp:745`→`addFeatureExtension` `:726`) does DOUBLE DUTY — it chains the extension struct into deviceCreateInfo AND gates the capability push. So you cannot just swap the gate bit to the add bit (that would stop enabling BASE atomics the device supports); keep the gate on the base bit, guard only the capability push with an inner `if (…AtomicAdd)`.
