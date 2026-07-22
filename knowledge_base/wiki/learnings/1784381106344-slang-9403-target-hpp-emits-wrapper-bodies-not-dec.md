---
title: "slang#9403 -target hpp emits wrapper bodies not decls for extern_cpp compute entrypoint"
type: learning
topic: slang-compiler
source: learnings/1784381106344-slang-9403-target-hpp-emits-wrapper-bodies-not-dec.md
---

# slang#9403 -target hpp emits wrapper bodies not decls for extern_cpp compute entrypoint

**Symptom:** `slangc x.slang -target hpp` (C++ header output) for a compute entry point marked `__extern_cpp` produces a header that won't compile: the three CPU compute wrappers (`example`, `example_Group`, `example_Thread`) are emitted as full function DEFINITIONS whose bodies call `_example(...)`, but the `_`-prefixed workhorse `_example` is emitted NOWHERE in the header. `-target cpp` is fine (it defines `_example`).

**Two root-cause gaps (verified at HEAD aaa07fe29):**
1. The compute-wrapper loop in `CPPSourceEmitter::emitModuleImpl` (source/slang/slang-emit-cpp.cpp:2369-2438, via helpers `_emitEntryPointDefinitionStart/End` at 2112-2140) always emits `{ ... }` bodies — it never checks `shouldEmitOnlyHeader()`. So header mode gets definitions, not prototypes.
2. The workhorse decl is suppressed: header mode strips all IRFunc blocks in `CLikeSourceEmitter::computeEmitActions` (slang-emit-c-like.cpp:5339-5355); the now-blockless entry-point func routes to `emitFuncDecl`, which early-returns for entry points (`if (asEntryPoint(func)) return;`, slang-emit-c-like.cpp:3948-3954). The `_`-prefixed name is only ever emitted from the DEFINITION path `emitSimpleFuncImpl` (slang-emit-cpp.cpp:998-1012), which doesn't run in header mode. Net: no `_example` declaration reaches the header.

**Scope gotcha for repro/tests:** the broken wrappers appear ONLY when the entry point survives DCE as an exported symbol (`__extern_cpp` or `export`). A PLAIN `[shader("compute")] void main(){}` is dead-code-eliminated and emits NOTHING in hpp mode — which is why the existing test tests/headers/generate-hpp-header.slang (whose `dummyEntrypoint_` is plain) never caught this. A regression test must use `__extern_cpp` on the entry point.

**Fix direction (recommended):** header mode should emit the wrappers as prototypes (`;`, no body) AND a forward decl of the `_`-prefixed workhorse; keep cpp emitting full definitions. Scope to the C++/CPU header path so the `asEntryPoint` suppression (which exists so HLSL forward decls don't drop required attributes) is untouched for other targets. `SLANG_PRELUDE_IMPORT` does NOT exist in prelude/slang-cpp-prelude.h; adding it is an optional Windows-dllimport adjunct, not required for link-correctness since `_example` isn't export-marked.

**Anti-pattern:** the reporter's literal suggestion (keep wrapper bodies + add IMPORT macro) leaves function DEFINITIONS in a header → ODR/duplicate-symbol at link across TUs. Header mode = declare, don't define.

Sibling issue #9401 is a distinct `-target hpp` gap by the same reporter (exporting functions requires an entrypoint), not a duplicate.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784381106344-slang-9403-target-hpp-emits-wrapper-bodies-not-dec.md`_
