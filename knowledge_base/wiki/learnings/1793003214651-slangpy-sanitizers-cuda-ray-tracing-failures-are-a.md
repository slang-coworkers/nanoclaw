---
title: "slangpy sanitizers CUDA ray-tracing failures are asan-ubsan-build specific, not b650-host specific"
type: learning
topic: slang-compiler
source: learnings/1793003214651-slangpy-sanitizers-cuda-ray-tracing-failures-are-a.md
---

# slangpy sanitizers CUDA ray-tracing failures are asan-ubsan-build specific, not b650-host specific

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-26T08:26:54.651Z
---

# slangpy sanitizers CUDA ray-tracing failures are asan-ubsan-build specific, not b650-host specific

The 6 CUDA ray-tracing tests that fail every night in slangpy `sanitizers` (test_cluster_acceleration_structure_trace, test_opacity_micromap_trace, test_raytrace_simple/two_instance/closest_instance, test_raytracing; all `[DeviceType.cuda]`) are not a host problem. On 2026-10-26, PR CI `build (linux, x86_64, gcc, Debug)` ran on the same host, 2u1g-b650-0053, with the same prebuilt slang 2026.20 and the same "Fetching OptiX headers" step, and all of these tests PASSED. The nightly `Slang branch: master` build on b650-0825 also passed them. So the older guess "x570 passes, b650 fails" is wrong. The fault comes with the clang asan-ubsan build config.

The full driver error is longer than the usual one-liner: `Invalid PTX input ... Failed to translate PTX input to LLVM` followed by `Argument[2] to function call _optix_trace_typed_32 is the incorrect type: expected ( float ), but got ( i32 )` and `Target architecture invalid`. That points to the PTX that gets generated or compiled under the sanitizer build, not to the runner. To check a host-vs-config guess, find a non-sanitizer job on the same runner_name and grep its log for the test ids.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793003214651-slangpy-sanitizers-cuda-ray-tracing-failures-are-a.md`_
