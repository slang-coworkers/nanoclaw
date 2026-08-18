---
title: "GLSL target emits invalid C-style brace array initializers; WGSL already has the constructor-syntax override GLSL lacks"
type: learning
topic: slang-compiler
source: learnings/1782632216704-glsl-target-emits-invalid-c-style-brace-array-init.md
---

# GLSL target emits invalid C-style brace array initializers; WGSL already has the constructor-syntax override GLSL lacks

**Symptom (slang #11802):** `slangc -target glsl` emits `const ivec2 a_0[2] = { ivec2(1,1), ivec2(2,2) };` for a `static const` (or any) array. C-style brace initializers are **invalid GLSL in every version** — GLSL requires array-constructor syntax `elemType[]( e0, e1, … )` (e.g. `ivec2[]( ivec2(1,1), ivec2(2,2) )`). The bug is NOT profile-specific despite the issue title saying "glsl_330" — it reproduces with plain `-target glsl` too, because array-constructor syntax has been valid since GLSL 1.20.

**Mechanism:** Array values lower to `kIROp_MakeArray` / `kIROp_MakeArrayFromElement`. `CLikeSourceEmitter::defaultEmitInstExpr()` emits them as `{ … }` at `slang-emit-c-like.cpp:2913` / `:2931`. Global `static const` arrays route through `emitGlobalVar()` (`:4859`) → `emitInstExpr(initVal)` (`:4947`) (MakeArray is foldable), hitting the same braces. `GLSLSourceEmitter::tryEmitInstExprImpl()` (`slang-emit-glsl.cpp:2199`) has **no** case for these ops → returns false (`:2505`) → inherits the base braces.

**Fix pattern:** Add `case kIROp_MakeArray:` / `case kIROp_MakeArrayFromElement:` to the GLSL `tryEmitInstExprImpl` emitting `elemType[]( … )`. The WGSL emitter already does exactly this — `slang-emit-wgsl.cpp:1531-1572` (MakeArray/MakeStruct + MakeArrayFromElement) — so mirror it. Note GLSL `MakeStruct` brace-init `{ … }` is ALSO invalid <GLSL 4.20 (separate latent bug; WGSL handles it in the same override).

**Test trap:** `tests/bugs/glsl-static-const-array.slang` exists for static-const arrays but compiles with `-vk` (SPIR-V path, where MakeArray → OpConstantComposite), so it does NOT exercise the `-target glsl` *text* emit. A regression test for this bug must use `-target glsl` with FileCheck on the emitted text.

**General takeaway:** When a `-target glsl` text-output codegen bug appears, check whether WGSL (the other "constructor-syntax, no brace-init" textual target) already solved the same shape — the override often exists in `slang-emit-wgsl.cpp` and just needs porting to `slang-emit-glsl.cpp`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782632216704-glsl-target-emits-invalid-c-style-brace-array-init.md`_
