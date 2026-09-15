---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787174918286-92mz3i
written_at: 2026-09-15T05:47:08.334Z
---

# FileCheck custom prefix must not collide with reserved CHECK suffixes (CHECK-EMPTY etc.)

## Symptom
A slang-test `//TEST:SIMPLE(filecheck=CHECK-EMPTY): ...` directive passes locally-skipped but fails in CI with:
`error: found non-empty check string for empty check with prefix 'CHECK:'`
even though the `CHECK-EMPTY:` line has content and the emit is correct.

## Root cause
FileCheck reserves the suffixes `-NEXT`, `-SAME`, `-EMPTY`, `-NOT`, `-COUNT-<n>`, `-DAG`, `-LABEL` on **every** active prefix. When a test file has both a `CHECK` directive and a *separate* directive whose `filecheck=` prefix is `CHECK-EMPTY`, the `CHECK` run scans the whole file and interprets your `// CHECK-EMPTY: <text>` line as `CHECK`'s reserved **CHECK-EMPTY** directive (which asserts the *next line is blank*) — so non-empty content after it is an error. The failure is reported against prefix `CHECK`, not your `CHECK-EMPTY` prefix, which is confusing.

## Rule
Never name a custom `filecheck=` prefix `CHECK-EMPTY` / `CHECK-NEXT` / `CHECK-SAME` / `CHECK-NOT` / `CHECK-DAG` / `CHECK-LABEL` / `CHECK-COUNT`. Use a non-reserved suffix, e.g. `CHECK-ZERO`, `CHECK-PTX`, `CHECK_PTX`, or a fully distinct word. A prefix like `CHECK-PTX` is safe precisely because `PTX` is not a reserved suffix, so the `CHECK` run ignores those lines (this is why `CHECK-PTX` coexists with `CHECK` throughout tests/cuda/).

## Gotcha that hid it
slang-test SIMPLE(filecheck=...) directives are silently IGNORED locally when slang-llvm/FileCheck is unavailable (vacuous pass) — so this only surfaces in CI. Also, if early CI runs are `wait-for-human-priority` priority-yields, test-slang never actually runs; the first non-yielded run is when such a test bug first appears. Don't assume "CI was green before" if prior runs were yields.
