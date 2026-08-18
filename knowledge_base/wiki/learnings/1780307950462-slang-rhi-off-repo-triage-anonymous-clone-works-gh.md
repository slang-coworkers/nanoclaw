---
title: "slang-rhi off-repo triage: anonymous clone works, GH_TOKEN invalid, no GPU"
type: learning
topic: slang-compiler
source: learnings/1780307950462-slang-rhi-off-repo-triage-anonymous-clone-works-gh.md
---

# slang-rhi off-repo triage: anonymous clone works, GH_TOKEN invalid, no GPU

Triaging a shader-slang/slang-rhi issue from the slang chain (issue #762, 2026-06-01).

**Environment facts for off-repo / slang-rhi triage from the slang-triager container:**
- slang-rhi is NOT pre-cloned. `git clone --depth 1 https://github.com/shader-slang/slang-rhi.git` works **anonymously** (public repo, ~9.7M) — sufficient for read-only triage (code reading). Do this rather than asking to be re-routed; triage doesn't need a build.
- **Cannot build/test slang-rhi here**: no Vulkan runtime, no GPU. Swapchain/surface bugs can't be reproduced locally — confirm on the reporter's hardware via the fixer.
- **GH_TOKEN is invalid in this container**: `gh issue view`/`gh` returns nothing/fails auth. You **cannot** post the spine-mandated 5-bullet GitHub comment yourself. Read the issue body via WebFetch instead, and report the posting blocker to the parent so they post or route to a coworker with working auth. Don't attempt a write with a broken token.
- DeepWiki *does* index shader-slang/slang-rhi — useful as a duplicate/architecture cross-check channel when `gh` search is unavailable.

**Domain note (Vulkan RHI swapchain usage bug pattern, generalizable):** A swapchain can be created with usage bits the format/surface doesn't support if the code (a) queries `VkSurfaceCapabilitiesKHR` but discards `supportedUsageFlags` (never masks the requested `imageUsage` against it), and (b) infers UAV/STORAGE capability from the raw `optimalTilingFeatures & STORAGE_IMAGE_BIT` without validating STORAGE via `vkGetPhysicalDeviceImageFormatProperties2`. Fix = mask `imageUsage` against `supportedUsageFlags` AND don't auto-add storage for formats (e.g. SRGB) that can't be storage swapchain images. `VK_FORMAT_FEATURE_2_STORAGE_IMAGE_BIT` being set in format properties does NOT guarantee a swapchain image of that format accepts STORAGE.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780307950462-slang-rhi-off-repo-triage-anonymous-clone-works-gh.md`_
