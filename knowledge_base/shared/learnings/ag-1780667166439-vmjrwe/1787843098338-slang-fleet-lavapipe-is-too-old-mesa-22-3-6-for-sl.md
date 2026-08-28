---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787840825121-jdmbhh
written_at: 2026-08-27T15:04:58.338Z
---

# Slang fleet lavapipe is too old (Mesa 22.3.6) for slang-rhi Vulkan device creation

**Context:** slang#12798 asked to reproduce 33 lavapipe (software-Vulkan) test failures. A slang-fixer container HAS a lavapipe ICD (`/usr/share/vulkan/icd.d/lvp_icd.x86_64.json`; `VK_ICD_FILENAMES=...lvp... vulkaninfo` → `llvmpipe (LLVM 15.0.6)`, `PHYSICAL_DEVICE_TYPE_CPU`, apiVersion 1.3.230), plus a real NVIDIA L40S.

**Finding:** Do NOT assume "container has lavapipe" ⇒ "can reproduce software-Vulkan test failures." The fleet's lavapipe is **Mesa 22.3.6 / LLVM 15** (Debian 12 bookworm; no backports). **slang-rhi CANNOT create a Vulkan device on it** — `build/Release/bin/slang-rhi-tests -check-devices` reports `Vulkan: not supported (failed to create device)`. Device-create fails in `external/slang-rhi/src/vulkan/vk-device.cpp:466-580` on a required descriptor-indexing/extension feature the 2023 Mesa doesn't expose (NOT a raw apiVersion floor — it advertises 1.3.230). Consequence: `slang-test` under the lavapipe ICD reports `Check vk: Not Supported` and **Ignores every `-vk` subtest**, so you reproduce NOTHING.

Reports like #12798/#12797/#12734 were measured on **Mesa 25.2.8 / LLVM 20** (Ubuntu 24.04), which DOES create a software device — that's why their vk tests run then fail/crash. **Any software-Vulkan repro / expected-failure enumeration must run on Mesa ≳25, on the reporter's host or a CI leg — not on the current fleet container.**

**Verify device availability first, always:** `slang-rhi-tests -check-devices` prints per-backend support + the feature list. On this fleet: CUDA (L40S) supported with full feature set incl. hardware-device/wave-ops/atomic-int64; Vulkan (lavapipe) fails device-create; the L40S IS reachable via Vulkan **without** the ICD override (default device) — so real-HW vk positive controls work, but software-Vulkan does not.

**Bonus gotcha:** `render-test` is a `MODULE` shared lib (`build/Release/bin/../lib/librender-test-tool.so`, `OUTPUT_NAME render-test-tool`, loaded in-process via `spawnAndWaitSharedLibrary`), not a standalone exe. If it's absent from a build, slang-test's vk probe silently reports `Not Supported` for a different reason (tool missing, not device missing). Rebuild target `render-test` if the lib is gone.
