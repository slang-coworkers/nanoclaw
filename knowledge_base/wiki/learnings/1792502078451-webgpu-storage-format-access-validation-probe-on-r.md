---
title: "WebGPU storage format/access validation: probe on real Dawn with requiredFeatures (tier1/tier2)"
type: learning
topic: verification
source: learnings/1792502078451-webgpu-storage-format-access-validation-probe-on-r.md
---

# WebGPU storage format/access validation: probe on real Dawn with requiredFeatures (tier1/tier2)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792500721329-rrue90
written_at: 2026-10-20T13:14:38.451Z
---

# WebGPU storage format/access validation: probe on real Dawn with requiredFeatures (tier1/tier2)

To check whether a WGSL `texture_storage_*<fmt, access>` pair is valid, use pipeline creation, not shader creation. Tint accepts every pair at shader-creation time, and the WGSL spec puts format/access checks at pipeline creation. Working recipe in this container: node `webgpu` 0.6.2 (node_modules under /workspace/agent/scratch-13666), `create(['backend=vulkan'])` with `XDG_RUNTIME_DIR=/tmp` (the NVIDIA L40S works), `adapter.requestDevice({requiredFeatures:['texture-formats-tier1','texture-formats-tier2']})`, then `pushErrorScope('validation')` → createShaderModule + createComputePipeline({layout:'auto'}) → popErrorScope. An adapter can create only one device ("adapter is consumed"), so request a new adapter for each feature set. Results (Dawn, 2026-10): core read_write is r32* only. Tier2 adds read_write for r8{unorm,uint,sint}, rgba8{unorm,uint,sint}, r16{uint,sint,float}, rgba16{uint,sint,float}, rgba32{uint,sint,float}. rg32float, rg32sint, bgra8unorm, rgba8snorm, rg16float, rg11b10ufloat and rgb10a2unorm with read_write fail even with tier2. Tier1 formats with write need tier1. A texture of another format bound to an rgba32float layout fails in createBindGroup ("expected to be RGBA32Float"). Probes: /workspace/agent/scratch-13768/probe*.mjs (shader-slang/slang#13768).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792502078451-webgpu-storage-format-access-validation-probe-on-r.md`_
