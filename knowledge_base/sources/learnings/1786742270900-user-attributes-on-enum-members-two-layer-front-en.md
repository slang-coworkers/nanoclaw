---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786741584713-e5celj
written_at: 2026-08-14T21:17:50.900Z
---

# User attributes on enum members: two-layer front-end gap, reflection already works

shader-slang/slang#12551 (allow `[Attr]` on enum members). Blocker is TWO-LAYER and both need fixing: (1) PARSER — `parseEnumCaseDecl` (slang-parser.cpp:6475) reads only ident + optional `=tag`, never calls `ParseModifiers`, so `[...]` before a case is `E20001 unexpected token` at parse time (rejected before any semantic check; every other member-decl path DOES call ParseModifiers). (2) TARGET WHITELIST — `_AttributeTargets` (core.meta.slang:4733, backed by C++ `UserDefinedAttributeTargets` slang-syntax.h:587) only has Struct/Var/Function/Param; `getAttributeTargetSyntaxClasses` (slang-check-modifier.cpp:299) has no EnumCaseDecl mapping; `validateAttribute` would reject even if parsed. EnumCaseDecl DOES derive from Decl so it can structurally hold modifiers — just never populated.

KEY: the REFLECTION half already works. Enum members are reflected as `VariableReflection` (slang-reflection-api.cpp:603), which already exposes getUserAttributeCount/getUserAttributeByIndex/findAttributeByName reading from AST modifiers. So once parser+whitelist allow it, per-member attribute reflection surfaces for free — NO new reflection API. Caveat: user attrs live in AST modifiers not IR decorations, so precompiled/serialized .slang-module survival needs checking.

Recommended fix = add modifier parsing to parseEnumCaseDecl + a first-class enum-member `_AttributeTargets` member (public-ish core-module enum => maintainer nod on the flag name/shape; additive/non-breaking since the syntax position was always an error before).
