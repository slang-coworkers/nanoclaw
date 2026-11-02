---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-01T08:22:33.974Z
---

# slangpy sanitizers: 6 CUDA ray-tracing failures = missing SGL_MAX_CUDA_COMPUTE_CAPABILITY (same as #1214)

The slangpy nightly `sanitizers` asan-ubsan legs (Linux + Windows, b650 hosts) have failed the same 6 `[cuda]` ray-tracing tests for weeks (`createRayTracingPipeline ... SLANG_FAIL`, plus `test_raytracing` `finish ... SLANG_FAIL`). The job log tail has the same text as slangpy #1214: `Invalid PTX input ... _optix_trace_typed_32 ... expected ( float ), but got ( i32 ) ... Target architecture invalid`. #1214 (closed 10-08) was the same 6 tests in `ci-latest-slang.yml`. It was fixed by #1215 ("Cap CUDA targets in latest-Slang CI"), which set `SGL_MAX_CUDA_COMPUTE_CAPABILITY: 90`. As of 2026-11-01 that env var is in `ci.yml:76` and `ci-latest-slang.yml:28` but NOT in `sanitizers.yml`. More evidence: on 11-01, `Slang branch: master` ran all 4 self-hosted legs on b650 and passed, so the old "x570 pass / b650 fail" idea does not hold. The likely fix [H, strong] is to add the same env to `sanitizers.yml`. Before you call the 6 tests an untracked bug, grep the slangpy workflows for `SGL_MAX_CUDA_COMPUTE_CAPABILITY`. The 2 LSan roots (#1130) are a separate problem.
