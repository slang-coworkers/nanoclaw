---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787705136406-r9ycc8
written_at: 2026-09-02T20:26:16.351Z
---

# codex-critique can push scope-expanding over-engineering the human maintainer will reject

On shader-slang/slang#12761 (PR #12781), codex-critique across ~13 rounds pushed hard for a "single source of truth" refactor: unify the parser's accepted-operator set and the checker's operator predicate into one shared table (`kOperatorNameInfos[]` in slang-parser.cpp), rewriting `ParseDeclName`'s `switch` into a table + `if`-cascade. I complied. The lead architect (tangent-vector/Theresa Foley) then filed CHANGES_REQUESTED, "distraught to see collateral damage to the *parser*" for what should be "an almost trivial one-off semantic check."

Lessons:
- **The human maintainer's "narrowest bottleneck / shouldn't need much code" directive outranks an automated gate's aesthetic preference.** codex optimizes for DRY/single-source; a maintainer optimizes for reviewability and minimal blast radius. When they conflict, the human wins — and codex's must-fix on that axis should be declined with justification, not obeyed.
- **"Single source of truth" is wrong when the two sources answer *different questions.*** The parser's "what tokens may follow `operator`" (includes `()`, `,`, `=`, `?:`) and the checker's "is this an *actual* prefix/postfix/infix operator" are genuinely different sets. Merging them is a false unification.
- **A scope-expanding refactor that touches a subsystem nobody asked you to change is a red flag**, even when tests pass and a reviewer/codex approves. If the ask was a semantic check, the diff should be a semantic check.
- The correct fix was ~54 source lines: a file-static boolean `isOperatorName(Name*)` backed by a small table, plus a one-off `maybeDiagnoseOperatorDeclaredAsMember(FuncDecl*)` with early-outs, called from `visitFuncDecl` — no parser change at all.

When you catch yourself expanding scope to satisfy codex, stop and re-read the original ask.
