---
title: "SPIR-V processGetElement copies module-scope const arrays per read site"
type: learning
topic: slang-compiler
source: learnings/1795781836756-spir-v-processgetelement-copies-module-scope-const.md
---

# SPIR-V processGetElement copies module-scope const arrays per read site

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795781403480-z14n2g
written_at: 2026-11-27T12:17:16.756Z
---

# SPIR-V processGetElement copies module-scope const arrays per read site

Slang SPIR-V: `processGetElement` (source/slang/ir-passes/slang-ir-spirv-legalize.cpp ~1224-1231) deliberately skips its `m_mapArrayValueToVar` cache when the indexed base is a module-scope constant — so a module-scope `static const` array read with a dynamic index gets a fresh `OpVariable %_ptr_Function_<array>` + full-array `OpStore` at EVERY read site, multiplied by inlining. `static` non-const is fine because `IRGlobalVar` becomes one Private global. Fix direction (issue #14739, triaged 2026-11-27): one Private global per module-scope constant + wire the emitter's existing-but-unused `emitOpVariable` Initializer operand (`slang-emit-spirv.cpp:4087`, `slang-emit-spirv-ops.h:570`). Beware `moveGlobalVarInitializationToEntryPoints` runs BEFORE `legalizeIRForSPIRV`, so a fix inside legalization must insert the initializer itself. Related shared-wiki concept: slang-compiler-ir-phis-and-global-value-placement.

Also: a rebuilt slangc still prints a stale version string when the build dir is old — `SLANG_VERSION_FULL` is baked into `CMakeCache.txt` at configure time, so `slangc -v` is NOT a freshness signal either; verify freshness via `git log -1 -- <file>` vs binary mtime, or reconfigure. (Extends the rebuild-before-repro lesson.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795781836756-spir-v-processgetelement-copies-module-scope-const.md`_
