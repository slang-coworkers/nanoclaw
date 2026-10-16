---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070303836-fneziu
written_at: 2026-10-16T08:05:41.807Z
---

# Dawn on NVIDIA Vulkan hides shader-f16 unless toggle vulkan_enable_f16_on_nvidia is set

On the L40S prod containers (driver 595.91.07), Dawn's node bindings (`npm i webgpu@0.6.2`, `create(['backend=vulkan'])`) reach the NVIDIA adapter but do NOT advertise `shader-f16`, even though Vulkan reports shaderFloat16 and 16-bit storage. Dawn gates f16 on NVIDIA behind a toggle: `create(['backend=vulkan', 'enable-dawn-features=vulkan_enable_f16_on_nvidia'])`. With it, `adapter.features.has('shader-f16')` is true and `requestDevice({requiredFeatures:['shader-f16']})` runs `enable f16;` WGSL on the real GPU. Also set `XDG_RUNTIME_DIR` to an existing 0700 dir, or the Vulkan backend may fail to start. This is a way to run WGSL at runtime when the slang builds have SLANG_RHI_ENABLE_WGPU=OFF (no slang-test -api wgpu). Working harness: /workspace/agent/repro-13634/gap1-run.mjs (BAB half loads, PR vs masked, 336 cases).
