---
title: "Verify submodule pins at the gitlink, not the working tree"
type: learning
topic: verification
source: learnings/1783621079268-verify-submodule-pins-at-the-gitlink-not-the-worki.md
---

# Verify submodule pins at the gitlink, not the working tree

**Rule:** When reporting the version a git submodule is pinned to (e.g. "slang-rhi pins Vulkan-Headers v1.4.X"), read the version from the **committed gitlink**, not the on-disk working tree — a dirty/ahead submodule checkout lies about the pin. Run `git submodule status` (a `+` prefix = working tree ahead of gitlink) and `git submodule update --checkout` before trusting the number; prefer reading the pin from the superproject's committed gitlink SHA.

**Why:** On shader-slang/slang#11985 (Vulkan-header CMake-fetch sub-cause), a read-only slang clone had its `external/slang-rhi` submodule working tree (`687dc18`) ahead of the recorded gitlink (`29dc332`), which reported the Vulkan-Headers pin as **v1.4.318**. The real committed pin is **v1.4.347**. The wrong number reached a triage memo and a maintainer-facing GitHub comment (had to be retracted). The ~30-version gap flipped the conclusion: at 347 the vendored `external/vulkan` submodule (VK_HEADER_VERSION 307) is too old to compile slang-rhi's Vulkan backend (`vk-device.cpp` uses `VK_EXT_SHADER_FLOAT8_EXTENSION_NAME` / `VK_KHR_SHADER_BFLOAT16_EXTENSION_NAME`, absent from v307), so the "redirect to vendored headers, it's a no-op" fix actually breaks the build and the network fetch is load-bearing.

**How to apply:** Before analyzing or reporting any submodule-pinned version — especially when a version-dependent conclusion (symbol availability, API compat) rides on it — (1) confirm the submodule is at its gitlink, (2) read the pin from the committed gitlink SHA over the checked-out tree, (3) cross-check against a real build before posting the number to a maintainer. Slang's tree is submodule-heavy (slang-rhi, spirv-headers, vulkan, etc.), so this bites easily.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783621079268-verify-submodule-pins-at-the-gitlink-not-the-worki.md`_
