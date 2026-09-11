---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789052963494-xtv0u5
written_at: 2026-09-10T15:57:28.395Z
---

# isDeclRefTypeOf takes Val* and does NOT canonicalize — pass getCanonicalType() to see through typealias

**Rule.** `isDeclRefTypeOf<T>(type)` does NOT see through a `typealias`/`typedef`. Its signature takes `Val*` (slang-ast-type.h:76-84) and does `as<DeclRefType>(type)` on that `Val*`, which binds the **non-canonicalizing** `as<T>(NodeBase*)` overload (slang-ast-base.h:76-80) — an `isSubClassOf` test — NOT the canonicalizing `as<T>(Type*)` overload (slang-ast-base.h:615-619, which calls `getCanonicalType()`). So to recognize an aliased struct type you must canonicalize at the call site: `isDeclRefTypeOf<StructDecl>(type->getCanonicalType())`.

**Why it matters.** A struct field whose declared type is a `typealias`/`typedef` is stored as a **sugared `NamedExpressionType`**, not a `DeclRefType`: `VarDeclBase::getType()` returns the stored type verbatim (slang-ast-decl.h:328); a reference resolving to a `TypeDefDecl` yields `getNamedType(...)` (slang-check-decl.cpp:1747-1752); and `CoerceToProperTypeImpl` preserves that sugar (slang-check-type.cpp:446-464). Only `NamedExpressionType::_createCanonicalTypeOverride()` resolves the alias to the underlying `DeclRefType(StructDecl)` (slang-ast-type.cpp:1422-1428). So `getType()` on such a field is sugared at semantic-check time; a frontend predicate that skips canonicalization silently diverges from IR passes, which run on lowered/canonical types where the alias is already gone.

**Concrete instance — PR #12994 (nested `[raypayload]` PAQ inheritance).** The new predicate `isRayPayloadStructType(fieldVarDecl->getType())` initially lacked `getCanonicalType()` (commit 67527a0ef). For an aliased nested-payload member (`typealias NestedAlias = NestedPayload;`) the predicate returned false → the field was mis-treated as an ordinary field: E40000 fired when unqualified, and E40022 was missed when qualified — diverging from the IR legalize gate `addDefaultPayloadAccessQualifiersToStruct` (slang-ir-hlsl-legalize.cpp), which sees the canonical `IRStructType`. Fixed in commit e04727919 by canonicalizing at the call site + adding alias/generic-specialization tests.

**Review-process lesson.** When a fixer says "X already works empirically," pin down WHICH build. A locally-applied-but-unpushed fix makes an empirical test pass while the pushed/reviewed commit still has the bug — the fixer here concluded "getType() is already canonical" when in fact their own (not-yet-pushed) `getCanonicalType()` edit was doing the work. Adjudicate a static-vs-empirical disagreement by testing the EXACT reviewed commit (fail-before / pass-after), not "current HEAD," which may already carry the fix. A reviewer's static trace flagged a genuine live bug that empirical testing on a fixed build would falsely clear.
