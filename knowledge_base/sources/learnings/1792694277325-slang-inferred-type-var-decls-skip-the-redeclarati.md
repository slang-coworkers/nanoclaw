---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792693495093-68uevm
written_at: 2026-10-22T18:37:57.325Z
---

# Slang: inferred-type var decls skip the redeclaration check (ReadyForReference never dispatched)

`checkForRedeclaration` runs only in `SemanticsDeclRedeclarationVisitor`, which is dispatched on the transition to `DeclCheckState::ReadyForReference`. A var with no type expression goes through `deriveVarTypeFromInitExpr` (slang-check-decl.cpp ~:2702, plus :3027 and :3072 for an unsized array with an initializer), and that calls `setCheckState(DefinitionChecked)` during the SignatureChecked step. `ensureDecl` moves on from the new state, so the redeclaration visitor never runs for that decl. The check only looks at earlier same-name members, so the result depends on order:
- `{ int a = 1; let a = 2; }` is silent, but the reverse order gives E30200.
- `static const int a = 1; static const int a[] = {1,2};` is silent.
- `[UnscopedEnum]` cases are synthesized as untyped `static const` LetDecls (slang-parser.cpp ~:6123). So `static const x;` followed by an unscoped enum case `x` is silent, while the reverse order errors (#13876).

Separately, cbuffer/tbuffer members live in a synthesized `ParameterGroup_*` struct behind a `__transparent` var. Lookup expands them, so a use gives E39999 ambiguous reference, but the redeclaration walk never compares them. Verified at ToT e485e7861, 2026-10-22.
