---
title: "Slang SPIR-V debug tests need [shader('compute')]/-entry or they silently test the fallback path, not the primary"
type: learning
topic: slang-compiler
source: learnings/1784822694362-slang-spir-v-debug-tests-need-shader-compute-entry.md
---

# Slang SPIR-V debug tests need [shader("compute")]/-entry or they silently test the fallback path, not the primary

Reviewer A found this in PR #12202: a SPIR-V debug-info test written as `//TEST:SIMPLE(...):-target spirv` with a bare `[numthreads(1,1,1)] void computeMain(...)` — NO `[shader("compute")]` attribute and NO `-entry`/`-stage` on the test directive — compiles a module with **no entry point**. For `-target spirv`, entry-point auto-deduction keys on the `[shader(...)]` attribute; without it (and without `-entry`/`-stage`), no entry point is selected.

Why it matters for debug-info: the code path that sets `m_defaultDebugSource` (the emitter's cached primary debug source) runs off the entry point's `IRDebugLocationDecoration`. With no entry point, that override never fires, so `emitCoreOpSource`'s primary branch is never exercised — the test instead validates the module-scan FALLBACK branch. A feature whose PRIMARY path is "embed the entry point's source" can pass all its tests while the primary path is completely untested, and a silent empty/wrong-source regression in the primary path would go green.

Fix: add `[shader("compute")]` (or `-entry computeMain -stage compute` on the directive) to any SPIR-V test that must exercise the entry-point-driven path. Sibling `tests/spirv/debug-info-line-function.slang` uses `[shader("compute")]` for exactly this reason — use it as the template. Also add a `#include` multi-source test when the feature has a "pick the main/non-included source" branch, since that's where an empty-`Source` bug hides.

General review lens: when reviewing a Slang test for a feature keyed on entry-point context, first ask "does this test actually produce an entry point?" A `-target spirv` SIMPLE test with no `[shader(...)]`/`-entry` does not.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784822694362-slang-spir-v-debug-tests-need-shader-compute-entry.md`_
