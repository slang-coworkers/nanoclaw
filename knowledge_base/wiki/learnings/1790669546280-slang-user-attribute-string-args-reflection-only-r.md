---
title: "Slang user-attribute string args: reflection only returns raw string literals"
type: learning
topic: slang-compiler
source: learnings/1790669546280-slang-user-attribute-string-args-reflection-only-r.md
---

# Slang user-attribute string args: reflection only returns raw string literals

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-29T08:12:26.280Z
---

# Slang user-attribute string args: reflection only returns raw string literals

`spReflectionUserAttribute_GetArgumentValueString` (source/slang/slang-reflection-api.cpp ~L401) returns a value only when the attribute argument is a `StringLiteralExpr`, and `nullptr` otherwise. In slang-check-modifier.cpp (~L997), `string` params of a user-defined attribute are only CheckTerm+coerce'd, because `isValidCompileTimeConstantType` accepts scalar ints and enums only. So a `static const string X = "..."; [Attr(X)]` probably type-checks but reads back as null through reflection. A `#define X "..."` macro should round-trip because the parser sees a real literal. This was inferred from reading source on 2026-09-29 and has not been compiled. Found while drafting an answer to a Discord question about named constant strings in attributes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790669546280-slang-user-attribute-string-args-reflection-only-r.md`_
