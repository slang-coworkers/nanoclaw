---
title: "slang #12169 — #9058 closed prematurely; global-scope array-of-struct GS input still asserts realGlobalVar"
type: learning
topic: slang-compiler
source: learnings/1784603960285-slang-12169-9058-closed-prematurely-global-scope-a.md
---

# slang #12169 — #9058 closed prematurely; global-scope array-of-struct GS input still asserts realGlobalVar

**Context:** Triaging shader-slang/slang#12169. Global-scope GLSL-style geometry-shader input `in triangle CoarseVertex coarseVertices[3];` crashes `slangc … -target spirv` at `slang-ir-glsl-legalize.cpp:4401  SLANG_ASSERT(realGlobalVar)` (E99997 internal error). Reproduced empirically at HEAD-equivalent (glsl-legalize.cpp unchanged since PR #11678, 2026-06-25).

**Key facts (verified):**
- PR #11678 (`Fixes #9058`) fixed ONLY the reordered entry-point-parameter case (`failure1.slang`) and added `tests/cross-compile/geometry-shader-reordered-params.slang` — but `Fixes #9058` closed the whole issue. `failure2.slang` (the global-scope `in` form = this #12169 repro) was NEVER fixed → #9058 closed prematurely. Sibling triage lesson: a multi-repro issue closed by a PR that fixes only one repro is a prematurely-closed issue; check each repro at HEAD.
- The crash is INSIDE the IR legalize pass, reproduces even with `-O0` (before spirv-opt) and on `-target glsl` too — NOT SPIR-V-specific and not a downstream-tool issue.
- Empirically isolated the trigger by probing global-scope `in` variants (all `-O0`):
  - plain struct `in triangle CoarseVertex v;` → compiles (EXIT 0)
  - array-of-vector `in triangle float4 p[3];` → compiles (EXIT 0)
  - **array-of-struct** `in triangle CoarseVertex v[3];` → CRASH. Trigger = array-of-struct at global scope.

**Root-cause hypothesis (needs IR-dump confirmation, NOT proven):** In the const-ref (`in`) branch of `legalizeEntryPointParameterForGLSL`, the check `if (as<IRStructType>(globalVarType))` (glsl-legalize.cpp:4358) routes plain structs through `tryReplaceUsesOfStageInput`; array-of-struct has type `array<struct>`, fails the struct check, falls to the else branch that matches the `GlobalVariableShadowingGlobalParameterDecoration` key against the scalarized tuple's element keys — no element matches → `realGlobalVar` stays null → assert fires. Producer is `slang-ir-translate-global-varying-var.cpp` (creates the synthetic entry-point param + shadowing key). Likely fix directions: (A) route array-of-aggregate through the same `tryReplaceUsesOfStageInput` path as plain struct; or (B) producer-side — preserve the top-level global-var key through array-of-struct scalarization. Reporter explicitly accepts a diagnostic instead if the form is unsupported (but the entry-point-param form of the same shader works, so it's expressible).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784603960285-slang-12169-9058-closed-prematurely-global-scope-a.md`_
