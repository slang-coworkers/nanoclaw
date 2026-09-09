---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786587844944-jrx6gf
written_at: 2026-08-13T03:56:11.517Z
---

# slang#12519 round-2: construction-only carve-out fixes the class identity-cast regression AND a latent new C(c) miscompile

Follow-up to the round-1 learning "Class identity cast (C)c / C(c) regresses when ClassDecl excluded from ResolveInvoke coercion fast-path". Round-2 head 63d154f3aa replaces the blanket `class` exclusion with:

  isClassConstruction = isDeclRefTypeOf<ClassDecl>(targetType)
                        && (as<NewExpr>(expr) || !targetType->equals(expr->arguments[0]->type));
  if ((isDeclRefTypeOf<AggTypeDeclBase>(targetType) && !isClassConstruction) || isDeclRefTypeOf<EnumDecl>(targetType)) { /* coercion fast-path */ }

Verified empirically (built PR head, Release slangc, emitted-C++ inspection + baseline diff — no slangi in this checkout so used -target cpp emitted code as source of truth):
- (C)c / C(c) where c is already C → identity no-op, value preserved (my round-1 regression FIXED). Emitted: `C_get_0(C_x24init_0())`, no spurious ctor.
- new C(4) → constructs (#12485 ICE fix intact).
- bare C(4) and (C)4 (non-class arg) → clean E30066, no ICE.
- new Box(orig) with user `__init(Box other){v=other.v+1000}` → now CALLS the copy ctor (emitted `Box_x24init_1(...)`, value 1005). On UNFIXED master this SILENTLY FOLDED to identity (value 5, dropping the user copy ctor) — a latent miscompile this PR also fixes. This is the bug codex CODE_REVIEW caught in the fixer's first narrowing attempt; the `as<NewExpr>` disjunct (a `new` is ALWAYS construction) is what fixes it.
- struct/enum/generic-T(x) paths unaffected (controls).

Pre-existing, out-of-scope: bare `Box(orig)` (same-type, non-new, with `__init(Box)`) folds to identity (value 5), ignoring the user copy ctor — but UNFIXED does the same, so not introduced by this PR.

Devin scrape gotcha (round 2): Devin's "Bugs" list still showed "Casting an object of a class type to a class type stops compiling" — a STALE/lagging entry. Devin's own fresh AI analysis (same page) explicitly stated "(C)c and C(c) compile and preserve the value", contradicting its own Bugs entry. Cross-check a scraped reviewer's flag list against its own analysis prose + your empirical result before treating a flag as live. Devin's separate "Semantic change to new C(x)" (Investigate) flag was correct-but-benign: it's the intended new-C(c)-constructs improvement, not a regression.

Verdict: round-2 fix is correct; APPROVE. The `equals()` disjunct introduced no new regression.
