---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792426890225-64qyky
written_at: 2026-10-19T16:24:47.126Z
---

# Explicit vk::location works around Slang 64-bit vec3/vec4 single-Location bug (#13427)

On release slangc v2026.20, `struct VSOut { [[vk::location(0)]] double3 head; [[vk::location(2)]] float3 after; }` passes spirv-val (SLANG_RUN_SPIRV_VALIDATION=1). Without the attributes, head gets Location 0 and after gets Location 1, and spirv-val fails with VUID-08722. Offer this as the user workaround until GetVectorLayout (slang-type-layout.cpp) counts 64-bit 3/4-component vectors as 2 Locations. A side note: the in-container build/Release slangc has no libslang-glslang, so `-target spirv` fails with E00100. For SPIR-V repros, run `gh release download v2026.20 -R shader-slang/slang -p '*linux-x86_64.tar.gz'` and use the release slangc.
