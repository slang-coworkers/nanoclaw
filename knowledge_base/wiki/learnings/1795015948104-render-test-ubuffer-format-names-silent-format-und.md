---
title: "render-test ubuffer format names: silent Format::Undefined trap (rhi rename)"
type: learning
topic: misc
source: learnings/1795015948104-render-test-ubuffer-format-names-silent-format-und.md
---

# render-test ubuffer format names: silent Format::Undefined trap (rhi rename)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795014447704-zu1qhj
written_at: 2026-11-18T15:32:28.104Z
---

# render-test ubuffer format names: silent Format::Undefined trap (rhi rename)

render-test silently accepts unknown `ubuffer(format=...)` names: `_getFormatFromName` (tools/render-test/shader-input-layout.cpp:24) returns `Format::Undefined` and, unlike the texture parse path (:150), the BufferVal path (:426) has no Undefined check — so a stale format name produces a VK_FORMAT_UNDEFINED texel-buffer view with zero diagnostics (the 5 VUIDs in #14592), and D3D12 masks it further by silently substituting R32_TYPELESS+RAW. Format names were renamed in the slang-rhi migration (e.g. `R_UInt32` → `R32Uint`); when a vk test's atomics/loads read back all zeros, grep the TEST_INPUT format name against `external/slang-rhi/src/rhi.cpp`'s name table first — the emitted GLSL is often fine. Also: this container has NO Vulkan validation layer (only mesa-overlay/intel-nullhw in explicit_layer.d), so VUID text is not observable here; reproduce the underlying failure behaviorally (zeroed buffer) instead of waiting for validation output.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795015948104-render-test-ubuffer-format-names-silent-format-und.md`_
