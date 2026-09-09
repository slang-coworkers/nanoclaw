---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787962568165-8xi2lh
written_at: 2026-08-29T01:11:08.058Z
---

# slang#12829: removing generic-param-count tie-breaker in 202c regresses glsl operators (glsl-vs-glsl equal-rank tie)

**Context:** #12829 asks to gate off the generic-parameter-count tie-breaker in `compareOverloadCandidateSpecificity` (`slang-check-overload.cpp:2214`) for language version 202c (Approach A: wrap it in `if (!isSlang202cOrLater(this))`). The naive change builds and passes a focused ambiguity test, but **regresses `tests/language-feature/operator-overload/builtin-operator-fastpath-glsl.slang`**: `mat*mat`, `vec==vec`, `vec!=vec` become `error E39999 ambiguous call` under `-std 202c -allow-glsl`.

**The tempting-but-WRONG diagnosis:** "core exposes rank −3/−2 operators, glsl exposes rank 15; the intended 'glsl wins' is encoded in OverloadRank but is unreachable because the generic early-return at `slang-check-overload.cpp:2420-2426` skips scope-rank AND OverloadRank when either candidate is Generic/UnspecializedGeneric — so make rank reachable for generics." **This is refuted by the actual candidate set.**

**What the data actually shows (captured with slangc on the Approach-A build):**
1. For every failing call, BOTH ambiguous candidates live in `glsl.meta.slang`, same operator, same return type, differing ONLY in generic-param count (e.g. `operator*<let N>(matrix<float,N,N>,…)` @231 vs `operator*<T,let L,C,R>(matrix<T,C,L>,matrix<T,R,C>)` @255). The core component-wise operators are NOT in the surviving set (eliminated earlier on conversion cost/applicability).
2. Both candidates are FULLY SPECIALIZED (flavor Func/Expr, diagnostic prints `operator*<float,2,2,2>`) by the compare step, so the 2420-2426 early-return does NOT fire for them — OverloadRank at 2433 IS reached.
3. Both competing glsl candidates carry IDENTICAL `[OverloadRank(15)]` ⇒ rank can't break the tie.
4. conversionCostSum ties (else step 2 @2342 decides before specificity @2384).

**Behavioral probes proving reachability (202c, count gated, no source edit):** two generic overloads with DIFFERING ranks (5 vs 9) → resolves to rank 9; with EQUAL ranks (15 vs 15) → ambiguous. So OverloadRank is already consulted for specialized generics; the count block was simply the ONLY disambiguator for equal-rank generic-vs-generic overlaps pre-202c.

**Takeaway:** removing the count heuristic in 202c needs a companion core-module/language-design change (give overlapping same-operator glsl spellings DISTINCT ranks, or merge them, or implement a real structural-specificity rule: `matrix<float,N,N>` ⊂ `matrix<T,C,L>×<T,R,C>`, fixed-elem vector ⊂ general). It is NOT fixable by "rank-first for generics" and NOT absorbable by the 202c gate alone. Maintainer (tangent-vector) moved spike PR #12830 back to draft over exactly this. **General lesson: when a tie-breaker removal causes ambiguity, capture the ACTUAL surviving candidate set + each candidate's rank + flavor before theorizing about which fallback rule "should" fire — the plausible mechanism (unreachable rank) was wrong; the real one was equal ranks.**
