---
title: "getEntryPointHash + link-time DownstreamArgs: fix confirms buildHash captures downstream args; Module re-hash is harmless"
type: learning
topic: ci-tooling
source: learnings/1790048442419-getentrypointhash-link-time-downstreamargs-fix-con.md
---

# getEntryPointHash + link-time DownstreamArgs: fix confirms buildHash captures downstream args; Module re-hash is harmless

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790046156351-bo4tsa
written_at: 2026-09-22T03:40:42.419Z
---

# getEntryPointHash + link-time DownstreamArgs: fix confirms buildHash captures downstream args; Module re-hash is harmless

From reviewing shader-slang/slang#13215 (fix for #13197: `getEntryPointHash` ignored link-time downstream compiler options). Fix = one line in `ComponentType::getEntryPointHash` (source/slang/slang-linkable.cpp:315): `getOptionSet().buildHash(builder);` right after the virtual `buildHash(builder)`.

Confirmed facts (verified by 3 independent review subagents + prior-learning cross-check):

1. **`CompilerOptionSet::buildHash` DOES hash `DownstreamArgs`** (the `-Xnvrtc --gpu-architecture=` link-time args `linkWithOptions` deposits into the linked component's own `m_optionSet`). This is NOT subject to the known intValue2-drop collision bug (#12270), which only affects the multi-`Int` value branch — DownstreamArgs are hashed via their string/value-kind path. The regression test (compute_75 vs compute_120 → distinct hashes) proves it empirically.

2. **The added line is a *strict* no-op only for plain `link()`/composite** (empty own `m_optionSet` → `buildHash` appends zero bytes → existing shader-cache keys byte-identical). For a plain **`Module`** it is NOT a strict no-op: `getEntryPointHash` is the single non-virtual impl shared by ALL `ComponentType` kinds, and a Module's `m_optionSet` is seeded from the linkage option set that `getLinkage()->buildHash(...)` already hashed a few lines above — so it *re-hashes* those bytes. This is harmless and deterministic: it can only add cache **misses**, never a **false hit**. Worth stating in-source (both correctness reviewer A and clarity reviewer C independently raised this as the only note — comment scopes itself to the `linkWithOptions` case but the line runs for every kind).

3. **Disclosed non-blocking limitation:** a nested `linkWithOptions` result wrapped in a *further* composite still won't contribute its own downstream args to the hash, because `CompositeComponentType::buildHash` recurses only into each child's *virtual* `buildHash`, never `child->getOptionSet()`. Self-consistent today because `getTargetProgram()` likewise uses only `this`'s own `m_optionSet`, so those nested args never reach the wrapper's codegen either — hash and behavior agree, no false-hit. A `// TODO` at `CompositeComponentType::buildHash` keeps hash+codegen in lockstep if the codegen side is ever extended.

Review-lens confirmation: this PR is the *correct* direction of the recurring "PR makes a cached value newly input-dependent ⇒ the cache key MUST include that input" flag — here the input (link-time downstream args) was already a codegen input but missing from the key.

Operational note: Reviewer B (Devin) timed out (30m, "did not reach a stable done state") even on this trivial +95/-0 diff. Devin timeouts are best-effort skips; A (correctness) + C (clarity) completing clean is sufficient to reach a verdict. Verdict issued: APPROVE_WITH_NITS.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790048442419-getentrypointhash-link-time-downstreamargs-fix-con.md`_
