---
title: "CoopVec/RT VK_ERROR_DEVICE_LOST is a documented slang-rhi NV-driver interference class, not Slang codegen"
type: learning
topic: slang-compiler
source: learnings/1789964362918-coopvec-rt-vk-error-device-lost-is-a-documented-sl.md
---

# CoopVec/RT VK_ERROR_DEVICE_LOST is a documented slang-rhi NV-driver interference class, not Slang codegen

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789963608761-wdyc25
written_at: 2026-09-21T04:19:22.918Z
---

# CoopVec/RT VK_ERROR_DEVICE_LOST is a documented slang-rhi NV-driver interference class, not Slang codegen

When a `SPV_NV_cooperative_vector` (CoopVec) **compute** dispatch device-losts (`VK_ERROR_DEVICE_LOST`) **only after** a `VK_KHR_ray_tracing_pipeline` was created/used in the same VkDevice (shader-slang/slang#13191, RTX 4060 driver 591.86, via slangpy→slang-rhi):

- **The Slang compiler is exonerated (source fact).** Slang emits each SPIR-V module independently — CoopVec caps/extensions/Vulkan-memory-model/matmul operands derive purely from the module's own IR + target caps and are byte-identical regardless of any RT pipeline elsewhere in the device. `slang-emit-spirv.cpp:10103` (matmul), per-module memory model `slang-ir-spirv-legalize.cpp:2564-2606`, capdef `SPV_NV_cooperative_vector` (`slang-capabilities.capdef:679`) pulls SPIR-V 1.6 + replicated-composites + Vulkan memory model. If the *identical* dispatch works alone, it's not codegen.
- **slang-rhi already documents this interference class.** `DeviceDesc::enableRayTracing` (default `true`) comment (include/slang-rhi.h ~line 3534): "enabling these extensions has been observed to interfere with concurrent **cuDNN** usage on some driver/GPU pairs." Sibling `enableCUDALaunchFromGfx` (VK_NVX_binary_import) identical warning. Both gated behind opt-out flags by slang-rhi **PR #760**; RT gating at `vk-device.cpp:883`. ⚠ The comment names cuDNN, NOT cooperative vector — CoopVec matmul being an NV tensor/cuDNN-adjacent path is an INFERENCE that it's the same class (verify, don't overstate).
- **Nuance:** with `enableRayTracing` defaulting on, RT extensions are enabled even when coopvec-alone *works* ⇒ the trigger is RT-pipeline **creation/use**, not mere extension enablement.
- **Discriminating tests (no GPU-free path — needs a coopvec-capable NV GPU, 570+ driver):** (1) `DeviceDesc::enableRayTracing=false` → coopvec stops crashing? (confirms RT is the cause; disables RT so diagnostic-only); (2) RT enabled, RT-PSO created but never dispatched → isolates PSO-creation vs dispatch; (3) dump SPIR-V (`SLANGPY_PRINT_GENERATED_SHADERS=1` / `slangc -target spirv-asm`) + validate, expect identical/valid in RT-present vs absent; (4) capture `VK_EXT_device_fault` when validation layers are silent.
- **This env cannot reproduce coopvec at all** — L40S (driver 565.57.01) lacks `VK_NV_cooperative_vector` (needs 570+); coopvec still *compiles* (exit 0) so compile-only checks give false confidence.
- Triage disposition: likely NV-driver bug; may belong on shader-slang/slang-rhi rather than the compiler repo.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789964362918-coopvec-rt-vk-error-device-lost-is-a-documented-sl.md`_
