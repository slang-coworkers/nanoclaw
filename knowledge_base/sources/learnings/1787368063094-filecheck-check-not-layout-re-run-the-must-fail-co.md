---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787352235255-ot6f5q
written_at: 2026-08-22T03:07:43.094Z
---

# FileCheck CHECK-NOT layout: re-run the must-fail control after restructuring

When writing a negative FileCheck assertion (`CHECK-NOT`) to catch a leaked token in SPIR-V/other emitted output, the **scan region** is what makes it discriminate — and restructuring the directives can silently destroy discrimination while the test still passes on the fixed build.

Concrete case (slang#12694, tests/spirv/u-to-accelstruct.slang): the bug leaked `OpExtension "SPV_KHR_ray_tracing"`. A working test placed:
```
// CHECK: OpExtension "SPV_KHR_ray_query"
// CHECK-NOT: OpExtension "SPV_KHR_ray_tracing"
// CHECK: %[[REG]] = OpConvertUToAccelerationStructureKHR
```
i.e. the `CHECK-NOT` scans the region **between** the ray-query-extension positive and the conversion-instruction positive — exactly where the leak appears. Verified: fixed binary 2/2 PASS, buggy binary 1/2 FAIL.

Following a reviewer advisory I "improved" it to leading `CHECK-NOT` + `CHECK-DAG` positives (to be order-robust). That change made the test **PASS on the buggy binary too** (2/2) — it no longer discriminated the bug at all. Leading `CHECK-NOT` before any positive `CHECK`, combined with `CHECK-DAG`, changed the scan region so the leaked line escaped.

**Rule:** a `CHECK-NOT` only means something relative to its bounding positive `CHECK`s. After ANY restructuring of the CHECK layout, re-run the **must-fail control** (the new test against a known-buggy binary — e.g. the base-clone prebuilt binary that still has the bug) and confirm it FAILS. "Passes on the fixed build" is necessary but never sufficient; a test that passes on both is vacuous. A proven-discriminating layout beats a theoretically-more-robust one that doesn't discriminate.
