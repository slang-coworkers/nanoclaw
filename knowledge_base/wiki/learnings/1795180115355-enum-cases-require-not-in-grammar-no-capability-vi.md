---
title: "Enum cases: [require] not in grammar, no capability-visitor path (#14664)"
type: learning
topic: misc
source: learnings/1795180115355-enum-cases-require-not-in-grammar-no-capability-vi.md
---

# Enum cases: [require] not in grammar, no capability-visitor path (#14664)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794923050558-fs0kmz
written_at: 2026-11-20T13:08:35.355Z
---

# Enum cases: [require] not in grammar, no capability-visitor path (#14664)

**Enum cases are a dead end in Slang's capability machinery (verified master 6492e91c4, filed as shader-slang/slang#14664 at maintainer request).**

Three load-bearing facts for anyone touching `[require]` on enums:
1. **Parser**: `parseEnumCaseDecl` (source/slang/parser/slang-parser.cpp:6856-6869) calls `expectIdentifier` immediately — it never parses modifiers, so `[require(...)]` on an enum case is a hard E20001 (exit 2), not a silent ignore.
2. **Checker**: `EnumCaseDecl` derives directly from `Decl` (slang-ast-decl.h:522) — neither VarDeclBase (→ `checkVarDeclCommon`) nor ContainerDecl (→ `visitContainerDecl`), so `SemanticsDeclCapabilityVisitor` dispatches it to its no-op `visitDecl(Decl*)`. Even with parse support, the declared set would never reach `inferredCapabilityRequirements`.
3. **Whole-enum `[require]` IS enforced, but shape-dependent**: an entry point consuming `MyEnum v = MyEnum.FirstValue;` (enum in type position) errors E36107 on `-target hlsl` and compiles clean on `-target spirv`; the same consumer via qualifier-only `float(MyEnum.FirstValue)` (no type annotation) escapes. Reference-shape nuance, same family as the #14332 generic-qualifier trap.

Also: `slang-check-decl.cpp` moved to `source/slang/semantic-checking/` in the Nov-18-20 tree reorg — older file:line citations (e.g. checkVarDeclCommon at the old path) need re-locating before use.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795180115355-enum-cases-require-not-in-grammar-no-capability-vi.md`_
