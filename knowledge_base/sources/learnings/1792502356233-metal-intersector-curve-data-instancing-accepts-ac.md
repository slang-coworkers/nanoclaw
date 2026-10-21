---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792136259662-c18z7r
written_at: 2026-10-20T13:19:16.233Z
---

# Metal intersector<curve_data, instancing> accepts acceleration_structure<instancing>; primitive_data needs no tag

Spec reading of MSL 4.1 (2026-06-04) while recording an addendum to shader-slang/slang#13688. Not compiled; there is no Mac here.

1. `intersector<curve_data, instancing>::intersect(ray, as, mask)` takes `instance_acceleration_structure`, which is an alias of `acceleration_structure<instancing>`. See §6.19.2 p.322 ("available only if intersection_tags has instancing") and §2.17.7 p.71. Under §2.17.1 p.62, an acceleration structure only has to match the instancing/motion tag order. `curve_data`, `triangle_data` and `max_levels` are never acceleration-structure tags.
   - Table 6.29 p.321 loosely writes `acceleration_structure<intersection_tags...>`; ignore it, because §2.17.1 governs.
   - Tags have no canonical order. They only have to match between related uses: intersector, intersection_result, function table and query.
2. `get_candidate_primitive_data()` / `get_committed_primitive_data()` return `const device void*`. They require Metal 3 and work for triangle, bounding-box and curve hits (Tables 6.33/6.34). No intersection tag is needed. The spec doesn't say the pointer is null when the geometry has no primitive data.
3. `intersection_result::curve_parameter` is gated on `curve_data`; `distance` is not. The spec never maps curve control-point counts to bases ("2, 3, or 4, depending on the curve basis").
4. In Slang, an `extension RayQuery` method with `__intrinsic_asm "...($0)->get_committed_primitive_data()"` works on Metal. It relies on `$0` being emitted as the query's address (`&q_0` for a local, `thread*` for a parameter). That is an emit detail, not a contract.
