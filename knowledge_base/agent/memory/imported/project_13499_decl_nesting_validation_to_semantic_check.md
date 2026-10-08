---
type: project
name: project_13499_decl_nesting_validation_to_semantic_check
description: "slang#13499 (tangent-vector, self-assigned, Dev Opened, 10-07 20:51Z): refactor proposal — move isDeclAllowed decl-nesting validation out of slang-parser.cpp into semantic checking, classify by AST subclass/range instead of exact ASTNodeType, dispatch block-statement decl keywords via SyntaxDecl lookup. Third of the #13495/#13496/#13497 family. Routed to slang-triager as investigation-only, NO fixer (maintainer-owned design)."
metadata:
  node_type: memory
  type: project
---
**2026-10-07 20:5xZ.** Live read before dispatch: OPEN, 0 comments, human-filed by tangent-vector,
self-assigned, label `Dev Opened`, live body = payload. Not bot-filed. Only session on
`gh-issue-shader-slang/slang-13499` was this Main webhook session; no `ncl tasks` hit.

Family: #13495 (HLSL class as value type) → fix PR #13497 (`codex/hlsl-class-value-type`, open,
review requested from dshreiner-nv) adds `getDeclTypeForNestingValidity`, the stopgap that maps
`StructDecl` subclasses to `StructDecl` in `isDeclAllowed` — this issue is its principled
replacement. #13496 (struct/class body-grammar unification) is a separate chain with its own triager
session ([[project_13496_unify_struct_class_parsing]]). #13498 has its own Main session; not routed here.

Dispatched to `slang-triager` on thread `gh-issue-shader-slang/slang-13499`: read-only triage —
inventory `isDeclAllowed` callers and the exact-kind tables, the block-parser decl-keyword
allow-list vs `SyntaxDecl` registration, language-server recovery dependencies, overlap with #13496
and #13497; post the 5-bullet. No fixer, following the #13496/#13306 precedent.

RESUME: triager report, a tangent-vector reply/go-ahead (webhook), or #13497 merging (changes the
`isDeclAllowed` baseline).

20:56Z triager ack: read-only triage started at master 649a6f83b; will compare against #13497 head e809e14bf3. Awaiting report.

**22:02Z triage report (triager's finding; spot-checked at master 649a6f83b).** Comment 6047731328 is live
(nv-slang-bot, 2619 chars). P3 enhancement, frontend refactor. A second validator already exists:
checker `validateDeclNesting` (check-decl.cpp:317, from #10456, subclass-based, E31400). It skips decls
that the parser's `isDeclAllowed` (parser.cpp:5550, exact-kind, default-allow) has already marked
`nestingAlreadyDiagnosed`. The triager prototyped with the parser checks off (reverted):
- 9 diagnostics tests plus 1 language-feature test change only code/message text.
- 0 changes in hlsl, language-server or bugs.
- Gaps the checker table accepts silently: `__generic<T>` var/property, `using` in a struct,
  `module`/`implementing` in a namespace, interface typealias.
- `__constraint` in a struct becomes fatal E40002.
- E30102 is a parse error that halts compilation at compile-request.cpp:833.
- struct/class/enum have no SyntaxDecl (hard-coded type specifiers).
The new #13497 test class-invalid-nesting.hlsl pins the E30102 text. #13497 head moved to 07898b0a8.
PARKED on tangent-vector's decision. Re-chase task `rechase-13499-maintainer-0d5c` fires 2026-10-21 17:00Z.
