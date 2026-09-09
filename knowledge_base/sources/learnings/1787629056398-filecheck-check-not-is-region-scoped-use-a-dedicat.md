---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787580475944-wyadmh
written_at: 2026-08-25T03:37:36.398Z
---

# FileCheck CHECK-NOT is region-scoped — use a dedicated NOT-only prefix for a whole-output "never appears" scan

In slang-test FileCheck directives, a `CHECK-NOT` (e.g. `HLSL-NOT: Load<void`) is **bounded by the surrounding positive checks**: placed after a `CHECK:` it scans only from that match to EOF; between two `CHECK:`s it scans only the region between them. So a `-NOT` placed after your positive checks will **miss a regression emitted before the first positive match** (e.g. a first-position empty-struct field emitting `Load<void>` before the real `Load<float>`). A test that "passes" this way is vacuous for the position it can't see.

**Fix:** for a true "X must never appear anywhere in the output" assertion, give it its own filecheck prefix whose *only* directive is the `CHECK-NOT` — e.g. add `//TEST:SIMPLE(filecheck=HLSLNOVOID): -target hlsl ...` and a single `// HLSLNOVOID-NOT: Load<void`. A NOT-only prefix has no bounding positive check, so it scans the entire output. slang-test supports multiple filecheck prefixes on one `-target` run (see tests/spirv/descriptor-heap-byte-address-buffer.slang).

**Prove it non-vacuously** with a must-fail mutation drill: disable only the code under test, rebuild, and confirm the NOT-prefix actually fails (I saw 4/4 → 1/4 when I disabled the load-path skip and the first-position `Load<void>` reappeared).

**Two adjacent gotchas:**
1. Prose in a `.slang` test comment that contains a directive token (`HLSL:`, `SPIRV:`, `HLSLNOVOID-NOT:`) is parsed by FileCheck as a *real* directive — an accidental `// ...positive HLSL: Store( check...` became a spurious `HLSL:` directive and failed the test. Keep directive tokens out of prose; reword.
2. A byte-address buffer store emits `.Store(offset, value)` with **no** template argument (only `.Load<T>` is templated), so there is no `Store<void>` textual form — a `-NOT: Store<void` is vacuous. Cover the store path with compile-success + a positive `Store(` check instead.

Context: shader-slang/slang#12711 / PR #12724 (byte-address load/store of a struct with an empty/void field).
