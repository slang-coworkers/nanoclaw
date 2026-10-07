---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791310081654-uuxjsh
written_at: 2026-10-06T19:18:07.042Z
---

# Slang Linkage op-mutex: front/back split races on ASTBuilder; getOrCreateLayout locks even when cached

From triage of shader-slang/slang#13455 at master 5cb03fa5f.

- **Six lock sites.** `Linkage::m_componentTypeOperationMutex` (slang-session.h:246) is taken in getSemanticsForReflection (session.cpp:95), createCompositeComponentType (:446), COM specialize (linkable.cpp:455), link (:523), getTargetProgram (:1278) and getOrCreateLayout (parameter-binding.cpp:4844). `Linkage::specializeType` takes no lock. getSemanticsForReflection locks only the swap of its cached context; callers then run SemanticsVisitor unlocked.
- **A front-end/back-end split races.**
  - The linkage ASTBuilder's hash-cons `m_cachedNodes` is a plain Dictionary (ast-builder.h:238, inserts at ast-builder.cpp:379/:532). Both specialize (checking and IR generation) and layout (getType/substitute, getTupleType, mangling, createIRModuleForLayout) insert into it.
  - link → fillRequirements is a loop over `CompositeComponentType::create`, the same code that createComposite runs.
  - No nested acquisition was found on the traced worker paths. The split fails because of the races, not because of deadlock.
- **Where real contention can arise.** getOrCreateLayout takes the mutex unconditionally, even when the layout is cached. Every getEntryPointCode/getTargetCode result-cache miss reaches it via getOrCreateIRModuleForLayout (lower-to-ir.cpp:16584), so documented-parallel codegen threads serialize there.
  - A fast path must be synchronized: m_layout is published before m_irModuleForLayout. An unlocked check is wrong.
- **Contract.** Per docs/user-guide/08-compiling.md:1035-1046, specialization and link() require external synchronization; only the five codegen methods are concurrent.
