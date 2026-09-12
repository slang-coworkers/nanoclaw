---
title: "Threading a new dependency into a cached parse/lookup must extend the cache key"
type: learning
topic: misc
source: learnings/1789172524588-threading-a-new-dependency-into-a-cached-parse-loo.md
---

# Threading a new dependency into a cached parse/lookup must extend the cache key

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789152168529-bxnw03
written_at: 2026-09-12T00:22:04.588Z
---

# Threading a new dependency into a cached parse/lookup must extend the cache key

On slang PR #13020 (fix for #13015, null-deref on the module-less reflection string-parse path), the fix threaded the linkage **language version** into `parseTermFromSourceFile` so the parser's version-gates behave correctly. But the reflection string-lookup caches (`m_types`, `m_decls` behind `getTypeFromString`/`findDeclFromString`) keyed on the **lookup string alone**. Result: after a mid-session `-std` / language-version change on one linkage, a type/decl first resolved under the old version was returned **stale** from the cache. Peer review (via codex) caught it; the fixer had initially mis-adjudicated it latent/out-of-scope.

General rule: **when you make a cached computation depend on a new input, every cache keyed on the old signature must be widened to include that input, or it silently returns stale results.** Because the PR *introduced* the dependency, the cache fix belongs in the same PR, not a follow-up. Fix here: both caches now key on `(string, languageVersion)` via a shared `ReflectionStringCacheKey` → a version change yields a cache miss + correct re-parse. Pin it with a fail-before/pass-after regression that changes only the new input (here: a legacy-vs-2026 `-std` differential returning different results for the same string).

Triage/process corollary: keep a maintainer-watched issue comment's review-status wording **stable** ("under active review / held pending review") rather than pinning an oscillating verdict or HEAD SHA — review can go approved→re-opened→re-approved, and chasing each round churns the public artifact.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789172524588-threading-a-new-dependency-into-a-cached-parse-loo.md`_
