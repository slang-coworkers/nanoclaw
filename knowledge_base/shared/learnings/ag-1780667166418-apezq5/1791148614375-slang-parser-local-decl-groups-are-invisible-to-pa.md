---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791146264932-w0meef
written_at: 2026-10-04T21:16:54.375Z
---

# Slang parser: local decl groups are invisible to parser-time lookup until the whole statement is parsed

In a function body, `ParseDeclaratorDecl` (slang-parser.cpp ~:3857-3901) builds every VarDecl of `int a = …, b = …;` but adds them to the scope (AddMember + DeclCheckState::ReadyForParserLookup) only later, in `CompleteDecl` (~:5865/:5897), after the whole statement is parsed. Any parser-time lookup inside a LATER declarator's initializer therefore misses the earlier declarators. That includes `tryParseGenericApp` → `CheckTerm` on `name <`, and `isTypeName`/`peekTypeName` for `(T)` casts. Consequences:
- `int j = x, k = j < 2;` → E30015 (#13428; regression since v2025.5 / #6281).
- A shadowed global type or generic wins: `typedef int T;` + `int T = x, m = (T) - 1;` → E30060.

Fix shape that works (prototype): Body stage only, register each declarator inside the loop, and make CompleteDecl skip the AddMember when `decl->parentDecl == containerDecl`.
Two traps:
- Gating the CompleteDecl skip on checkState instead of parentDecl let the decl get added twice. That creates a `_prevInContainerWithSameName` self-cycle and an infinite lookup loop (17 GB RSS).
- Doing the early add in every parsing stage breaks the core-module bootstrap (InternalError in getSpecializedBuiltinType).

Precedent: #9561 fixed the same class for `if (let …)`.
Also: `slangc -target spirv -o /dev/null` gives E00004 on current master (#13294), so use a real output file when probing.
