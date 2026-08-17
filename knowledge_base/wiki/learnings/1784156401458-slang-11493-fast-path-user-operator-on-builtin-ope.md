---
title: "Slang #11493 fast-path: user operator on builtin operands — maintainer wants ERROR not honor"
type: learning
topic: slang-compiler
source: learnings/1784156401458-slang-11493-fast-path-user-operator-on-builtin-ope.md
---

# Slang #11493 fast-path: user operator on builtin operands — maintainer wants ERROR not honor

**Context:** Issue #11877 — since #11493, the builtin-operator fast path (`convertToBuiltinArithmeticOp`, slang-check-expr.cpp) rewrites `a OP b` on builtin scalar/vector/matrix operands to a `BuiltinOperatorExpr` before overload resolution, silently dropping a user `operator*(float4x4,float4x4)`. First fix attempt (PR #11879) *honored* the overload by deferring; jkwak-work CLOSED it (2026-07-15): overriding builtin matrix ops via user code is NOT intended — the compiler should EMIT AN ERROR instead. Users wanting GLSL matrix products use `-allow-glsl`.

**Key design lesson — a name-only detector is safe to DEFER on but UNSAFE to ERROR on.** PR #11879's helper `hasUserDefinedNonCoreOperatorInScope` did a scoped `lookUp` of the operator token name and checked `!isFromCoreModule`. That was fine for *deferring* (if the overload doesn't match these operands, resolution just picks the builtin — harmless). But as an ERROR trigger it false-positives: `float4x4 * float4x4` would wrongly error whenever ANY unrelated user `operator*` (e.g. `operator*(Color,Color)`) is merely in scope. A *precise* use-site check = per-candidate operand matching = overload resolution = the exact cost #11493 exists to avoid.

**Right layer for the error: the DEFINITION site**, not the use site. In `checkCallableDeclCommon` (slang-check-decl.cpp:~15569, beside `maybeInferPrefixModifierForOperator`), judge the operator decl's OWN operand types: error iff the operator name maps to a fast-path `BuiltinOperationKind` (via `getBuiltinOperationKindFromString(name, Binary)` — Binary suffices, it maps `~`/`!` too; only `&&`/`||`/`?:`→And/Or/Conditional and Unknown are excluded) AND every operand is builtin scalar/vector/matrix. Count the implicit `this` for instance-method/extension operators (via `getParentAggTypeDeclBase`+`isEffectivelyStatic`+`calcThisType`) so `struct W { float4x4 operator*(float4x4) }` (user receiver) is NOT flagged. Cheap (once per decl), zero false positives, matches "cannot overload" phrasing.

**Suppress in GLSL operator scope** (`getShared()->isGLSLOperatorScope()` = `-allow-glsl` OR `m_isGLSLModuleImported`), where the fast path already defers matrix/vector ops so the overload IS honored — keeps the maintainer's own workaround legal. Exclude `isFromCoreModule(decl)` — the core/glsl/hlsl builtin modules all get `FromCoreModuleModifier` on their TU root (slang-compile-request.cpp:298; glsl loaded via `addBuiltinSource` with `m_isCoreModuleCode=true`, slang-global-session.cpp:1202), so builtin-module operators are exempt.

**JS/wasm frontend gap (Track 2):** `import glsl;` in shader source sets `m_isGLSLModuleImported` (slang-check-decl.cpp:17049) → `isGLSLOperatorScope()` true — a FLAG-FREE, in-source way to get GLSL operator semantics, works from any frontend. Critical because slang-wasm `GlobalSession::createSession(int compileTarget)` (slang-wasm.cpp:74) exposes NO compiler-option API (no embind binding for SessionDesc/CompilerOptionEntry), so `-allow-glsl` literally cannot be set from JS. `import glsl;` is the only in-source route.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784156401458-slang-11493-fast-path-user-operator-on-builtin-ope.md`_
