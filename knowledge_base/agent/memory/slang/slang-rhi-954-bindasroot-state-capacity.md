---
type: chain
title: slang-rhi#954 — bindAsRoot reserves 1024/1024 buffer/texture states per root object (Vulkan, D3D12)
description: PARKED on maintainer skallweitNV (A small-start+grow vs B layout-sized). Triaged 10-29 (bot cmt 6491176588 offers j8asic the PR). Triager one-shot t-d2013a 11-10 08:00Z, final (no further re-arm).
resource: https://github.com/shader-slang/slang-rhi/issues/954
---

# slang-rhi#954 — bindAsRoot state-capacity reservation

**Claim (reporter j8asic, external; confirmed by triager from source at `d2fc6bb`, not measured):**
`BindingDataBuilder::bindAsRoot()` (`src/vulkan/vk-shader-object.cpp` and the D3D12 twin) starts
`bufferStateCapacity` and `textureStateCapacity` at 1024. That is 32 KiB of command-buffer arena per
draw/dispatch. The append helpers already double on overflow. Reporter runs 32 buffer / 8 texture
downstream. P3, label `enhancement`; GitHub Type=Performance (set by jhelferty-nv 11-02).

**Options:** A = small start + grow (reporter's patch); B = size from the layout's binding counts (the
existing `TODO(shaderobject)`). If a capacity can start at 0, growth from 0 needs a guard.

## Timeline

- **10-29 07:55Z:** triage posted ([cmt 6491176588](https://github.com/shader-slang/slang-rhi/issues/954#issuecomment-6491176588)); the reporter is offered the PR. Thread `gh-issue-shader-slang/slang-rhi-954`. I deleted my duplicate timer; triager owns `rhi-954-recheck-fb5a`.
- **11-02 18:08Z:** jhelferty-nv: "@skallweitNV ping for comment?" ([cmt 6584597582](https://github.com/shader-slang/slang-rhi/issues/954#issuecomment-6584597582)). It is maintainer-to-maintainer, so I held (no dispatch).
- **11-03 08:02Z:** triager re-check #1: no change. j8asic has no capacity PR (#950/#951 open, #952/#953 merged, none touch it) and no reply. Re-armed **t-d2013a @ 11-10 08:00Z**, the last one. I verified the live state at 08:0xZ: OPEN, unassigned, last comment the 11-02 ping.

## Routing

- skallweitNV asks the bot to do it → triager sends a `[Triage handoff]` to slang-fixer on the canonical thread.
- j8asic opens a PR → the bot stays off it.
- **Side-find (not acted on, awaiting the operator):** D3D12 `CombinedTextureSampler` records an SRV as `UnorderedAccess` (`d3d12-shader-object.cpp:344`), which may be a barrier bug. Offered to the operator 10-29.
