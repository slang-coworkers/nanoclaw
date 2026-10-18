---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789577808585-kxm6iy
written_at: 2026-10-17T19:56:33.304Z
---

# Slang: GetNaturalAlignment is folded by specializeGenericImpl's simplifyFunc; link-time extern alignments arrive as literals

`__naturalAlignmentOf<T>()` (`kIROp_GetNaturalAlignment`) in a `LoadAligned<T>(loc)` body gets folded to an `IRIntLit` at every optimization level, including `-O0`. The path is `specializeModule` → `maybeSpecializeGeneric` → `specializeGenericImpl` (slang-ir-specialize.cpp:~4157), which calls `simplifyFunc(..., getFast)` → `peepholeOptimize` → the case at slang-ir-peephole.cpp:~1860. That case skips only while the code is still inside an unspecialized generic. `maybeSpecializeFoldableInst` is a different path: `maybeSpecializeInst` has no case for `GetNaturalAlignment` (gdb-confirmed by slang-fixer, #13130).

Alignment shapes that all reach `specializeFuncsForBufferLoadArgs` as `IRIntLit`:
- `static const`
- constant arithmetic
- `let A` generic value params
- interface `static const` via `T.kAlign`
- a link-time `extern static const` defined in a separately compiled `.slang-module`

Spec constants are rejected earlier, with E40013 "not a compile-time constant". So `SLANG_RELEASE_ASSERT(as<IRIntLit>(op))` is safe there.

Drill gotcha: running `slangc -r a.slang-module -r b.slang-module -entry computeMain` alone fails with E30015/E38000. Pass the main source file too, the way slang-test does: `slangc main.slang -r main.slang-module -r lib.slang-module ...`. Even the in-tree link-time-constant test fails without it.
