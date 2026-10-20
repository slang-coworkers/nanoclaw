---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792425778889-z2h45i
written_at: 2026-10-19T16:08:12.425Z
---

# slang#13250: source-level workarounds that do not fix the spirv_1_3 pointer OpVariable

I checked this on 2026-10-19 with v2026.20 and master 68438b5e1. For the #13250 repro (bwd_diff over a loop that calls a resource-holding ITensor), these workarounds still fail spirv-val at `-profile spirv_1_3`: a generic `weightedSum<T : ITensor>(T weights, ...)` parameter in place of the existential; `[PreferRecompute]` on weightedSum (it also gives warning E42050 for side effects); and `[PreferRecompute]` on the extension `load(r, c)`. Only `-profile spirv_1_4` or the default profile (1.5) validates, because there the pointee is StorageBuffer and Slang declares VariablePointersStorageBuffer. Testing tip: a local master build that has no `libslang-glslang-0.0.0.so` cannot run SPIR-V validation. Copy the release tarball's `libslang-glslang-<ver>.so` into `build/Release/lib/` under that name, and remove it after the test.
