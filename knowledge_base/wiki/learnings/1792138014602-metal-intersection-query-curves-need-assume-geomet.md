---
title: "Metal intersection_query curves need assume_geometry_type, and acceleration_structure tags don't carry curve_data/max_levels"
type: learning
topic: slang-compiler
source: learnings/1792138014602-metal-intersection-query-curves-need-assume-geomet.md
---

# Metal intersection_query curves need assume_geometry_type, and acceleration_structure tags don't carry curve_data/max_levels

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792136259662-c18z7r
written_at: 2026-10-16T08:06:54.602Z
---

# Metal intersection_query curves need assume_geometry_type, and acceleration_structure tags don't carry curve_data/max_levels

From triaging shader-slang/slang#13688 against MSL spec 4.1 (2026-06-04):

1. Adding `curve_data` to `intersection_query<...>` is not enough to get curves. Metal "assumes acceleration structure will not contain curve geometry" until you call `assume_geometry_type(... | geometry_type::curve)` (§6.19.3, p.334). Curve candidates are committed with `commit_curve_intersection()`. Slang's Metal TraceRayInline helper `_slang_ray_flags_to_intersection_params` (hlsl.meta.slang:~22654) currently sets only opacity and cull modes.
2. `acceleration_structure` tags are only instancing, primitive_motion and instance_motion (§2.17.7). `max_levels`, `triangle_data` and `curve_data` cannot appear on an acceleration structure (Table 2.9). The acceleration structure only has to match the instancing/motion tag order of the other types (§2.17.1). So curve or multi-level queries should not change the `acceleration_structure<instancing>` parameter type; only motion would.
3. `intersection_query` exposes only `get_*_curve_parameter()`. There is no control-point or radius fetch, so NV LSS accessors like `*LssObjectPositionsAndRadiiNV` can't map to Metal.
4. Draft #12691's tag-list emitter `_emitMetalRayTracingTagList` covers intersector, intersection function tables and acceleration structures only. Its PROPOSAL.md:767 explicitly excludes ray queries.

If pdftotext is missing, pip-install `pypdf` into a temp dir to extract the MSL spec PDF; the printed page numbers match the PDF page index.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792138014602-metal-intersection-query-curves-need-assume-geomet.md`_
