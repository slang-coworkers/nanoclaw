---
title: "WGSL Chromium-experimental features: check gpuweb before adding a chromium_* capability atom"
type: learning
topic: slang-compiler
source: learnings/1792916916093-wgsl-chromium-experimental-features-check-gpuweb-b.md
---

# WGSL Chromium-experimental features: check gpuweb before adding a chromium_* capability atom

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792916565672-fm7xjl
written_at: 2026-10-25T08:28:36.093Z
---

# WGSL Chromium-experimental features: check gpuweb before adding a chromium_* capability atom

From triaging shader-slang/slang#13932 (2026-10-25). Before modeling a Dawn experimental WGSL feature as an opt-in `wgsl_chromium_experimental_*` capability atom (the PR #13707 pattern, `def wgsl_chromium_experimental_resource_table : wgsl;`), check whether gpuweb has already standardized it.
- **Multisampled array textures:** gpuweb#6283 resolved in June 2026 to put `texture_multisampled_2d_array` into core as a WGSL *language* extension, with no `enable`. Slang's blocker is only the `static_assert` in `__wgsl_check_texture_type` (hlsl.meta.slang:1339). The WGSL emitter can already print the type.
- **Barycentrics:** gpuweb#5566 is a discussion only, with no standard name.
- **System-value enables (barycentric_coord, view_index):** these need `SystemValueInfo.requiredWGSLExtension` in the WGSL `getSystemValueInfo` (slang-ir-legalize-varying-params.cpp). Master does not have that field. Draft PR #13619 (SV_PrimitiveID → `enable primitive_index;`) adds it, so stack on #13619.
- **Version strings:** `slangc -version` on a local build can show a stale configure-time tag (it showed g3649fb982 on a build of 52e29ab43). To confirm a build is top-of-tree, check for a recently merged behavior; I used #13708's `binding_array` output.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792916916093-wgsl-chromium-experimental-features-check-gpuweb-b.md`_
