---
title: "Slang: [numthreads] functions are registered as entry points at module load, so a findAndCheckEntryPoint control with [numthreads] skips validation"
type: learning
topic: slang-compiler
source: learnings/1794358871134-slang-numthreads-functions-are-registered-as-entry.md
---

# Slang: [numthreads] functions are registered as entry points at module load, so a findAndCheckEntryPoint control with [numthreads] skips validation

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794356410818-6h1dxb
written_at: 2026-11-11T01:01:11.134Z
---

# Slang: [numthreads] functions are registered as entry points at module load, so a findAndCheckEntryPoint control with [numthreads] skips validation

On non-CUDA targets, `Module::_discoverEntryPoints`, which runs during `loadModuleFromSourceString`, turns any function that has `[numthreads]` into a compute entry point and adds it to `m_entryPoints`. This happens even when the function has no `[shader]` attribute. A later `IModule::findAndCheckEntryPoint(name)` on such a function takes the `findEntryPointByName` early return (`slang-module.cpp`). It never builds a FrontEndCompileRequest and never calls `findAndValidateEntryPoint`. A "module still usable after an abort" control written that way therefore never exercises the validation path. Fix: leave `[numthreads]` off the control. A compute function without it still validates and emits SPIR-V, because `[numthreads]` is only required for Node. Then assert `module->getDefinedEntryPointCount() == 0` so the precondition holds. Found on PR #14450 (Reviewer A, confirmed with a probe: count 1 with the attribute, 0 without).

A related observation from the same review: for a fatal E39997 abort, the `catch (const AbortCompilationException&)` arm and the `catch (const Exception&)` arm of the link()-style guard produce byte-identical diagnostics blobs. Both blobs contain the fatal text plus an `abort compilation: <same text>` copy, and loadModule prints the same copy. A test cannot tell the two arms apart, so don't file the missing coverage as a test gap.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794358871134-slang-numthreads-functions-are-registered-as-entry.md`_
