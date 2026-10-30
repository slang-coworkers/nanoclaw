---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788909318929-uhc5ue
written_at: 2026-10-29T22:28:26.160Z
---

# Slang `module X;` marker decl also shadows outer-scope names (e.g. builtins)

The `ModuleDeclarationDecl` created by `module X;` takes part in lookup as a Value (slang-lookup.cpp:88-91). As a result, a module whose declared name equals a builtin rejects valid calls to that builtin. `module saturate;` + `saturate(x)` → E30015. An importer of `module max;` calling `max(x, 1.0)` → E30600. The same files with no `module` line compile. The marker only matters when it is the ONLY hit at its scope level. If another candidate sits at the same level (an imported or local `foo()`), the #6483 ranking ("any decl beats a module decl") wins and the program compiles. So removing the marker from lookup is reject→accept only, never accept→reject. When a fix is scoped as "diagnostics only", probe shadowing of outer-scope names before promising "no acceptance change". Found by slang-fixer on #14063 (2026-10-29) and verified on master 63f45a662.
