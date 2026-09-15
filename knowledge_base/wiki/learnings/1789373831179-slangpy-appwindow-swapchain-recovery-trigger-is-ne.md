---
title: "SlangPy AppWindow swapchain recovery: trigger is next acquire, and SGL_THROW is noisy — use non-throwing try_ variants"
type: learning
topic: slang-compiler
source: learnings/1789373831179-slangpy-appwindow-swapchain-recovery-trigger-is-ne.md
---

# SlangPy AppWindow swapchain recovery: trigger is next acquire, and SGL_THROW is noisy — use non-throwing try_ variants

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789373151314-bkufrt
written_at: 2026-09-14T08:17:11.179Z
---

# SlangPy AppWindow swapchain recovery: trigger is next acquire, and SGL_THROW is noisy — use non-throwing try_ variants

Planning slangpy#1152 (AppWindow recover from VK_ERROR_OUT_OF_DATE_KHR during resize) surfaced two non-obvious facts beyond the earlier triage learning:

1. **On Vulkan, presentation invalidation is detected on the NEXT `acquireNextImage()`, not on `present()`.** `external/slang-rhi/src/vulkan/vk-surface.cpp` `present()` (~395-434) **ignores the `vkQueuePresentKHR` return value** (line ~427) and returns `SLANG_OK` unless the current texture index is -1. `acquireNextImage()` (~352-393) checks `vkAcquireNextImageKHR` manually: `VK_SUBOPTIMAL_KHR`→success; `VK_ERROR_OUT_OF_DATE_KHR` AND `VK_ERROR_DEVICE_LOST` both → a silent bare `SLANG_FAIL` (no reportVulkanError on that branch). ⇒ Any SGL-side recovery must be driven off the acquire failure, not present. (Guard present too for D3D/WGPU/CUDA which may surface it there.)

2. **`SGL_THROW` throws a plain `std::runtime_error` AND calls `log_fatal(...)` + `platform::debug_break()` BEFORE throwing** (`src/sgl/core/error.cpp:30-36`; macro at `error.h:93`). There is no typed SGL exception subclass. So wrapping acquire/present in a try/catch to recover from a *routine* recoverable resize would emit a fatal log + a debugger break every time. Prefer adding non-throwing `try_*` variants on `Surface` that call the RHI method directly and return the `Result` (skip `SLANG_RHI_CALL`), and check `SLANG_FAILED` in the caller.

3. **No device-lost query exists on `rhi::IDevice`.** `getInfo()`→`DeviceInfo` (slang-rhi.h ~3143-3168) is static descriptor data with no health field; the only device-loss signal is `IDebugCallback::handleMessage` (a debug text stream, unreliable in release). On Vulkan a fence-path device loss trips `SLANG_RHI_ASSERT_FAILURE("Vulkan device lost")` inside RHI. ⇒ You cannot probe device health; the principled interim is "recovery-as-test": soften only acquire/present, keep configure()/wait()/submit throwing so real device loss propagates at the reconfigure step, plus a bounded consecutive-failure ceiling so a persistent non-throwing failure isn't silently swallowed. The full fix needs a typed SurfaceStatus upstream in slang-rhi across all backends.

Also reconfirmed: RHI base `getConfig()` returns non-null across an out-of-date (only unconfigure/failed-configure clears `m_configured`), so SGL's `config()` guard can't detect invalidation — an SGL dirty flag is required. And slang-rhi surface tests SKIP on headless CI (test-surface.cpp:325 hasMonitor) — verify locally on a display.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789373831179-slangpy-appwindow-swapchain-recovery-trigger-is-ne.md`_
