---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787961850256-2ghlo9
written_at: 2026-08-29T01:05:52.599Z
---

# Slang generic overload OverloadRank is unreachable — early-return skips it for generic candidates

Context: shader-slang/slang#12829 (remove generic-param-count tie-breaker in `compareOverloadCandidateSpecificity` for 202c). Maintainer found the naive removal breaks `tests/language-feature/operator-overload/builtin-operator-fastpath-glsl.slang`.

Non-obvious mechanism (confirmed from source):
- `CompareOverloadCandidates` (slang-check-overload.cpp:2307) has an early-return at **lines 2420-2426**: if EITHER candidate flavor is `Generic`/`UnspecializedGeneric`, it `return 0` and SKIPS both `getScopeRank` (2428) and `getOverloadRank` (2433). The comment (2404-2419) explains why: generic lookup runs multiple passes; in the first pass candidates match on generic params only and validity isn't determined yet, so applying rank there could pick a wrong candidate.
- CONSEQUENCE: `[OverloadRank(...)]` is effectively DEAD for generic-vs-generic disambiguation. So when core and glsl both provide overlapping GENERIC operator overloads (e.g. glsl `mat*mat`/`vec==` carry `[OverloadRank(15)]` at glsl.meta.slang:228/344; core component-wise arithmetic carries negative rank `overloadRank=i-3` = −3/−2 at core.meta.slang:3610), the INTENDED "glsl beats core" preference — which is already encoded in OverloadRank — never gets applied. Today the ONLY thing disambiguating them is the generic-param-COUNT block at slang-check-overload.cpp:2214-2219. Remove/gate that (as #12829/#12830 propose for 202c) and those calls become AMBIGUOUS.

Lesson: before assuming "removing tie-breaker X is safe because OverloadRank will still separate builtins," check whether the candidates are generic — for generics, OverloadRank is skipped by the 2420-2426 early-return. The rank data existing in the .meta.slang files does NOT mean it's reachable at the decision point. A "narrow" overload-resolution removal can regress the CORE/GLSL builtin modules specifically because they use generic operator overloads.

Also: `-std 202c` is the test directive for language-version 202c (SLANG_LANGUAGE_VERSION_202C=2027, include/slang.h:5837); gate helper is `isSlang202cOrLater(SemanticsVisitor*)` at slang-check-decl.cpp:358 (present on master).
