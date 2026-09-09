---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786446114116-j2ecsv
written_at: 2026-08-11T15:16:13.054Z
---

# Slang thread_local PerformanceProfiler is NOT a usable per-invocation timing surface

When triaging a request for per-compilation timing attributable to one `IComponentType::getEntryPointCode` call (shader-slang/slang#12472), DeepWiki asserted the existing `thread_local` `PerformanceProfiler` (`SLANG_PROFILE` / `getProfiler()`) "already supports attributing timing to a single compilation invocation". This is FALSE for the modern API, on two independent grounds verified at master ec47ea72b:

1. **Unreachable from the modern API.** `ISlangProfiler` is declared in `include/slang.h:2009` but has ZERO accessors there (`ISlangProfiler**` count in slang.h = 0). Its only getter, `getCompileTimeProfile`, is on the DEPRECATED `ICompileRequest` (`include/slang-deprecated.h:1699`). Control: `ISlangProfiler**` in slang-deprecated.h = 2.

2. **Its per-invocation correctness depends on `clear()`, which never fires on the component-type path.** `PerformanceProfiler::getProfiler()->clear()` occurs at exactly `slang-end-to-end-request.cpp:1909` and `:2124` — i.e. only inside `EndToEndCompileRequest::compile()` (the slangc/CLI path). The `IComponentType::getEntryPointCode` path (what a host like slang-rhi uses) never clears it, so a shared thread would accumulate across invocations.

Also: backend-codegen `SLANG_PROFILE` coverage is thin — 0 in `slang-code-gen.cpp`, 2 in `slang-emit.cpp` (`linkAndOptimizeIR`, `emitEntryPointsSourceFromIR`).

Meta-lesson: a DeepWiki "the architecture already supports X" claim is exactly the shape that would mislead a maintainer into rejecting a valid API request. Test it: (a) is the accessor in the CURRENT public header or only in slang-deprecated.h? (b) does the lifecycle hook it depends on (here `clear()`) actually fire on the caller's code path? Both are one grep each and both flipped the answer.

Bonus verified facts for this issue class: `ICompileResult` already derives from `ISlangCastable` (slang.h:5284), and `ICoverageTracingMetadata : public ISlangCastable` (slang.h:4971) is a SHIPPED precedent for the "castable interface off the artifact" API shape, with the versioning policy spelled out at slang.h:4805-4818 (tail-extend a structSize-gated struct, OR add a derived `...N` interface with a new UUID via castAs). The global compiler-time counters (`m_totalCompileTime`/`m_downstreamCompileTime`, slang-global-session.h:391-392) are per-global-session, and the torn `total-downstream` is a 3-vs-1 asymmetry: one total adder (`CompileTimerRAII` dtor, slang-code-gen.cpp:1242) scoped over three nested downstream adders (slang-code-gen.cpp:1047, slang-emit.cpp:3517, slang-artifact-output-util.cpp:72).
