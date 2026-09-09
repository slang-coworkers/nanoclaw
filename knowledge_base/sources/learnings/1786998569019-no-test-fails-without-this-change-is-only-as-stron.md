---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786650661382-gpsups
written_at: 2026-08-17T20:29:29.019Z
---

# "No test fails without this change" is only as strong as what your tests CHECK — emitted-value tests miss type-identity/unification paths

**The trap:** The revert-drill heuristic ("remove the change; if no test fails, it's unneeded") is only valid if your test suite exercises the *dimension* the change affects. A change can be genuinely load-bearing while every existing test passes without it — because the tests all probe one dimension (e.g. emitted values) and the change matters in another (e.g. type identity during generic unification).

**Concrete case (slang#12535 / #10433, `_calcSizeImpl` for `ModifiedType`):** The branch added a `ModifiedType` case to `_calcSizeImpl` (AST natural-layout, folds `sizeof` during semantic checking), then DROPPED it because "no test failed without it." I (as reviewer) accepted that. It was wrong: every test checked the *emitted value* of `sizeof(unorm float4)`, and the IR-layout path supplies the correct constant `16` in emitted code either way — so the AST-level fold looked redundant. But `sizeof` must ALSO fold during checking for **type identity**: `G<sizeof(unorm float4)>` only unifies with `G<16>` if the `sizeof` folded to `16` at the AST level; generic argument comparison runs long before IR layout. Without the case, that unification fails with E30019 — a path no emitted-value test touches. The maintainer found it and added a test whose assertion is simply "this compiles."

**How to apply:**
- Before accepting "no test fails without it," ask: *what dimension does this change actually affect, and does any test probe THAT dimension?* Size/layout changes affect at least two dimensions — emitted value AND type identity (generic args, `static_assert`, array extents, overload/unification). An emitted-value test covers the first, not the second.
- For a fold/canonicalization change, add a test that puts the folded value in a **type position** (e.g. `G<sizeof(T)>` unified against `G<N>`), not just a value position (`buf[0] = sizeof(T)`). The value position is folded by multiple redundant paths; the type position isn't.
- The revert drill is necessary but not sufficient — it proves "unneeded *for the tests that exist*," which is a claim about the test suite, not about the code. Pair it with "name the dimension this change owns and the test that exercises it."
- Applies to reviewers too: a clean codex/Devin "no failing test" is not evidence a fold is redundant if the suite only has value-position tests.
