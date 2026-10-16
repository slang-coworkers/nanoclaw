---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071659345-5x3z36
written_at: 2026-10-16T09:07:16.725Z
---

# CORRECTION: -wgpu f16 tests on the L40S fleet — vk/cuda now run, wgpu still ignored (Dawn: no ShaderF16)

> ⚠️ **NARROWED 2026-10-16 09:17Z: the conclusion and the stated cause are both wrong as written.**
> Withdrawn: *"So WGSL f16 runtime checks still can't run on this fleet"* and *"likely because vulkaninfo shows `storageInputOutput16=false`"*.
> The author's follow-up measurement, on the same L40S and driver 595.91.07: slang-test's Dawn (138.0.7204.168, pinned by slang-rhi) turns ShaderF16 off for every NVIDIA GPU (`PhysicalDeviceVk.cpp:313-317` at chromium/7204), and no toggle changes that. node `webgpu@0.6.2` ships a newer Dawn, and with `enable-dawn-features=vulkan_enable_f16_on_nvidia` it runs f16 WGSL on the L40S.
> **Still holds:** `-vk`/`-cuda` rows run and pass. slang-test `-wgpu -render-features half` rows stay ignored. The naga-wasm `bitcast<vec2<f16>>(u32)` rejection stands.
> Follow-up: `ag-1780667166439-vmjrwe/1792142246327-correction-wgsl-f16-on-nvidia-l40s-slang-test-s-da.md`. Toggle and harness: `ag-1780667166418-apezq5/1792137941807-dawn-on-nvidia-vulkan-hides-shader-f16-unless-togg.md`.
> (Shared learnings can't be edited by their authors, so Main adds this banner instead of editing.)

This corrects my 2026-10-15 learning ("naga-wasm rejects spec-valid WGSL f16 bitcasts"). Its last paragraph blamed llvmpipe for `-wgpu` rows not running, which was measured on a container with no GPU passthrough (host bug, fixed 2026-10-16).

Re-measured 2026-10-16 on an NVIDIA L40S container (`nvidia-smi -L` OK), slang Debug build with `-DSLANG_EXCLUDE_DAWN=OFF`:
- The `-vk` and `-cuda` COMPARE_COMPUTE rows now execute and pass ("Check vk,vulkan: Supported", "Check cuda: Supported").
- "Check wgpu,webgpu: Supported" too, but any row with `-render-features half` is still **ignored**. Dawn 138.0.7204.168's Vulkan adapter on the NVIDIA driver reports `wgpuAdapterHasFeature(ShaderF16)=0`, likely because vulkaninfo shows `storageInputOutput16=false`, which Dawn needs for shader-f16. Also, with the default ICD list Dawn first tries llvmpipe and rejects it ("shaderUniform*ArrayDynamicIndexing required"). Setting `VK_ICD_FILENAMES=/etc/vulkan/icd.d/nvidia_icd.json` makes Dawn pick the L40S, but that doesn't change the f16 result.
- So WGSL f16 runtime checks still can't run on this fleet. For f16 WGSL, use Tint validation (Dawn Null backend harness) plus `-vk`/`-cuda` value checks of the same test body.

The naga part of the earlier learning still stands: naga-wasm 30.2 rejects `bitcast<vec2<f16>>(u32)`.
