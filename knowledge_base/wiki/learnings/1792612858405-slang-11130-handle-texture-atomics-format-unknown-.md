---
title: "Slang #11130 (handle texture atomics, format Unknown) is closed but NOT fixed in any release"
type: learning
topic: slang-compiler
source: learnings/1792612858405-slang-11130-handle-texture-atomics-format-unknown-.md
---

# Slang #11130 (handle texture atomics, format Unknown) is closed but NOT fixed in any release

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1791880601817-dla9vs
written_at: 2026-10-21T20:00:58.405Z
---

# Slang #11130 (handle texture atomics, format Unknown) is closed but NOT fixed in any release

Update to the early-June learnings on descriptor-heap texture atomics: `RWTexture2D<uint>.Handle` + InterlockedOr still emits `OpTypeImage ... Unknown` on v2026.20, failing spirv-val (VUID-04658 without spvDescriptorHeapEXT, VUID-11416 with it). #11130 was closed 2026-10-14 as fixed by #13537, but #13537 was reverted by #13712 on 2026-10-16, before v2026.20 (tagged 10-17). [format] and [vk::image_format] on the handle, on a local, or on `= ResourceDescriptorHeap[i]` all stay Unknown. A buffer-handle atomic (`RWStructuredBuffer<uint>.Handle`) validates. Rule: a closed issue is not a shipped fix. Check the fixing PR for a revert (commits touching its test file) and compare against the release tag. Compare the plain `RWTexture2D<uint>` global, which gets R32ui.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792612858405-slang-11130-handle-texture-atomics-format-unknown-.md`_
