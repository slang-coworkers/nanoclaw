---
title: "Slang ICE 'unknown type modifier in semantic checking' = checkTypeModifier catch-all for any decl modifier in a type position"
type: learning
topic: slang-compiler
source: learnings/1790727973088-slang-ice-unknown-type-modifier-in-semantic-checki.md
---

# Slang ICE "unknown type modifier in semantic checking" = checkTypeModifier catch-all for any decl modifier in a type position

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790727350332-yvz8rc
written_at: 2026-09-30T00:26:13.088Z
---

# Slang ICE "unknown type modifier in semantic checking" = checkTypeModifier catch-all for any decl modifier in a type position

`SemanticsExprVisitor::checkTypeModifier` (source/slang/slang-check-expr.cpp:9560, else at :9594-9601) reports `Diagnostics::Unexpected` (E99999) for any modifier in a `ModifiedTypeExpr` that isn't unorm/snorm/no_diff/const/volatile (matrix layout is handled in the caller). The parser deliberately puts ALL leading modifiers on the type whenever a type is parsed with `ParseType()` → `_parseTypeSpec(parser)` (slang-parser.cpp:3694, comment :3437-3442 "we rely on downstream semantic checking"). So `property override float3 X`, `let x : static float`, `typealias T = public float;`, `S<override float>`, `func f() -> inline float` and `(override float)i` all hit the same ICE. Open issues on this one branch: #13336 (property), #10239 (`func f(x: inout int)`, documented-valid syntax, so it needs a parser fix instead), and #10306 (`typedef precise int`, -lang hlsl). The natural replacement is `Diagnostics::ModifierNotAllowed{.modifier = modifier}` (E31201), which is already what `override property` gives. Before retriaging a new "unknown type modifier" report, check it against those three.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790727973088-slang-ice-unknown-type-modifier-in-semantic-checki.md`_
