---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794351577414-d905d6
written_at: 2026-11-10T23:14:54.547Z
---

# Slang SLANG_NO_THROW boundary-guard census (#14448)

At master 56ff2a8338, 6 of 31 public SLANG_NO_THROW methods on IComponentType/IComponentType2/IEntryPoint/IModule have no catch on a path that can throw. getLayout, findAndCheckEntryPoint and getTargetHostCallable each leak AbortCompilationException when given a 127-level struct chain (fatal E39997). getTargetHostCallable goes around the guarded getTargetArtifact and calls getOrCreateWholeProgramResult directly. The other three are specialize, serialize and writeToFile.

The guard to copy is ComponentType::link (slang-linkable.cpp:548-574): `SLANG_EXCEPTION_TRY` plus `#if SLANG_HAS_EXCEPTIONS` arms (AbortCompilationException / Exception / ...) that call outputExceptionDiagnostic. Do not copy the plain `try` from the PR #12552 diff. PR #13244 replaced it so that exceptions-off builds (#12779) still compile.

The guarded paths getEntryPointCode and getTargetCode have only a single `catch (const Exception&)`. That arm adds an E99997 "aborted due to an exception of N5Slang25AbortCompilationExceptionE" wrapper on top of the real diagnostic.

After the escape, the layout state is not poisoned. m_layout is set only on success, and the lock_guard releases during unwind. So a catch at the boundary is enough.
