---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787961850256-2ghlo9
written_at: 2026-08-29T01:14:00.183Z
---

# CORRECTION - Slang 12829 glsl regression is equal-rank redundant spellings, not unreachable OverloadRank

CORRECTS my earlier learning "Slang generic overload OverloadRank is unreachable — early-return skips it for generic candidates" (shader-slang/slang#12829). That earlier note's MECHANISM was right in general but WRONG as the cause of the #12829 glsl regression. Empirical candidate-set capture (fixer's instrumented build) + source verification refuted it:

- The surviving ambiguity in `tests/language-feature/operator-overload/builtin-operator-fastpath-glsl.slang` under the 202c count-removal is **glsl-vs-glsl at IDENTICAL `[OverloadRank(15)]`** — two spellings of the SAME operator in glsl.meta.slang differing only in generic-param count:
  - `mat*mat`: `operator*<let N>(matrix<float,N,N>,...)` glsl.meta.slang:231 (1 generic param) vs `operator*<T,let L,C,R>(matrix<T,C,L>,matrix<T,R,C>)` :255 (4 params) — both `[OverloadRank(15)]`.
  - `vec==vec`: `operator==<let N>(vector<float,N>,...)` :396 (1 param) vs `operator==<T:__BuiltinArithmeticType,let N>(vector<T,N>,...)` :344 (2 params) — both rank 15.
- Both candidates are FULLY SPECIALIZED (Func/Expr flavor) at the compare step, so the generic early-return at slang-check-overload.cpp:2420-2426 does NOT fire — control DOES reach getOverloadRank at 2433. Behavioral probes (202c, count gated): ranks 5-vs-9 resolve (rank IS consulted for specialized generics); ranks 15-vs-15 → ambiguous E39999. The core component-wise operators (rank −3/−2) are eliminated BEFORE specificity, so they never enter the tie.

So "make OverloadRank reachable for generics" is a NO-OP for this case: it's already reached and both ranks are equal. The real root cause is REDUNDANT same-operator glsl spellings (a broad general form + a narrower specialized form) that were previously separated ONLY by the now-removed generic-param-count heuristic.

Fix requires a genuine language-design/core-module change, NOT absorbable by the 202c gate:
(1) give the overlapping glsl spellings DISTINCT OverloadRanks (narrower ranks higher) or merge the redundant spellings; OR
(2) implement the real structural-specificity rule ("A applicable ⇒ B applicable"): `matrix<float,N,N>` ⊂ `matrix<T,C,L>×matrix<T,R,C>`, fixed-elem `vector<float,N>` ⊂ general `vector<T,N>` — the deferred larger work #12829 explicitly scopes OUT.

Meta-lesson: the early-return-blocks-rank theory was a plausible mechanism that happened not to be the actual cause — VERIFY the candidate set empirically (which decls survive to the compare step, their flavor, their ranks, whether conversionCostSum already ties) before asserting a root cause for an overload-resolution ambiguity. The right question isn't "is rank reachable?" but "are the surviving candidates' ranks equal, and why do two spellings both survive?"
