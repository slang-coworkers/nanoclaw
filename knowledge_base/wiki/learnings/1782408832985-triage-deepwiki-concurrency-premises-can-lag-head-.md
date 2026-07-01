---
title: "Triage/DeepWiki concurrency premises can lag HEAD — verify mutex sites in source before accepting 'X is unsynchronized'"
type: learning
topic: agent-ops
source: learnings/1782408832985-triage-deepwiki-concurrency-premises-can-lag-head-.md
---

# Triage/DeepWiki concurrency premises can lag HEAD — verify mutex sites in source before accepting "X is unsynchronized"

On shader-slang/slang#11759 (parallelGenericEntryPointCompile flaky test-server crash), the triage memo AND DeepWiki both stated the FRONTEND (`specialize`/`createCompositeComponentType`/`link` on a shared `ISession`) was unsynchronized and therefore the likely race; the recommended diagnose-first plan was an ASan/TSan repro of that frontend race.

Reality at HEAD a7fbf1ab0: the frontend was **already serialized**. `ComponentType::specialize` (slang-linkable.cpp:400), `::link` (:465), `::getTargetProgram` (:1203), `Linkage::createCompositeComponentType` (slang-session.cpp:371), and `getOrCreateLayout` (slang-parameter-binding.cpp:4401) each take `Linkage::m_componentTypeOperationMutex` (a `std::recursive_mutex`, slang-session.h:246), with code comments stating the intended model verbatim: **"serial frontend, parallel backend."** The real residual race had moved to the **unguarded backend codegen** (`getEntryPointCode → _createEntryPointResult → emitEntryPoints → linkAndOptimizeIR → linkIR`), which runs with NO operation mutex — only the per-result publish is under `m_resultCacheMutex` (#10792). `linkIR`/`prelinkIR(Module*…)` does cross-module symbol resolution + generic specialization over the shared Linkage+module.

**Why / lesson:** On fast-moving concurrency / thread-safety work, DeepWiki and even a same-day triage memo can describe an OLDER tree. Before accepting any "component X is unsynchronized → that's the race" framing, `grep -rn` the actual lock-acquisition sites at HEAD (here: `getComponentTypeOperationMutex`) to map the *complete* serialization surface. A cheap diagnose-first source read caught the inverted premise BEFORE building — it would otherwise have wasted a ~9-10G ASan build chasing a frontend race that no longer exists. Also: a "crashing test server" flaky from a non-thread-safe in-tree container (Dictionary/List realloc) manifests as heap corruption that ASan catches; Slang refcounts are atomic (slang-smart-pointer.h:21), so concurrent AddRef/Release is rarely the race.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782408832985-triage-deepwiki-concurrency-premises-can-lag-head-.md`_
