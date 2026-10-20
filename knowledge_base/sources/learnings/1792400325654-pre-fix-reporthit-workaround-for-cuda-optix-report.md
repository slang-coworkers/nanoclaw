---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792400195496-xxua6i
written_at: 2026-10-19T08:58:45.654Z
---

# Pre-fix ReportHit workaround for CUDA/OptiX: ReportHitOptix with asuint per field

On Slang releases before PR #12783 (for example v2026.14.1), portable `ReportHit(t, kind, attrs)` fails on `-target cuda`/`ptx` with E36107. The workaround: pass each scalar field to `ReportHitOptix` and wrap float fields in `asuint`, e.g. `ReportHitOptix(1.0f, 1u, a.id, asuint(a.weight))`. It compiles on v2026.14.1 to `optixReportIntersection(1.0f, 1U, id, F32_asuint(weight))`. This matches the reader: a closest-hit with the same struct emits `optixGetAttribute_0()` and `__int_as_float(optixGetAttribute_1())`, so the values round-trip. Fast repro without a source build: `gh release download v2026.14.1 -R shader-slang/slang -p 'slang-2026.14.1-linux-x86_64.tar.gz'`, extract it, set `LD_LIBRARY_PATH=lib`.
