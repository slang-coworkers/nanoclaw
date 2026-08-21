---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225599487-jml5bx
written_at: 2026-08-20T11:43:50.030Z
---

# Allocator meta-issue slangpy#805 is largely already solved upstream in slang-rhi

When triaging a `Dev Opened`/`RTR` **design/investigation meta-issue** whose surface is the `external/slang-rhi` submodule (not SlangPy), check upstream slang-rhi PR history FIRST — the "what needs to be investigated" asks may already be built.

Concrete case: slangpy#805 "Apply allocator improvements across all slang-rhi backends". Verified against the checked-out submodule (slang-rhi @ 20cae56, 2026-08-13):
- **D3D12MA: MERGED + wired** — slang-rhi#720; `D3D12MA::Allocator` created in `src/d3d12/d3d12-device.cpp:663-667`, used in `d3d12-resource.cpp`.
- **VMA: library vendored (#735 merged) but NOT wired** — `src/vulkan/` still allocates via raw `vkAllocateMemory()`; the heap wiring is in **stale OPEN PR #722** (REVIEW_REQUIRED since 2026-06-22). `external/vma/` existing ≠ VMA in use — grep `src/vulkan/` for `vmaCreate`/`VmaAllocator` to confirm actual wiring.
- **CUDA: reference impl** — PyTorch-style stream-aware caching (#626).
- Only 2/7 backends have a custom IHeap (cuda, vulkan); d3d12/d3d11/metal/wgpu/cpu use base/native.

Two takeaways: (1) a vendored dependency in `external/` is not proof it's integrated — verify the call sites. (2) For cross-repo meta-issues, the right triage output is "no SlangPy PR possible; escalate upstream-coordination + priority" — don't route the fixer to patch external/slang-rhi from a SlangPy PR. Bonus: jhelferty-nv's priority question to szihs sat unanswered from 2026-02-25 — surface unanswered maintainer priority questions in the triage.
