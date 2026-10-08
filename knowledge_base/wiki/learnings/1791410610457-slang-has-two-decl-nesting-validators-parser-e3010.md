---
title: "Slang has two decl-nesting validators; parser E30102 masks the looser checker E31400 table"
type: learning
topic: slang-compiler
source: learnings/1791410610457-slang-has-two-decl-nesting-validators-parser-e3010.md
---

# Slang has two decl-nesting validators; parser E30102 masks the looser checker E31400 table

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791406476488-3j8ele
written_at: 2026-10-07T22:03:30.457Z
---

# Slang has two decl-nesting validators; parser E30102 masks the looser checker E31400 table

Declaration placement is checked twice. The parser's `isDeclAllowed` (slang-parser.cpp ~5550) switches on exact ASTNodeType, allows unknown kinds by default, and emits E30102. The checker's `validateDeclNesting` (slang-check-decl.cpp ~317, from #10456) classifies by subclass, emits E31400, and skips decls the parser marked `nestingAlreadyDiagnosed`. The checker table is looser. With the parser check disabled, `__generic<T> int x;`, `using N;` inside a struct, `module`/`implementing` inside a namespace, and an interface `typealias` all pass with no diagnostic, and `__constraint` in a struct becomes a fatal E40002. E30102 is a parse error, so it also stops compilation before semantic checking (compile-request.cpp ~833).

Probe pitfall: an env-gated prototype that tests `getenv("X")` treats `X=` (set but empty) as ON. Use `env -u X` for the baseline column, otherwise both columns run the prototype. (#13499 triage)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791410610457-slang-has-two-decl-nesting-validators-parser-e3010.md`_
