---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787657146083-01r83l
written_at: 2026-08-25T11:36:48.750Z
---

# CoerceToProperType null-vs-ErrorType: fix the wrapper, not tryCoerce

When triaging/fixing the "CheckProperType should yield ErrorType not null on failure" cleanup (shader-slang/slang#12730, split from PR #12596), the key non-obvious findings (verified vs source at HEAD 4be7850811):

1. **There are THREE failure representations in `CoerceToProperTypeImpl` (source/slang/slang-check-type.cpp:271-462), not two.** The issue names null-vs-ErrorType, but reading source: (a) ExpectedAType branch sets `*outProperType = nullptr` (:325); (b) generic-needs-args branches set `m_astBuilder->getErrorType()` (:360/372/385, but only inside `if(diagSink)`); (c) generic-constraint branches (:404-432) `return false` WITHOUT touching the out-param — leaving the caller's `result.type` as a stale, non-null non-error generic type. Don't trust the issue's framing; enumerate the branches yourself.

2. **The blast-radius fear the issue raises is neutralized by scope.** `tryCoerceToProperType` (:471-477) returns `TypeExp()` (fully null) on ANY failure regardless of the out-param, and passes `diagSink=nullptr`. Overload resolution (overload.cpp, linkable.cpp) relies on null == "candidate not viable, discard silently". So the fix must target ONLY the diagnostic path (`CoerceToProperType`/`CheckProperType`) and LEAVE `tryCoerceToProperType` returning null. This also dodges the "null means not-yet-checked" collision, because that transient state lives on the try/probe path.

3. **Cleanest fix = normalize at the `CoerceToProperType` wrapper (:464-469) on the bool `CoerceToProperTypeImpl` already returns but the wrapper currently ignores** — `if (!Impl(...)) result.type = getErrorType();`. One source of truth, collapses all three internal shapes, ~2 lines. (Patching only the one branch doesn't deliver "always ErrorType"; patching every Impl branch is complementary but larger.)

4. **House convention:** failure sentinel is `ErrorType`, detected via `as<ErrorType>(type)` — there is NO `isErrorType` free helper. `TypeExp::operator bool` tests `.type != nullptr`, so `if (typeExp)`/`if (!x)`/`if (x.type)` are all null-tests.

5. **The one real behavior-change caller** when null→ErrorType: `slang-check-expr.cpp` `if (!dataLayoutType || !witness)` (~:6656/6670) — the `!dataLayoutType` guard is defeated by a truthy ErrorType; confirm the failure is still diagnosed. Most other callers either already check ErrorType (newly correct) or are unguarded (made safer, avoids null-deref).
