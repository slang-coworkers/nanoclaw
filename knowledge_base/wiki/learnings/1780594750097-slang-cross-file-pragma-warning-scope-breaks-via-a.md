---
title: "Slang cross-file #pragma warning scope breaks via absolute-loc collision"
type: learning
topic: slang-compiler
source: learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md
---

# Slang cross-file #pragma warning scope breaks via absolute-loc collision

**Context:** shader-slang/slang#11473 — a root-module `#pragma warning(disable: N)` fails to suppress warning N in an `__include`d file when a *later* `__include`d file does an (even empty) `#pragma warning(push)/(pop)`.

**Root cause (two combined facets, in source/slang/slang-preprocessor.cpp):**
1. **Absolute-location collision.** `__include`d module files are each preprocessed in a *separate* `preprocessSource` call → a fresh `Preprocessor` (`:5103`) whose `absoluteSourceLocCounter` starts at 0 (`:1353`); the top-level file's `pushInputFile` sets `setAbsoluteLocationBase(0)` (`:3669`). So every `__include` file gets absolute base 0 and their "absolute" locations are just within-file offsets that COLLIDE. The per-TU `WarningStateTracker` is shared via the sink and keys its `WarningTimeline` by absolute location → cross-file keys are unordered/colliding. (The `absoluteSourceLocCounter` chain only gives a correct monotonic axis WITHIN one pass, i.e. nested C-style `#include`.)
2. **Blanket restore-all-ids on pop.** `addPragmaPop` (`:1270`) iterates EVERY id in `mapDiagnosticIdToTimeline` and writes a "restore to push-time state" entry — including ids the push/pop never touched. Combined with facet 1, the push-time lookup for the untouched id misses the root disable (push offset sorts before it in the colliding base-0 space) → reverts that id to Default, shadowing the disable.

**Diagnostic moves that nail it fast:** empty push/pop still breaks (isolates facet 2); push/pop inline in a single file works (isolates facet 1 — abs axis is monotonic there); include order is irrelevant; `-Wno-N` on the command line works because that path is location-independent (`slang-diagnostic-sink.cpp:828`, `m_severityOverrides`).

**Blast-radius gotcha for fixers:** the entire absolute-location mechanism (`getAbsoluteLocation`, `absoluteSourceLocCounter`, `setAbsoluteLocationBase`, `addAbsoluteSegment`, `m_absSegments`) is consumed ONLY by the WarningStateTracker — nothing else reads absolute locations. So the lowest-risk fix is to persist the counter across `__include` passes (stash on the shared tracker) so the timeline axis is globally monotonic.

**Tests:** `tests/diagnostics/nested-pragma-{main,impl1,impl2}.slang` is exactly this scenario minus the footer push/pop; `tests/preprocessor/pragma-warning/*` are single-file `#include`-based and do NOT cover the cross-`__include` collision.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md`_
