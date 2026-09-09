---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787839952349-qjjqos
written_at: 2026-08-27T14:28:38.556Z
---

# Gating slang-test on a software rasterizer (lavapipe): -render-feature hardware-device

When triaging test failures on a **software Vulkan** host (Mesa lavapipe, `VK_PHYSICAL_DEVICE_TYPE_CPU`), the clean lever for "this test needs real GPU semantics" is **`-render-feature hardware-device`** appended to the failing `-vk` COMPARE_COMPUTE line.

Why it works (source-verified, slang-rhi):
- `external/slang-rhi/src/vulkan/vk-device.cpp:1644-1647`: `isSoftwareDevice = deviceType==VK_PHYSICAL_DEVICE_TYPE_OTHER||CPU; addFeature(isSoftwareDevice ? SoftwareDevice : HardwareDevice)`. lavapipe = CPU → reports **software-device, NEVER hardware-device**. Feature strings at slang-rhi.h:105-106. Convention is consistent: CPU backend always software; CUDA/WGPU/Metal always hardware; D3D11/12 WARP→software.
- `-render-feature <name>` missing-on-device yields **Ignored** (skipped), NOT Fail: parse `tools/render-test/options.cpp:154-175` → require+recheck `render-test-main.cpp:1919-1924`/`2017-2024` returns `SLANG_E_NOT_AVAILABLE` → `ToolReturnCode::Ignored` (`slang-test-tool-util.cpp:21-22`) → `TestResult::Ignored`.
- 52 tests already use `hardware-device`; e.g. quad-control's dx12/cuda lines carry it while its `-vk` lines don't — that asymmetry is exactly why the `-vk` lines fail on lavapipe.
- Feature-name MASTER LIST (single source of truth): `SLANG_RHI_FEATURES(x)` X-macro at `external/slang-rhi/include/slang-rhi.h:104-176`. Note: `wave-ops` (not "wave"), `atomic-int64`, `bindless`; NO `quad`/`subgroup` feature name.

Three distinct skip mechanisms, do not confuse:
1. `-render-feature` → runtime SKIP (Ignored) when device lacks the feature. Use for genuinely-missing capability.
2. `-expected-failure-list <file>` → reclassifies a clean **Fail→ExpectedFail** only; CANNOT suppress a SIGSEGV; keyed by test name, NOT device.
3. `-skip-list <file>` / `-exclude-prefix` → excludes a subtest BEFORE dispatch — the ONLY thing that contains a process crasher.

Gotcha: a feature being *present* doesn't mean the test is safe — lavapipe reports `Feature::Bindless` as supported yet faults on a test that reads a never-bound bindless descriptor (UB). Such tests must be fixed (or skip-listed), not feature-gated. Precedent for the whole pattern: PR #12734 (gated 127 coopmat vk lines on `-render-feature cooperative-matrix`).
