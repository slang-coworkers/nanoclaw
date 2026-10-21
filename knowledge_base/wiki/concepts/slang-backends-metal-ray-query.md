---
title: "Metal ray query: RAY_FLAG → intersection_params mapping, header-only getters, curve and multi-level tags, and CI test lanes"
type: concept
group: slang-backends
tags: [metal, msl, ray-query, rayquery, intersection-params, intersection-query, intersector, curves, curve-data, primitive-data, assume-geometry-type, acceleration-structure, lss, metallib, macos-ci, slang]
source_count: 7
---

# Metal ray query: RAY_FLAG → intersection_params mapping, header-only getters, curve and multi-level tags, and CI test lanes

## TL;DR

- **Metal RayQuery flags map through inline `__requirePrelude` helpers in `hlsl.meta.slang` (`RayQuery::__reset`), not a prelude file.** Their only caller is TraceRayInline's `case metal:`; edits need the core-module rebuild sequence.
- **0x04 `ACCEPT_FIRST_HIT_AND_END_SEARCH` is `intersection_params::accept_any_intersection(true)`**, with the same semantics as DXR and Vulkan TerminateOnFirstHit. SPIRV-Cross `spvMakeIntersectionParams` is the prior art for any Metal flag mapping. Flag 0x400 (opacity micromaps) has no Metal equivalent.
- **The `intersection_params` getters (`get_*`, and `should_*` for bools) exist only in Apple's `<metal_raytracing>` header, not the spec.** Read the header without a Mac through raw.githubusercontent.com on dortania/PatcherSupportPkg.
- **Metal runtime ray-query lanes are `ignored` on macOS CI.** Only a `-target metallib` SIMPLE lane proves the MSL compiles with Apple's compiler.
- **Inline `RayQuery` on Metal is always `intersection_query<triangle_data, instancing>`.** Draft #12691 adds `intersector<>` only for the structural trace; its flag-setter sequence and `_emitMetalRayTracingTagList` are reusable later.
- **Curves need more than the `curve_data` tag:** the query must call `assume_geometry_type(... | geometry_type::curve)`, and candidates commit with `commit_curve_intersection()`.
- **`acceleration_structure` carries only `instancing`/`primitive_motion`/`instance_motion`.** Curve or multi-level queries, and `intersector<curve_data, instancing>`, leave its parameter type as `acceleration_structure<instancing>`; only motion changes it. Tags need only match between related uses, in no canonical order.
- **`get_*_primitive_data()` needs no intersection tag** (Metal 3; triangle, bounding-box and curve hits); `curve_parameter` is gated on `curve_data`.
- **Metal has no LSS control-point or radius fetch**, so NV `*LssObjectPositionsAndRadiiNV` accessors cannot map to it.

Slang lowers inline `RayQuery` on Metal to `metal::raytracing::intersection_query`. The flag translation lives in core-module helper strings rather than in the emitter, the spec documents less of the Metal API than Apple's header ships, and CI gives no runtime signal for Metal ray queries. This page was split out of [Metal backend](slang-backends-f0909b0-metal.md); OptiX and the structural ray-tracing pipeline are on [OptiX ray tracing](slang-backends-optix-raytracing.md).

## RayQuery ray flags → `raytracing::intersection_params` (#13408)

Metal translates `RAY_FLAG` bits into an `intersection_params` value in
`_slang_ray_flags_to_intersection_params`. That helper is not in a prelude file. It is a
`__requirePrelude(R"(...)")` string inside `RayQuery::__reset` in `source/slang/hlsl.meta.slang`
(~:21884 @92258f61b), and its only caller is TraceRayInline's `case metal:`, which passes
`rayFlags | rayFlagsGeneric`, so the template flags on `RayQuery<...>` take the same path.
`RayFlags()` uses the inverse helper `_slang_intersection_params_to_ray_flags` (~:22885). Since
#9926 both helpers have lacked 0x04 `ACCEPT_FIRST_HIT_AND_END_SEARCH`; Copilot and CodeRabbit
flagged it on that PR and nobody replied. The MSL call is `params.accept_any_intersection(true)`,
which is what SPIRV-Cross `spvMakeIntersectionParams` (spirv_msl.cpp) emits for
TerminateOnFirstHit, so SPIRV-Cross's MSL helpers are the prior art for auditing any Metal flag
mapping. Edits need the core-module rebuild sequence, and a `-target metal` FileCheck on the helper
body verifies them GPU-free
[Metal RayQuery ray flags are mapped by inline __requirePrelude helpers](../learnings/1790964538262-metal-rayquery-ray-flags-are-mapped-by-inline-requ.md).

The semantics match. The MSL 4.1 spec (2026-06-04) intersection-function return table says "Even if
true is returned, a committed hit will immediately halt searching if accept_any_intersection() is
true." That is DXR `RAY_FLAG_ACCEPT_FIRST_HIT_AND_END_SEARCH` and Vulkan TerminateOnFirstHit:
search stops on the first committed hit, and non-opaque or procedural candidates still reach user
code first. The spec has no opacity-micromap feature, so flag 0x400 has no Metal equivalent
[MSL spec 4.1: accept_any_intersection halts on first committed hit](../learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md).

## Getters: header-only, and how to read the header and spec without a Mac

The round trip in `RayFlags()` needs getters, and the spec does not document any. The spec (§6.19.3,
Table 6.32) lists only setters (`force_opacity`, `set_*_cull_mode`, `accept_any_intersection(bool)`)
plus `intersection_query::get_intersection_params()`. Apple's shipped `<metal_raytracing>` header
has the getters anyway: `get_forced_opacity()`, `get_triangle_cull_mode()`,
`get_geometry_cull_mode()`, `get_opacity_cull_mode()`, `get_geometry_type()`, and, for the bools,
`should_accept_any_intersection()` and `should_assume_identity_transforms()`.
`get_intersection_params()` fills them from the live query, so the round trip reads real state. A
search for `get_accept_any_intersection` finds nothing, which is how CodeRabbit on #9926 wrongly
concluded there was no getter. Header copies are readable without a Mac via raw.githubusercontent.com
on dortania/PatcherSupportPkg (`Universal-Binaries/<macOS>/System/Library/PrivateFrameworks/GPUCompiler.framework/Versions/<N>/Libraries/lib/clang/<ver>/include/metal/metal_raytracing`,
GPUCompiler 31001/32023 trees at commit 94354f9de4f). The gh API tree endpoint returns 401 through
the proxy, but raw URLs work
[intersection_params getters exist only in Apple's header](../learnings/1790969961307-metal-intersection-params-getters-exist-only-in-ap.md),
[Metal runtime ray-query test lanes are ignored on macOS CI](../learnings/1790972350334-metal-runtime-ray-query-test-lanes-are-ignored-on-.md).
The spec PDF is over 10 MB, so WebFetch fails on it. To search it without pdftotext or pypdf,
download it with curl, zlib-decompress each `stream…endstream` block in Python, and join the
`(...)` Tj strings
[MSL spec 4.1: accept_any_intersection halts on first committed hit](../learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md).

## Testing: only the metallib lane gives signal

Test with a `-target metallib` SIMPLE lane. A Metal runtime ray-query lane gives no CI signal:
`//TEST(compute, metal):COMPARE_COMPUTE_EX … -metal … -render-feature ray-query` lanes are reported
as `ignored test: … (mtl)` on test-macos-release-clang-aarch64 (merge_group run 37043131359,
2026-10-02; e.g. tests/metal/ray-query-intrinsics.slang.2, the only enabled mtl lane ignored in
tests/metal while 29 others pass). Only the metallib lane proves the MSL compiles with Apple's
compiler, so do not accept "the macOS Metal runtime lane is the hardware check" in a PR claim.
Vulkan ray-query lanes do run on test-windows-*-gpu-vk
[Metal runtime ray-query test lanes are ignored on macOS CI](../learnings/1790972350334-metal-runtime-ray-query-test-lanes-are-ignored-on-.md).

## Inline `RayQuery` vs the structural pipeline (#12691)

Inline `RayQuery` and the structural ray-tracing API use different Metal objects. On master e49310561, `kIROp_RayQueryType` hardcodes `intersection_query<triangle_data, instancing>`, and no `intersector`/`intersection_result` string exists in source/, prelude/ or tests/. Draft PR #12691 (head 4066784056) emits `metal::raytracing::intersector<>` plus `intersection_result` only for `IRMetalStructuralRayTracingTrace` (slang-emit-metal.cpp:527-635 at that head), with no hunks for TraceRayInline, Proceed or Committed*. Its flags-to-setter sequence (0x04 → `accept_any_intersection`) and `_emitMetalRayTracingTagList` helper are reusable for a future inline-intersector lowering. Apple's "reuse the query object" advice works today: one `RayQuery<RAY_FLAG_NONE>` re-traced with runtime flags emits a single `intersection_query` with several `reset()` calls. With 348 files, `gh pr diff` fails; page through `gh api repos/.../pulls/12691/files?page=N` [#12691 adds Metal intersector<> only for the structural trace](../learnings/1792136833198-12691-adds-metal-intersector-only-for-the-structur.md).

## Curves and multi-level queries: what `intersection_query` tags can and cannot express (#13688)

Consider a user who adds curve geometry to an inline ray query. Adding the `curve_data` tag to `intersection_query<...>` is not enough. Metal assumes an acceleration structure contains no curve geometry until the query calls `assume_geometry_type(... | geometry_type::curve)` (MSL 4.1 §6.19.3, p.334), and curve candidates are committed with `commit_curve_intersection()`. Slang's `_slang_ray_flags_to_intersection_params` (`hlsl.meta.slang` ~:22654) sets only opacity and cull modes today, so a curve lowering must also emit the geometry-type call.

The tags do not travel to the acceleration structure. `acceleration_structure` takes only `instancing`, `primitive_motion` and `instance_motion` (§2.17.7); `max_levels`, `triangle_data` and `curve_data` cannot appear on it (Table 2.9), and it only has to match the instancing/motion tag order of the other types (§2.17.1). A curve or multi-level query therefore leaves the `acceleration_structure<instancing>` parameter type unchanged; only motion would change it. `intersection_query` exposes only `get_*_curve_parameter()`, with no control-point or radius fetch, so NV LSS accessors such as `*LssObjectPositionsAndRadiiNV` have no Metal mapping. Draft #12691's `_emitMetalRayTracingTagList` covers intersectors, intersection function tables and acceleration structures only; its PROPOSAL.md:767 excludes ray queries. When pdftotext is missing, `pip install --target <tmp> pypdf` extracts the spec, and its printed page numbers match the PDF page index ([Metal intersection_query curves need assume_geometry_type](../learnings/1792138014602-metal-intersection-query-curves-need-assume-geomet.md)).

The same rule holds for the structural `intersector`. A later spec reading for a #13688 addendum (MSL 4.1, not compiled, no Mac) found:

- `intersector<curve_data, instancing>::intersect(ray, as, mask)` takes `instance_acceleration_structure`, which is an alias of `acceleration_structure<instancing>` (§6.19.2 p.322, "available only if intersection_tags has instancing"; §2.17.7 p.71). Under §2.17.1 p.62 an acceleration structure only has to match the instancing/motion tag order, and `curve_data`, `triangle_data` and `max_levels` are never acceleration-structure tags. Table 6.29 p.321 loosely writes `acceleration_structure<intersection_tags...>`, but §2.17.1 governs. Tags have no canonical order; they only have to match between related uses (intersector, `intersection_result`, function table and query).
- `get_candidate_primitive_data()` / `get_committed_primitive_data()` return `const device void*`, require Metal 3, work for triangle, bounding-box and curve hits (Tables 6.33/6.34), and need no intersection tag. The spec does not say the pointer is null when the geometry has no primitive data.
- `intersection_result::curve_parameter` is gated on `curve_data`; `distance` is not. The spec never maps curve control-point counts to bases ("2, 3, or 4, depending on the curve basis").
- In Slang, an `extension RayQuery` method with `__intrinsic_asm "...($0)->get_committed_primitive_data()"` works on Metal. It relies on `$0` being emitted as the query's address (`&q_0` for a local, `thread*` for a parameter), which is an emit detail, not a contract.

([Metal intersector<curve_data, instancing> accepts acceleration_structure<instancing>; primitive_data needs no tag](../learnings/1792502356233-metal-intersector-curve-data-instancing-accepts-ac.md)).

**Source learnings (7):**
- [Metal RayQuery ray flags are mapped by inline __requirePrelude helpers in hlsl.meta.slang (no 0x04 before #13408)](../learnings/1790964538262-metal-rayquery-ray-flags-are-mapped-by-inline-requ.md) — helper lives in `RayQuery::__reset`; 0x04 → `accept_any_intersection(true)`; SPIRV-Cross is prior art.
- [MSL spec 4.1: accept_any_intersection halts on first COMMITTED hit; getters are header-only](../learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md) — matches DXR/Vulkan terminate-on-first-hit; no OMM (0x400); how to grep the >10 MB PDF.
- [Metal intersection_params getters exist only in Apple's header; bool getters are named should_*](../learnings/1790969961307-metal-intersection-params-getters-exist-only-in-ap.md) — read the header via dortania raw URLs; add metallib + runtime lanes.
- [Metal runtime ray-query test lanes are ignored on macOS CI](../learnings/1790972350334-metal-runtime-ray-query-test-lanes-are-ignored-on-.md) — only `-target metallib` SIMPLE lanes give Apple-compiler signal.
- [#12691 adds Metal intersector<> only for the structural pipeline trace; inline RayQuery stays intersection_query](../learnings/1792136833198-12691-adds-metal-intersector-only-for-the-structur.md) — reusable flag setters; one RayQuery with multiple `reset()`s
- [Metal intersection_query curves need assume_geometry_type; acceleration_structure tags don't carry curve_data/max_levels](../learnings/1792138014602-metal-intersection-query-curves-need-assume-geomet.md) — MSL 4.1 §6.19.3/§2.17; no LSS fetch; #12691 excludes ray queries (#13688)
- [Metal intersector<curve_data, instancing> accepts acceleration_structure<instancing>; primitive_data needs no tag](../learnings/1792502356233-metal-intersector-curve-data-instancing-accepts-ac.md) — MSL 4.1 §6.19.2/§2.17.1 (Table 6.29 is loose); `get_*_primitive_data` Metal 3; `$0` is the query address in `__intrinsic_asm` (#13688)

_Catalog: [[wiki/index.md]]_
