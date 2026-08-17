---
title: "slang #include'd file gets a DebugSource but NO DebugCompilationUnit — defeats any DebugSource→CU map (#11983)"
type: learning
topic: slang-compiler
source: learnings/1784282376505-slang-include-d-file-gets-a-debugsource-but-no-deb.md
---

# slang #include'd file gets a DebugSource but NO DebugCompilationUnit — defeats any DebugSource→CU map (#11983)

**Correction to the #11983 fix recommendation.** My original triage recommended "Approach A: build a `DebugSource → DebugCompilationUnit` map and resolve a DebugFunction's scope by `debugFunc->getFile()`." The reporter (pdeayton-nv) objected that not every `DebugSource` has a `DebugCompilationUnit` for an `#include`. VERIFIED correct at origin/master 5c30d437f:

- `source/slang/slang-lower-to-ir.cpp:15407` — `emitDebugSource` runs for EVERY source file in the translation unit.
- `slang-lower-to-ir.cpp:15418` — `emitDebugCompilationUnit(debugSource)` is gated by `if (debugInfoLevel >= Standard && !source->isIncludedFile())`. The comment (:15414-15417) states CUs are emitted "for each non-included source file." So an `#include`'d file gets an `IRDebugSource` but NO `IRDebugCompilationUnit`.
- `slang-lower-to-ir.cpp:14659` — an `IRDebugFunction`'s file operand is `locationDecor->getSource()`, i.e. the file where the function's own source line lives. A function defined in an `#include`'d file therefore has a `getFile()` DebugSource with no CU → a `cuForSource[getFile()]` lookup MISSES.

**import ≠ include (scope nuance):** `SourceFile::setIncludedFile()` is called ONLY from `TranslationUnitRequest::addIncludedSourceFileIfNotExist` (`slang-translation-unit.cpp:132`) — the preprocessor `#include` path — NOT for `import`ed modules. So an imported module's primary source is non-included and DOES get its own CU. That's why Approach A would still fix the exact *reported* symptom (imported-function scope) yet leave the include-defined-function case unscoped.

**Better fix = Approach B (producer-side):** store the scope/compilation-unit explicitly on `IRDebugFunction` at IR-generation (where the owning module's CU is known and well-defined for every function, include-defined ones included), instead of reconstructing it during SPIR-V emit after all modules' debug records are flattened into one IR module. This aligns with the repo's "store the canonical form at the producer; avoid emit-time semantic-to-syntax/context reconstruction" methodology. Blast radius: `IRDebugFunction` is a leafInst with fixed operands (name/line/col/file/debugType in slang-ir-insts.h) → adding a scope operand touches the Lua inst def + FIDDLE regen + IR-blob serialization (imported modules ship as IR blobs; the debug-info operand must round-trip or be regenerated on import).

**Meta-lesson:** when recommending a lookup keyed by X→Y, confirm every X in scope actually HAS a Y before calling it the recommended path. Here "every DebugFunction has a source file" was true, but "every source file has a CU" was false by design — the gap the reporter caught. Reproduces the [[feedback_hedge_root_cause_in_public_verdict]] pattern: verify load-bearing existence claims at ground truth, don't assume totality.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784282376505-slang-include-d-file-gets-a-debugsource-but-no-deb.md`_
