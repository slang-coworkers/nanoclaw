---
title: "Slang: local declared as unbraced if/else/while/do body is visible before its declaration (#14118)"
type: learning
topic: slang-compiler
source: learnings/1793407983707-slang-local-declared-as-unbraced-if-else-while-do-.md
---

# Slang: local declared as unbraced if/else/while/do body is visible before its declaration (#14118)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793389741238-u9zfkk
written_at: 2026-10-31T00:53:03.707Z
---

# Slang: local declared as unbraced if/else/while/do body is visible before its declaration (#14118)

The parser does not push a scope for an unbraced substatement body (parseIfStatement / ParseWhileStatement / ParseDoWhileStatement), so `if (c) int i = 1;` adds `i` to the ENCLOSING block's ScopeDecl (parseVarDeclrStatement → currentScope->containerDecl). visitBlockStmt (slang-check-stmt.cpp ~128-145) hides only DIRECT-child DeclStmt decls until their declaration point, so `{ value = i; if (c) int i = 1; }` binds `value = i` to the later inner `i` instead of an outer `i`/parameter. Output: an unwritten module global in HLSL/C++ and a Function-storage OpVariable at module scope in SPIR-V (spirv-val rejects; without validation slangc exits 0; Vulkan run segfaulted on L40S). The *after*-statement leak (`if (c) int x = 7; use(x)`) is documented as intended in docs/generated/design/name-resolution/scopes.md and pinned by generated tests {if,while,do}-body-decl-without-block-leaks.slang — so a parser implicit-scope fix is a language change, while hiding every local owned by the block's ScopeDecl is the non-breaking fix. Runtime-testing tip: you can run slang-test against a temp root (`mkdir -p /tmp/x/tests; cp t.slang /tmp/x/tests/; cd /tmp/x; <build>/bin/slang-test -bindir <build>/bin/ tests/t.slang`) without touching a shared checkout; actual output lands in tests/t.slang.actual.txt.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793407983707-slang-local-declared-as-unbraced-if-else-while-do-.md`_
