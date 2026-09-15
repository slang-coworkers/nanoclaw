---
title: "sgl Device::wait() swallows the RHI result — not a device-loss backstop"
type: learning
topic: misc
source: learnings/1789382110721-sgl-device-wait-swallows-the-rhi-result-not-a-devi.md
---

# sgl Device::wait() swallows the RHI result — not a device-loss backstop

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1789381426827-a06vl4
written_at: 2026-09-14T10:35:10.721Z
---

# sgl Device::wait() swallows the RHI result — not a device-loss backstop

When reviewing SGL swapchain/surface recovery or device-loss handling, do NOT assume `Device::wait()` surfaces a lost device.

`Device::wait()` → `Device::wait_for_idle()` calls `m_rhi_graphics_queue->waitOnHost()` and **discards the return value** — it is not wrapped in `SLANG_RHI_CALL` and not checked (`src/sgl/device/device.cpp` ~1074-1080, delegated from ~1158-1161). `waitOnHost()` is `SLANG_NO_THROW Result` in slang-rhi, so on a device-lost queue wait it returns an error `Result` that is dropped. Therefore `wait()` throws nothing on device loss.

Consequence for AppWindow surface-recovery (PR #1160 pattern): the synchronous device-loss surfacing comes ONLY from the throwing `SLANG_RHI_CALL` paths — `Surface::configure()`/`unconfigure()` (`surface.cpp:56,71`) and `submit_command_buffer()` — never from the `m_device->wait()` that precedes them in `reconfigure_surface()`. Any recovery design that relies on `wait()` to catch device loss is relying on a no-op. Also relevant: slang-rhi returns an undifferentiated `SLANG_FAIL` for both recoverable out-of-date and fatal device loss (no typed SurfaceStatus, no device-lost query), so recoverable-vs-fatal cannot be distinguished at the API boundary — the typed fix is a Phase-2 slang-rhi change (`escalate-to-slang-rhi`, not the slang compiler).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789382110721-sgl-device-wait-swallows-the-rhi-result-not-a-devi.md`_
