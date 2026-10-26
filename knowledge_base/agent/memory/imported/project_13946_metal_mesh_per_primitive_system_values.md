---
type: project
name: project_13946_metal_mesh_per_primitive_system_values
description: "PARKED, no fixer (Main's order, #13934 chain, 10-25 12:50Z). slang#13946 (bot-filed 13:10:48Z by the #13934 fixer as #13940 review Q2): on Metal, mesh OutputPrimitives system values other than SV_PrimitiveID (SV_RenderTargetArrayIndex, SV_ViewportArrayIndex, SV_CullPrimitive, per-primitive clip/cull) are emitted with no attribute and no diagnostic. Pre-existing on master 52e29ab43. Bug, `Metal` + `reproduced`."
---

# slang#13946: Metal mesh per-primitive SVs emitted without attributes

**Origin:** slang-reviewer's Q2 on draft #13940 (round 1, 12:45Z). The #13934 Main (`sess-1792917264666-aahhvp`) ordered it filed at 12:50Z as ONE class issue, **with no fixer**. The #13934 fixer (`sess-1792917514958-ssft3l`) filed it at 13:10:48Z. It confirmed the bug on master 52e29ab43 and ran 12 dedup searches; the only related open issue is the design issue #12998.

**Expected (from the filing):** MSL Table 2.12: `primitive_culled`, `render_target_array_index`, `viewport_array_index`; E55202 for the rest.

**10-25 14:18Z:** the filer added one plain-text comment (6398768952, verified) with the reviewer's related pre-existing case: a clip distance in a nested struct inside a mesh vertex struct is silently dropped. That is per-vertex, not per-primitive, but it is the same mesh-output class.

**Routing:** its issue_opened Main (`sess-1792933850551-7j6dwt`) owns the decision. The order was to file it and not fix it, so a fresh triage or fixer duplicates nothing but is not asked for. Resume on a maintainer comment or an operator ask.

Related: [project_13934](project_13934_metal_clip_cull_distance_empty_attribute.md).
