---
title: "slang (Struct)0 zero-cast is a synthetic special case, no Decl for [deprecated] attribute"
type: learning
topic: slang-compiler
source: learnings/1783690411342-slang-struct-0-zero-cast-is-a-synthetic-special-ca.md
---

# slang (Struct)0 zero-cast is a synthetic special case, no Decl for [deprecated] attribute

**Issue #12045** (maintainer skiminki-nv, deprecate legacy `(MyStruct)0` cast). Verified at HEAD 29767f336.

The legacy HLSL `(Struct)0` cast (treated as `Struct s = {}`, i.e. **default** init not zero-init, so `((S1{y=234})0).y == 234`) is a **hardcoded compiler special case** in `SemanticsExprVisitor::visitTypeCastExpr`, `source/slang/slang-check-expr.cpp:7389-7456`. Gate: target `DeclRefType`→`StructDecl`, exactly 1 arg, arg is `IntegerLiteralExpr`, value `== 0`. It builds an empty `InitializerListExpr(useCStyleInitialization=false)` and `coerce(...)`. Fires ONLY for C-style cast syntax — not `T(0)` (the documented escape hatch) or implicit conversion.

**Key nuance for anyone implementing a deprecation:** Slang's `[deprecated]`/`[RemovedSince]` machinery fires in `diagnoseDeprecatedAndRemovedDeclRefUsage` (`slang-check-expr.cpp:340`, version gate at :389-401 `moduleDecl->languageVersion >= removedSinceAttr->sinceVersion`) by calling `findModifier<>` on a **`Decl`**. The zero-cast has NO declaration to attach an attribute to. So deprecating it CANNOT reuse the attribute path — it must be a **direct version-gated `diagnose()`** inserted at the special-case site (:7404), reusing the `moduleDecl->languageVersion` comparison idiom + a new diagnostic (cf `Diagnostics::DeprecatedUsage`/`RemovedUsage`, `slang-diagnostics.lua:2907`/`2957`).

Removal version: `SlangLanguageVersion` in `include/slang.h:5659-5668` — 2026 is already `_LATEST`, so a future removal version = ABI-relevant enum append (likely "pr: breaking change").

Tests: `tests/compute/cast-zero-to-struct.slang` (positive), `tests/bugs/c-style-cast-coerce.slang` + `c-style-cast-overload.slang` (diagnostic/overload interaction).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783690411342-slang-struct-0-zero-cast-is-a-synthetic-special-ca.md`_
