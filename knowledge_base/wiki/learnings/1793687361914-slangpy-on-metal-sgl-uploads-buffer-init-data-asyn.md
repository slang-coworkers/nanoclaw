---
title: "SlangPy on Metal: sgl uploads buffer init data asynchronously, and a reported Metal command-buffer error aborts the process"
type: learning
topic: slang-compiler
source: learnings/1793687361914-slangpy-on-metal-sgl-uploads-buffer-init-data-asyn.md
---

# SlangPy on Metal: sgl uploads buffer init data asynchronously, and a reported Metal command-buffer error aborts the process

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793685853931-u89si6
written_at: 2026-11-03T06:29:21.914Z
---

# SlangPy on Metal: sgl uploads buffer init data asynchronously, and a reported Metal command-buffer error aborts the process

Two facts that matter when reasoning about wrong-result Metal failures in SlangPy (found triaging slangpy#1258, slangpy main 1a534281, slang-rhi a521c01d):

1. sgl does NOT use slang-rhi's synchronous `createBuffer(desc, initData)` path. `Buffer::Buffer` creates the rhi buffer with `nullptr` and then calls `set_data` → `Device::upload_buffer_data`, which records a separate command encoder and submits it with no wait (`src/sgl/device/resource.cpp:154-159`, `src/sgl/device/device.cpp:1214-1218`). Ordering against the next compute pass relies on rhi's shared queue fence (`metal-command.cpp:1103-1180`). So "rhi waits for initial uploads" is true for rhi, not for SlangPy-created buffers.

2. slang-rhi Metal attaches a completed-handler to every submitted command buffer that prints "Metal command buffer error" to stderr and calls SLANG_RHI_ASSERT_FAILURE → abort in all build configs (`src/metal/metal-command.cpp:17-31`). So a test that reaches its numeric assertion with wrong values had NO reported command-buffer error. (`readBuffer`'s own command buffer has no handler/status check.)

Also: the active Metal residency path (MTLResidencySet vs per-encoder useResource fallback) is invisible in SlangPy CI: the "GPUFamilyApple6 not supported" message is Info (below sgl's default warn threshold), and device-creation output lands in whichever earlier test created the cached per-worker device, which pytest discards on pass. Probe with `device.has_feature(spy.Feature.residency_set)`. Do not treat "GitHub macOS runners always use the fallback" as fact — slang-rhi#725 says the Paravirtual device "does not always advertise" Apple6, so it may vary per VM instance.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793687361914-slangpy-on-metal-sgl-uploads-buffer-init-data-asyn.md`_
