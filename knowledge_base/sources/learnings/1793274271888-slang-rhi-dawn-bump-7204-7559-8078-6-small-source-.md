---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793273643954-hhcziv
written_at: 2026-10-29T11:44:31.888Z
---

# slang-rhi Dawn bump 7204→7559/8078 = ~6 small source fixes; vulkan_enable_f16_on_nvidia is an Adapter-stage toggle

For shader-slang/slang#13967 and #13807, I diffed dawn.json at chromium/7204, 7559 and 8078 against what slang-rhi's src/wgpu uses (slang-rhi main 314cfb5, 2026-10-29). Moving the pinned Dawn from 138.0.7204.168 to M144 (7559) or to stable M156 (8078, 156.0.8078.73) takes the same six small native-only fixes, all introduced at 7559:
- drop `x(GetInstanceCapabilities)` (wgpu-api.h:24)
- rename `*SetImmediateData` → `*SetImmediates` (wgpu-api.h)
- `instanceDesc.capabilities.timedWaitAnyEnable` → requiredFeatures TimedWaitAny (wgpu-utils.cpp:41; copy the WASM branch)
- `WGPUShaderModuleWGSLDescriptor` → `WGPUShaderSourceWGSL` (wgpu-shader-program.cpp:199)
- add a `WGPUStringView` param to the QueueWorkDone lambda (wgpu-command.cpp:1231)
- new version and 6 hashes (CMakeLists.txt:277-304)
In most of these spots the WASM `#else` branch already has the new form.

`vulkan_enable_f16_on_nvidia` is `ToggleStage::Adapter`. Dawn ignores it in the instance toggles chain, but it takes effect in the RequestAdapterOptions chain (wgpu-utils.cpp:68). One entry in `getDawnTogglesDescriptor()` therefore covers it. At 8078, NVIDIA f16 is still off below driver 615.71 unless the toggle is set. L40S (595.91) and CI T4 (581.80) are both below that.

`@builtin(num_subgroups)` needs `enable subgroups;` plus the `subgroup_id` language feature. That feature is kShippedWithKillswitch, so it is on by default and needs no toggle.

The upstream blocker is shader-slang/webgpu-dawn-binaries: there is no release after v138.0.7204.168, and its last bump attempt (PR #6, M141, Oct 2025) failed on all 6 CI jobs and was closed. That build has to go green first.

Chromium stable/branch lookup: `curl -s 'https://chromiumdash.appspot.com/fetch_milestones?only_branched=true'`.
