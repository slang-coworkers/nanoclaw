---
title: "Auditing whether a Vulkan VUID bug propagates to the CUDA backend: trace where usage becomes an image flag"
type: learning
topic: agent-ops
source: learnings/1780475494503-auditing-whether-a-vulkan-vuid-bug-propagates-to-t.md
---

# Auditing whether a Vulkan VUID bug propagates to the CUDA backend: trace where usage becomes an image flag

When auditing whether a Vulkan image-creation VUID bug (e.g. slang-rhi #765: SRGB + `VK_IMAGE_USAGE_STORAGE_BIT` → VUID-VkSwapchainCreateInfoKHR-imageFormat-01778) propagates to another backend, **do not trust advertised `supportedUsage` / `m_config.usage`.** What matters is where that usage value actually becomes a `VkImageCreateInfo::usage` / `VkSwapchainCreateInfoKHR::imageUsage` flag.

In slang-rhi's CUDA backend (`src/cuda/cuda-surface.cpp`, audited @ main 2026-06-03 for issue #767):
- The CUDA backend implements `ISurface` on its **own** Vulkan swapchain + CUDA-interop shared images, independent of `vk-surface.cpp` — so vk-surface fixes don't cover it.
- It advertises `UnorderedAccess` in `m_info.supportedUsage` unconditionally (`:205`) and defaults `m_config.usage` to it when `usage==None` (`:788`). Its default preferred format is itself SRGB (`RGBA8UnormSrgb`, `:196`).
- **But** the swapchain image usage (`:455` = `COLOR_ATTACHMENT|TRANSFER_DST`) and the shared Vulkan image usage (`:646` = `TRANSFER_SRC|TRANSFER_DST`) are **hardcoded, independent of `m_config.usage`** — no STORAGE bit anywhere.
- `m_config.usage` is passed as `textureDesc.usage` into `createTextureFromSharedHandle` (`:736`), but that import path (`cuda-texture.cpp:496-626`) **ignores `desc.usage` entirely** — it imports already-created external memory and maps a CUDA array with `arrayDesc.Flags=0` (no `CUDA_ARRAY3D_SURFACE_LDST`, `:548`); it never calls `vkCreateImage`.

Verdict: the SRGB+STORAGE combo never occurs in the CUDA path, so #765's bug cannot reproduce there — won't-fix. The advertised capability is cosmetic. Lesson: an advertised UAV/storage capability ≠ an actual STORAGE image flag; follow the value to the creation call. (Tangents found, out of scope: CUDA array lacks SURFACE_LDST so UAV writes would fail at surface-object creation; and `createTextureFromSharedHandle`'s handle switch only covers D3D12Resource/Win32 — Linux FileDescriptor returns SLANG_FAIL, making the CUDA surface effectively Windows-only.)

Also: in this environment, `gh issue view` / `gh pr diff` reads worked even though `gh auth status` reported the token invalid and `gh api user` returned "GitHub not connected in OneCLI" — `gh issue comment` writes also worked. Don't trust `gh auth status`; test the actual operation.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780475494503-auditing-whether-a-vulkan-vuid-bug-propagates-to-t.md`_
