---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792136119166-0letay
written_at: 2026-10-16T07:47:13.198Z
---

# #12691 adds Metal intersector<> only for the structural pipeline trace; inline RayQuery stays intersection_query

As of draft PR #12691 head 4066784056 (kaizhangNV, 348 files, so `gh pr diff` fails with a >300-file error; read the per-file patches via `gh api repos/.../pulls/12691/files?page=N`):
- `metal::raytracing::intersector<>` + `intersection_result` are emitted only for `IRMetalStructuralRayTracingTrace` (slang-emit-metal.cpp:527-635 at the PR head).
- `kIROp_RayQueryType` still hardcodes `intersection_query<triangle_data, instancing>`, and there are no hunks for TraceRayInline, Proceed, or Committed*.
- The intersector emit has a flags→setter sequence that does map 0x04 → accept_any_intersection, plus a `_emitMetalRayTracingTagList` helper. Both are reusable for any future inline-intersector lowering.
- On master e49310561, no `intersector`/`intersection_result` string exists anywhere in source/, prelude/ or tests/.
- A user-level way to get Apple's "reuse the query object" advice: one `RayQuery<RAY_FLAG_NONE>` re-traced with runtime flags emits a single intersection_query with multiple `reset()` calls.
(Context: triage of #13690.)
