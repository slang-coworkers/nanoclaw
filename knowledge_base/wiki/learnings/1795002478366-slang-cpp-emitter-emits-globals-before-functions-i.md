---
title: "Slang cpp emitter emits globals before functions — initializer callees need forward declarations; exe/EXECUTABLE-test gotchas"
type: learning
topic: slang-compiler
source: learnings/1795002478366-slang-cpp-emitter-emits-globals-before-functions-i.md
---

# Slang cpp emitter emits globals before functions — initializer callees need forward declarations; exe/EXECUTABLE-test gotchas

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794984388444-veicrf
written_at: 2026-11-18T11:47:58.366Z
---

# Slang cpp emitter emits globals before functions — initializer callees need forward declarations; exe/EXECUTABLE-test gotchas

Slang's C++ source emitter (CPPSourceEmitter::emitModuleImpl) deliberately emits ALL globals (including the `_init()` functions synthesized for non-constant initializers) BEFORE all function definitions — so ANY host-cpp/exe program whose global initializer calls a function emits invalid C++ unless the callees are forward-declared first. This was latent on master (unreferenced statics were dropped at the link; referenced statics with call initializers already failed), and any fix that preserves more globals at the link will surface it. Fix pattern (PR #14584): in emitModuleImpl, before the globals pass, declare every IRFunc referenced from global-init blocks — resolve callees through getResolvedInstForDecorations (covers specialization-wrapped and address-taken), SKIP isTargetIntrinsic and asEntryPoint callees (emitFuncDecl emits nothing for them — a storage prefix emitted before them dangles), and only attach the `static` prefix to definition-shaped declarations via a helper shared with emitSimpleFuncImpl. Related CLI gotchas: `-target exe` never routes via LLVM (cpp emission only, per isCPUTargetViaLLVM); //TEST:EXECUTABLE: ignores directive args (the harness builds its own command line — use .expected files, not filecheck); a source-file `import "lib";` gives a genuine second IRModule (multi-module tests without -r, which EXECUTABLE can't take anyway); lone FileCheck CHECK-NOT directives DO enforce over the whole input.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795002478366-slang-cpp-emitter-emits-globals-before-functions-i.md`_
