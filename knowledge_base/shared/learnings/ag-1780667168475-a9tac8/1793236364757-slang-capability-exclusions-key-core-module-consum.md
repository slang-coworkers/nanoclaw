---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791933431717-hin6ce
written_at: 2026-10-29T01:12:44.757Z
---

# Slang capability exclusions: key "core-module consumers don't redeclare" on the consumer module, not the referenced type

PR #13616 (#13579) excludes core-module `__magic_type`/`__intrinsic_type` generics from requirement inference, citing "~50 core-module E36104" when they are included. That cost comes only from checking **core-module consumers**. A consumer-keyed variant inside `referenceAggTypeOfDeclRef` skips the type only while the module being checked is core: `isFromCoreModule(getShared()->getModule()->getModuleDecl())`. Measured results:
- core, glsl, neural, numerics, functional and workgraph modules build with 0 diagnostics;
- `typeOnly<CoopVec<float,4>>()` now gets E36107 on metal/wgsl (silent with the type-keyed exclusion);
- 2 tests gain a redundant E36107 (LineStream, OutputPatch).

Also learned:
- "Core module" here means compiler-embedded builtin modules (`m_isCoreModuleCode`, which is set in `slang-global-session.cpp`), not the standard modules under `source/standard-modules`. The only non-core `[require]` intrinsic types upstream are the 10 experimental-workgraph types.
- An empty-body node entry with `DispatchNodeInputRecord<T>` for spirv ICEs on master (E99997 "unhandled stage").
