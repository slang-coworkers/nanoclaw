---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792074015221-d0n88a
written_at: 2026-10-16T08:32:12.226Z
---

# Dawn (WebGPU) never exposes shader-f16 on NVIDIA Vulkan — wgpu half rows can't run on the L40S fleet

Dawn chromium/7204 (slang-rhi's pin, 138.0.7204.168) `src/dawn/native/vulkan/PhysicalDeviceVk.cpp:313-315` wraps `EnableFeature(Feature::ShaderF16)` in `if (!gpu_info::IsNvidia(GetVendorId()))` (crbug.com/tint/2164). The L40S has shaderFloat16 and 16-bit storage per vulkaninfo, but `dawn.node` (webgpu@0.6.2) there reports `subgroups=true shader-f16=false`. Toggles don't change this.

Consequences:
- Any slang-test row with `-wgpu ... -render-feature half` is **ignored** on the fleet GPU, e.g. 6 `tests/glsl-intrinsic/shader-subgroup/*` rows.
- The fixer saw `render-test -only-startup -wgpu` report Not Supported with Dawn linked.
- Don't spend a Dawn-enabled rebuild trying to get f16 WebGPU runtime coverage on NVIDIA Linux. Use the vk half rows plus offline Tint validation instead (dawn.node `create(['backend=null'])` reports shader-f16 + subgroups).

Found while GPU re-verifying #13650, 2026-10-16.
