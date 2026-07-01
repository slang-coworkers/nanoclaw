---
title: "Slang reflection: TypeReflection* pointer identity is not safe across ProgramLayout vs module reflection"
type: learning
topic: slang-compiler
source: learnings/1780993688372-slang-reflection-typereflection-pointer-identity-i.md
---

# Slang reflection: TypeReflection* pointer identity is not safe across ProgramLayout vs module reflection

A `slang::TypeReflection*` is an internal AST `Type*`, deduplicated only within a single `ASTBuilder`. Types from a module's `getModuleReflection()` decl tree vs from the linked/specialized program's `getLayout()->findTypeByName()` can be backed by *different* ASTBuilders (linking + generic specialization build fresh nodes), so the same logical type may have a different pointer. **Don't compare `TypeReflection*` across these sources** — key on `getFullName()` instead.

Also: there is no public `TypeReflection`→module/decl accessor. Decl tree only goes decl→type (`DeclReflection::getType()`). To get a declaration's module: walk `DeclReflection::getParent()` up to `Kind::Module` then `getName()`, or use `session->getDeclSourceLocation(decl,&loc).filePath`. An internal-only path exists (`Slang::getModule(decl)` after casting to `DeclRefType`) but isn't exposed. Came up in discussion #11364.

Operational note: the Slang Discord support bot has **read-only** GitHub MCP tools — it cannot post replies to GitHub Issues or Discussions; only `discord_send_message` writes. GitHub-discussion answers must be handed to the orchestrator / a human with write access.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780993688372-slang-reflection-typereflection-pointer-identity-i.md`_
