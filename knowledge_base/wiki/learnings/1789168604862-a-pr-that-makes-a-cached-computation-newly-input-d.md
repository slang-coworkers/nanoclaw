---
title: "A PR that makes a cached computation newly input-dependent must update the cache key — and don't downgrade a flag to 'latent' without checking the trigger is unsupported"
type: learning
topic: misc
source: learnings/1789168604862-a-pr-that-makes-a-cached-computation-newly-input-d.md
superseded_by: 1789172524588-threading-a-new-dependency-into-a-cached-parse-loo
---

# A PR that makes a cached computation newly input-dependent must update the cache key — and don't downgrade a flag to "latent" without checking the trigger is unsupported

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789160581074-cmio19
written_at: 2026-09-11T23:16:44.862Z
---

# A PR that makes a cached computation newly input-dependent must update the cache key — and don't downgrade a flag to "latent" without checking the trigger is unsupported

Two linked review lessons from shader-slang/slang#13020 (reflection null-`currentModule` crash fix), caught by the codex DECISION_REVIEW gate after I under-rated a Devin finding.

**1. New input-dependence ⇒ the cache key must include that input.** The PR threaded the session language version (`m_optionSet.getLanguageVersion()`) into the module-less parse (`parseTermFromSourceFile`) so version-gated parsing works on the reflection path. But `ComponentType::getTypeFromString` caches results in `m_types` keyed on the **type string only** and returns the cached entry *before* consulting the version (`source/slang/slang-linkable.cpp:832`, key set at `:860`). Pre-PR this key was correct because the parse did NOT depend on the version; the PR *introduces* the omitted dependency, so `findTypeByName(sameString)` on one linkage under legacy caches `float`, and after a version switch returns that stale type instead of re-parsing under the new version. Root-cause layer = the cache key (`(typeStr, effectiveLanguageVersion)` or invalidate on version change), exactly where the new dependency lands. General rule when reviewing: **if a diff makes a previously-input-independent memoized/cached value newly depend on some state X, grep for every cache of that value and confirm X is in the key.**

**2. Don't downgrade a flagged issue to "latent / unusual usage / not-a-blocker" until you've checked whether the triggering scenario is actually supported/tested.** I initially dismissed the "change language version mid-session on the same linkage" trigger as unusual. Codex found `tools/slang-unit-test/unit-test-function-reflection.cpp:328` `reflectionRefreshesChangedLanguageVersion` — which applies `{"-std","202c"}` to the same request *after* reflection and explicitly verifies reflection refreshes the changed version. So the trigger is a **supported, tested** pattern, which flips the finding from "latent nit" to a definite reachable must-fix. Before writing "latent/edge-case/won't-happen," grep tests/docs for the scenario — an existing test that exercises it is proof it's supported.

**3. Note on the inconsistency smell:** the sibling `m_semanticsForReflection` IS rebuilt on version change (`slang-session.cpp` ~93-97) while `m_types` is not — a "one cache is version-aware, its neighbour isn't" split is a strong signal the non-aware one is a stale-result bug, not an intentional design.

**Process:** the critique gate ("[Resolution]" message requires a codex critique) is what caught my over-optimistic "merge-ready" close. Honor it *before* sending verdict/resolution messages, not after — codex's independent read surfaced the deciding test that my three-reviewer pass + my own source read had both missed (correctness REVIEW.md scopes to the diff, so it didn't flag pre-existing cache code that the diff made newly-relevant; Devin flagged it but I under-weighted it).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789168604862-a-pr-that-makes-a-cached-computation-newly-input-d.md`_
