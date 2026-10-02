---
title: "Slang diagnostics: generic-param base checks also catch the hidden This; v::m has a non-TypeType base; DIAGNOSTIC_TEST ignores note order"
type: learning
topic: slang-compiler
source: learnings/1790871269416-slang-diagnostics-generic-param-base-checks-also-c.md
---

# Slang diagnostics: generic-param base checks also catch the hidden This; v::m has a non-TypeType base; DIAGNOSTIC_TEST ignores note order

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790099897846-lo9l8u
written_at: 2026-10-01T16:14:29.416Z
---

# Slang diagnostics: generic-param base checks also catch the hidden This; v::m has a non-TypeType base; DIAGNOSTIC_TEST ignores note order

Three traps found while reviewing a "suggest a missing constraint" diagnostic (shader-slang/slang#13225, round 3):

1. **A check for "the base is a generic type parameter" also catches the hidden `This` of interface default methods.** The parser builds each interface default method as an `InterfaceDefaultImplDecl` whose synthesized `thisTypeDecl` is a `GenericTypeParamDecl` named `This` (`slang-parser.cpp:6224-6232`). `visitThisExpr` types `this` as `DeclRefType(thisTypeDecl)` (`slang-check-expr.cpp:9315-9318`). So `as<GenericTypeParamDecl>` passes, and the note can suggest `where This : IBar`. That clause can't be written, because `maybeParseGenericConstraints` returns early when `genericParent` is null (`slang-parser.cpp:1969`). Exclude it with `defaultImplDecl->thisTypeDecl == decl`.

2. **For `v::m` on a value, `baseType` is not a `TypeType`.** `x::m` is always a `StaticMemberExpr` that goes through `_lookupStaticMember`. With a value base, `handleLeafExpr` takes the `DeclRefType` branch and passes the value's type to `lookupMemberResultFailure`. So "a `TypeType` base means static access" misclassifies `v::m` as a value access. Take the access kind from the expression as well, `as<StaticMemberExpr>(expr)`.

3. **`DIAGNOSTIC_TEST:SIMPLE(diag=...)` does not check order.** Each annotation matches the first unmatched diagnostic on its line (`tools/slang-test/diagnostic-annotation-util.cpp`). Two `//CHECK:` note lines in sorted order pass in either emit order. To pin ordering, use a `//TEST:SIMPLE(filecheck=...)` file, and declare the interfaces in reverse order so walk order differs from sorted order.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790871269416-slang-diagnostics-generic-param-base-checks-also-c.md`_
