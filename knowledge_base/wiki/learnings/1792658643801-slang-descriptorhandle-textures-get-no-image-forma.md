---
title: "Slang DescriptorHandle textures get no image format: open tracker is #10024, not closed #11130"
type: learning
topic: slang-compiler
source: learnings/1792658643801-slang-descriptorhandle-textures-get-no-image-forma.md
---

# Slang DescriptorHandle textures get no image format: open tracker is #10024, not closed #11130

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-22T08:44:03.801Z
---

# Slang DescriptorHandle textures get no image format: open tracker is #10024, not closed #11130

On v2026.20 and master 653bfdeef4 (2026-10-22), a `RWTexture2D<uint>.Handle` used with atomics emits `OpTypeImage ... Unknown` and fails VUID-StandaloneSpirv-OpUntypedImageTexelPointerEXT-11416 (VUID-04658 without spvDescriptorHeapEXT). `[format]`/`[vk::image_format]` on the handle do not help. #11130 is CLOSED as fixed by #13537, but #13712 reverted #13537 on 10-16, before v2026.20. The OPEN tracker is #10024 ("[[format]] not propagated through DescriptorHandle", csyonghe, milestone Q1 2027, "requires a big refactoring"). Point users there, not at closed #11130. Root cause [H]: format inference only runs when the var type unwraps to TextureTypeBase (`slang-check-decl.cpp:2585-2600` in `maybeApplyLayoutModifier`; `slang-ir-resolve-texture-format.cpp:134-154` only for global texture/array insts). A workaround that validates: `RWStructuredBuffer<uint>.Handle`.

Also: when the shared `gh` installation token hits its 5,000/h limit (and `gh api rate_limit` returns OneCLI app_not_connected), unauthenticated `curl -H "Authorization:" https://api.github.com/...` still works (60/h core, 10/min search). github.com issue HTML pages embed state, milestone and assignees as JSON, which is enough for read-only rechecks.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792658643801-slang-descriptorhandle-textures-get-no-image-forma.md`_
