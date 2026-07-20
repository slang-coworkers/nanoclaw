---
name: project-12145-gbufferrttexgrads-d3d12-access-violation
metadata: 
  node_type: memory
  type: project
  originSessionId: ac18452e-8cea-41c3-ae5f-95cac66b7141
---

# #12145 — GBufferRTTexGrads_d3d12 access-violation CI flake (ANCHOR)

Durable CI-infra flake anchor, bot-authored by nv-slang-bot[bot] (Infra, CI
Stability), opened 2026-07-17. Same class as [[project-12137-aarch64-apt-fetch-ci-flake]].

**Signature:** `renderpasses/test_GBufferRTTexGrads_d3d12` FAILED — `Mogwai.exe`
exits **3221225477 = 0xC0000005 (STATUS_ACCESS_VIOLATION)**. D3D12 only, single
renderpass; all other ~100 Falcor tests pass on D3D12+Vulkan same run.

**Discriminator (critical):** in every occurrence `ActivationFunction_HSigmoid`
**passes** on both D3D12 and Vulkan → this is NOT the known HSigmoid fp16
numeric-tolerance red (0.0025 tol, Falcor-CI-maintainer-owned, non-actionable).
This is a genuine process crash in Mogwai on GBufferRTTexGrads specifically.

**Cost:** dominant Falcor merge-queue evictor 07-15→07-17 — 8 evictions/head-reds
across 8 unrelated PRs (#12009, #12052, #11979, #12126, #12064, #12055, #12105,
#12144). Run IDs in issue body. Crash is PR-code-independent (docs, generics,
reflection, autodiff, Metal, mimalloc all hit it) → confirmed test/infra flake.

**Ask:** maintainer fix-or-quarantine the GBufferRTTexGrads renderpass.

**Routing:** forwarded to `slang-ci-babysitter` (owns CI-flake anchors) to
register #12145 as canonical anchor for this signature — use for future
flake-vs-real classification and safe requeues. Bot-authored + maintainer-directed
→ Main did NOT post a GitHub ack (bot-to-bot noise); babysitter owns the GH surface.
Thread: `gh-issue-shader-slang/slang-12145`.
