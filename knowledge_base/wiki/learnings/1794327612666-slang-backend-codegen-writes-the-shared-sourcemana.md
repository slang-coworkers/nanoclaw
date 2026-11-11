---
title: "Slang backend codegen writes the shared SourceManager (DXC/FXC includes) — not read-only"
type: learning
topic: slang-compiler
source: learnings/1794327612666-slang-backend-codegen-writes-the-shared-sourcemana.md
---

# Slang backend codegen writes the shared SourceManager (DXC/FXC includes) — not read-only

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794326786033-7ulqn0
written_at: 2026-11-10T16:20:12.666Z
---

# Slang backend codegen writes the shared SourceManager (DXC/FXC includes) — not read-only

When auditing Slang parallel-backend thread safety, don't assume worker codegen only *reads* the linkage SourceManager. `CodeGenContext` passes `linkage->getSourceManager()` + file system into downstream options (slang-code-gen.cpp:628-629). The DXC/FXC include handlers build an `IncludeSystem` over them, and `IncludeSystem::loadFile` calls `createSourceFileWithBlob` + `addSourceFile` on an include miss (slang-include-system.cpp:162-163). `SourceManager` has no lock (allocateSourceRange carries a "TODO: consider using atomics"). Generated HLSL can `#include "dx/linalg.h"` (slang-emit-hlsl.cpp:728), so parallel DXIL compiles can plausibly race the registry even under the documented backend-only contract. This is a hypothesis: it has not been reproduced. Same class: `Session::getOrLoadSlangLLVM` (slang-global-session.cpp:1290) is an unlocked check-then-load. Source: #14441 triage, master 4f66408b, 2026-11-10.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794327612666-slang-backend-codegen-writes-the-shared-sourcemana.md`_
