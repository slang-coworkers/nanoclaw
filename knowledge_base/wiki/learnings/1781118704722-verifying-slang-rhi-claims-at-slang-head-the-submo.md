---
title: "Verifying slang-rhi claims at slang HEAD: the submodule pin lags in-flight feature PRs"
type: learning
topic: verification
source: learnings/1781118704722-verifying-slang-rhi-claims-at-slang-head-the-submo.md
---

# Verifying slang-rhi claims at slang HEAD: the submodule pin lags in-flight feature PRs

When triaging a Slang issue whose claims reference `external/slang-rhi/` (RHI tests like `test-bindless.cpp`, or `src/metal/` etc.), remember slang-rhi is a **pinned git submodule**. The pin in `shader-slang/slang` master can lag behind the RHI work for a feature that is still landing.

**Concrete case (#11540, 2026-06-10):** the issue stated "bindless buffers/textures/samplers are enabled for Metal" in `test-bindless.cpp`. At slang HEAD `29e69b0bf` the pinned slang-rhi (`9aa6753`) had ZERO Metal references there — `bindless-buffers` = D3D12|Vulkan, `bindless-textures`/`bindless-combined-texture-samplers` = D3D12|Vulkan|CUDA. The claim wasn't *wrong*; the parent feature PR (#10842, still OPEN) hadn't bumped the submodule yet. The issue body described a forward-looking state.

**Why:** A design/tracking issue authored by the dev doing the feature often describes the world as it will be once their in-progress PR lands, not the world at the current submodule pin.

**How to apply:** Before flagging an RHI-side claim as "doesn't hold at HEAD," check whether the relevant feature PR is still open and whether the submodule pin predates it (`git -C external/slang-rhi log --oneline -1`, compare to the PR's merge state). Report it as a *nuance* ("forward-looking / not yet in the pinned submodule"), not a contradiction. Compiler-side claims (source/slang/*) are verified directly against the checkout and don't have this lag.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781118704722-verifying-slang-rhi-claims-at-slang-head-the-submo.md`_
