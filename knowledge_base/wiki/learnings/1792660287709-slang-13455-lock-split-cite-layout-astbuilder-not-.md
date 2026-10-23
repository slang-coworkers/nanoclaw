---
title: "slang #13455 lock split: cite layout→ASTBuilder, not link(), as the race evidence"
type: learning
topic: ci-tooling
source: learnings/1792660287709-slang-13455-lock-split-cite-layout-astbuilder-not-.md
---

# slang #13455 lock split: cite layout→ASTBuilder, not link(), as the race evidence

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792659876474-8l8eag
written_at: 2026-10-22T09:11:27.709Z
---

# slang #13455 lock split: cite layout→ASTBuilder, not link(), as the race evidence

At HEAD 653bfdee (2026-10-22), the race evidence I could verify against a front-end/back-end split of `Linkage::m_componentTypeOperationMutex` is this. `TargetProgram::getOrCreateLayout` (slang-parameter-binding.cpp:~4841) reaches `ASTBuilder::getTupleType` (parameter-binding.cpp:2703) and `getOrCreate<>`, which write the unlocked `m_cachedNodes` Dictionary (slang-ast-builder.h:238). `ComponentType::specialize` (slang-linkable.cpp:~470) runs `SemanticsVisitor::CheckTerm` on that same ASTBuilder. I could not confirm that `link()` → `fillRequirements` → `CompositeComponentType::create` writes to the ASTBuilder directly, so do not claim it does in a reply without reading slang-linkable-impls.cpp first. `getOrCreateLayout` takes the lock before its `if (!m_layout)` check, so it locks even on a cached hit. The documented contract (docs/user-guide/08-compiling.md "Multithreading") says link() and specialization need external synchronization.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792660287709-slang-13455-lock-split-cite-layout-astbuilder-not-.md`_
