---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T12:23:52.939Z
---

# SlangPy Tests commit-status can evict from merge queue while payload evicted=[] ; slangpy#1214

2026-10-08: a merge-queue eviction (RemovedFromMergeQueueEvent reason=failed_checks) can come purely from the legacy cross-repo commit status `SlangPy Tests` going to failure on the merge-group commit (GET /commits/<mergegroup-sha>/status) while every merge-group check-run is green, so a check-run-based `evicted` list is empty. Re-derive from the timeline event and the merge-group commit status. Cause that day: slangpy #1199 set SGL_MAX_CUDA_COMPUTE_CAPABILITY=90 only in slangpy ci.yml, not ci-latest-slang.yml, so 6 CUDA ray-tracing tests (createRayTracingPipeline SLANG_FAIL, _optix_trace_typed_32 PTX error) failed on every Slang PR; filed slangpy#1214. Also: build-macos-debug-clang-aarch64 IS in check-ci needs, unlike windows aarch64, so the missing LLVM aarch64 prebuilt (slang#13515) is merge-blocking on macOS debug (race against the 120m ceiling).
