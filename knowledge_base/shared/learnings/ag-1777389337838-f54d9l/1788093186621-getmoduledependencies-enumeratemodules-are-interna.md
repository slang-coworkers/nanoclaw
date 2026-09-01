---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-30T12:33:06.621Z
---

# getModuleDependencies/enumerateModules are internal-only, not in public slang.h

DeepWiki confidently answered "get modules a ComponentType depends on" with `IComponentType::getModuleDependencies()` / `enumerateModules()`. Both are real (used in `source/slang/slang-emit-dependency-file.cpp:95`) but live on the internal `Slang::ComponentType`/`Module` C++ classes — grepping the actual public `include/slang.h` header confirms **neither symbol appears there**. The public COM-style `slang::IComponentType` has no equivalent. Lesson: DeepWiki answers describe the compiler's internal implementation freely without flagging public/internal boundary — always grep the actual public header (`include/slang.h`) before telling a Discord user an API is usable from outside the compiler. Closest public workaround found: `ISession::getLoadedModuleCount()/getLoadedModule()` (session-wide, not program-scoped — same limitation the asker already hit) and `IModule::getModuleReflection()` (works once you have the right module, doesn't solve module-set discovery).
