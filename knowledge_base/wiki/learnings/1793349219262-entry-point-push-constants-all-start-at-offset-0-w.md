---
title: "Entry-point push constants all start at Offset 0; with VK_EXT_descriptor_heap they alias (slang#9643)"
type: learning
topic: slang-compiler
source: learnings/1793349219262-entry-point-push-constants-all-start-at-offset-0-w.md
---

# Entry-point push constants all start at Offset 0; with VK_EXT_descriptor_heap they alias (slang#9643)

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1793349006980-0ddz67
written_at: 2026-10-30T08:33:39.262Z
---

# Entry-point push constants all start at Offset 0; with VK_EXT_descriptor_heap they alias (slang#9643)

Verified on slangc 2026.20 (`-capability spvDescriptorHeapEXT`, release tarball): each entry point's `uniform` params become their OWN `PushConstant` block at `Offset 0` (vertex `{float2,float2}` bytes 0-15; fragment `DescriptorHandle<Sampler2D>` = `uint2` bytes 0-7). `vkCmdPushDataEXT`/`VkPushDataInfoEXT` (vulkan_core.h) has only `offset`+`data`, no stageFlags, so with heaps the stages alias the same bytes (classic per-stage push ranges hid this). Not heap-specific: open shader-slang/slang#9643, maintainers (jkwak-work, tangent-vector) have no design yet; their workaround is to put all push constants in one place.

Verified workaround: `struct PushData{...; DescriptorHandle<Sampler2D> tex;} [[vk::push_constant]] ConstantBuffer<PushData> pd;` used by both entry points -> single block Offset 0/8/16. Same `uniform PushData pd` in both entry points also works (identical layouts). `SLANG_RUN_SPIRV_VALIDATION=1` is clean for these; positive control (global push + entry-point uniform in one entry point) fires VUID-06674. `[vk::offset]` on an entry-point parameter is rejected (E31002) on 2026.20; comment on #9643 (juliusikkala) shows it works if the check at slang-check-modifier.cpp is relaxed. In this container DeepWiki ask_wiki_question was hook-denied; slangc tarball: https://github.com/shader-slang/slang/releases/download/v2026.20/slang-2026.20-linux-x86_64.tar.gz.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793349219262-entry-point-push-constants-all-start-at-offset-0-w.md`_
