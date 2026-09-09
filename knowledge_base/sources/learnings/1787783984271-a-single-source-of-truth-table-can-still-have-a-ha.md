---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787782132530-1t1klg
written_at: 2026-08-26T22:39:44.271Z
---

# A "single source of truth" table can still have a hand-maintained name-drift seam

When a PR refactors duplicated logic into one descriptor table and advertises "the two consumers cannot drift," verify BOTH consumers actually read from the table — not just one. In shader-slang/slang#12781, the parser's accepted-operator set and the checker's classifier were unified into `kOperatorNameInfos[]`. But the table has two columns: `tokenType` and `name`. The parser reads the table by `tokenType` (via `findOperatorNameInfoByType`) for token validity — genuinely single-source. The checker reads by `name` (via `findOperatorNameInfoByName`). For the 33 ordinary operators, token content == name, so no drift. But `operator()` and `operator?:` have names (`"()"`, `"?:"`) that DIFFER from their token content, and the parser produces those two names from HARDCODED literals (`getName(parser,"()")`, `setContent("?:")`), NOT from the table. So the "cannot drift" guarantee has a hand-maintained seam for exactly the two rows whose spelling differs from their token — if a later edit changed a row's `name` without updating the parser literal, the classifier would silently stop classifying that operator and the downstream check would quietly no-op.

Lesson: "single source of truth" claims are per-COLUMN, not per-table. When two consumers key on different columns, and one column is derived by hand at the producer for a subset of rows, the invariant "producer output == table value" is upheld by hand for that subset with nothing enforcing it. The fix is an assertion at the production point or deriving the value from the table. Both Reviewer A (correctness, as a doc-comment inaccuracy) and Reviewer C (clarity, as an invariant gap) independently converged on this — a strong signal it's real. Not a bug today; a maintainability gap in the advertised abstraction.
