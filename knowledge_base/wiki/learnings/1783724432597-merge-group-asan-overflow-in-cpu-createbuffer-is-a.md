---
title: "Merge-group ASan overflow in cpu createBuffer is a render-test caller bug, not slang-rhi (slang#12058)"
type: learning
topic: slang-compiler
source: learnings/1783724432597-merge-group-asan-overflow-in-cpu-createbuffer-is-a.md
---

# Merge-group ASan overflow in cpu createBuffer is a render-test caller bug, not slang-rhi (slang#12058)

shader-slang/slang#12058: merge-group `sanitizer` job aborts with an ASan heap-buffer-overflow — `memcpy` READ of size 142 past a 140-byte region — in `rhi::cpu::DeviceImpl::createBuffer` (`external/slang-rhi/src/cpu/cpu-buffer.cpp:36`). CI-babysitter framed it as "likely fix in slang-rhi + submodule pin bump, suspect the #11960 ToT bump."

**Both halves of that framing were wrong, and the triage payoff was proving it:**

1. **Layer = the caller (render-test in the slang repo), not slang-rhi.** `tools/render-test/render-test-main.cpp:494-499`: `bufferSize = Math::Max(count*4, elementCount*stride)` can be non-4-aligned (e.g. 142). Then `bufferData.reserve(bufferSize / sizeof(uint32_t))` FLOOR-truncates → a `List<uint32_t>` of only `floor(142/4)*4 = 140` bytes. `shader-renderer-util.cpp:204` sets `bufferDesc.size = 142` and passes that 140-byte block as `initData`; `createBuffer` memcpys the full `desc.size` → 2-byte over-read. `fixupBufferDesc` does NOT touch `.size`.

2. **slang-rhi structurally CANNOT be the fix.** `IDevice::createBuffer(const BufferDesc& desc, const void* initData, IBuffer** outBuffer)` (`slang-rhi.h:3425`) takes `initData` as a **length-less bare pointer**. The RHI has no way to know the caller's block size, so it cannot clamp the copy. The contract is "initData covers desc.size bytes" — the caller owns it. This is the reusable tell: **when an API takes a length-less `const void*` data pointer, an over-read is always a caller/producer bug; don't propose clamping in the callee.**

3. **The #11960 suspect was refuted by a file-level bisect, not a full rebuild.** `git diff <old-pin>..<new-pin> -- src/cpu/cpu-buffer.cpp src/resource-desc-utils.cpp` across the exact submodule pin range (687dc186 #775 → 29dc332e #795) was **byte-identical**. A submodule "bump" suspect is cheaply confirmed/refuted by diffing just the implicated files across the two pinned SHAs — no build needed. (The slang-rhi clone is shallow but both pinned commits were present, so the diff was valid — always `git cat-file -t <sha>` both endpoints before trusting an empty diff.)

Fix = ceil the word count at render-test-main.cpp:497: `const size_t wordCount = (bufferSize + sizeof(uint32_t)-1)/sizeof(uint32_t);`. Single-file, in-repo, bot-PR-able. Classified Bug / high / P1 (merge-queue blocker); NOT `regression` (2024-era latent code, no behavior change) and NOT `reproduced` (needs the clang ASan `-shared-libsan` build).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783724432597-merge-group-asan-overflow-in-cpu-createbuffer-is-a.md`_
