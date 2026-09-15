---
title: "SlangPy AppWindow surface invalidation — VK_ERROR_OUT_OF_DATE is not a typed status; recovery blocked on slang-rhi"
type: learning
topic: slang-compiler
source: learnings/1789373197415-slangpy-appwindow-surface-invalidation-vk-error-ou.md
---

# SlangPy AppWindow surface invalidation — VK_ERROR_OUT_OF_DATE is not a typed status; recovery blocked on slang-rhi

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789372638423-xfu8kl
written_at: 2026-09-14T08:06:37.415Z
---

# SlangPy AppWindow surface invalidation — VK_ERROR_OUT_OF_DATE is not a typed status; recovery blocked on slang-rhi

Context: triaging slangpy#1152 (AppWindow recover from recoverable presentation invalidation during resize without exception-string matching).

Key facts (verified in local checkout, 2026-09):
- In SGL, `Surface::acquire_next_image()` and `Surface::present()` (src/sgl/device/surface.cpp:79,96) both **throw** via the `SLANG_RHI_CALL` macro (helpers.h:27-34) on any `SLANG_FAILED`. They do NOT return null gracefully — the `if (!texture) return;` guard in `AppWindow::_run_frame()` (src/sgl/app/app.cpp:146) is effectively **dead code** (acquire throws on out-of-date, never returns null).
- The `VK_ERROR_OUT_OF_DATE_KHR` substring that downstream workarounds grep for is NOT a typed RHI code — it is debug-logger text folded into the thrown exception message by `build_slang_rhi_error_message` (src/sgl/device/helpers.cpp:104-121). The underlying RHI `Result` is a bare `SLANG_FAIL`.
- slang-rhi's `ISurface::acquireNextImage/present` (external/slang-rhi/include/slang-rhi.h:2968-2969) return only `Result` and expose **no typed status**. The Vulkan backend (src/vulkan/vk-surface.cpp:514-526,578-583) collapses recoverable `VK_ERROR_OUT_OF_DATE_KHR` AND fatal device-loss into the same `SLANG_FAIL`, and silently treats `VK_SUBOPTIMAL_KHR` as success.

Implication (load-bearing for any surface-recovery work): "recover from surface invalidation while PRESERVING device loss" is **impossible in SGL alone** — recoverable vs fatal is indistinguishable at the SGL boundary. It requires an **upstream slang-rhi** change (typed SurfaceStatus / SLANG_E_* code plumbed through every backend — note each backend has its OWN ISurface impl; CUDA has a separate VK swapchain+interop, not vk-surface.cpp). This is slang-rhi, NOT the slang compiler — so it's escalate-to-slang-rhi, not escalate-to-slang.

Also: `m_device->wait()` (queue-idle) is only called in `handle_resize` (app.cpp:183), NOT per-frame — so any recovery fix must keep it out of `_run_frame` to satisfy the "no added steady-state queue-idle wait" constraint. And slang-rhi surface tests ALWAYS SKIP in headless CI (no monitor) — regression coverage for this must be verified locally on a machine with a display.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789373197415-slangpy-appwindow-surface-invalidation-vk-error-ou.md`_
