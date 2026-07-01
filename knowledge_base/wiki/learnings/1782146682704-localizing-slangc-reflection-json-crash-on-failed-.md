---
title: "Localizing slangc -reflection-json crash on failed compile (#11683) + REFLECTION test directive gotcha"
type: learning
topic: slang-compiler
source: learnings/1782146682704-localizing-slangc-reflection-json-crash-on-failed-.md
---

# Localizing slangc -reflection-json crash on failed compile (#11683) + REFLECTION test directive gotcha

## Reusable findings from triaging shader-slang/slang#11683

**1. `slangc -reflection-json` crashes after a *failed* compile because emission is unconditional.**
On a front-end error, `EndToEndCompileRequest::executeActionsInner` returns `SLANG_FAIL` early at `slang-end-to-end-request.cpp:188` (`SLANG_RETURN_ON_FAIL(getFrontEndReq()->executeActionsInner())`), so `m_specializedGlobalAndEntryPointsComponentType` is never set (stays null). But the `-reflection-json` block in `compile()` (`slang-end-to-end-request.cpp:1845-1865`) runs **without checking the result**, calls `getReflection()` (`:2183`), and `:2202` derefs the null program via `ComponentType::getTargetProgram` (null `this` at the mutex lock, `slang-linkable.cpp:1195`) → SIGSEGV. The `if (!reflection)` guard at `:1849` does NOT save it: the crash is *inside* getReflection, before it can return null. Fix direction: gate emission on `SLANG_SUCCEEDED(res)` + null-guard `getReflection()`.

**2. Localizing a slangc crash WITHOUT a debugger or rebuild — use CLI discriminators that flip the guard path.**
No gdb/lldb available + builds are slow. I bracketed the faulting condition with three cheap runs: (a) the repro → SIGSEGV; (b) drop `-target` → clean `E52009 CannotEmitReflectionWithoutTarget`, no crash (proves the no-target guard works and `getReflection` returns null early there); (c) valid shader + `-target` → reflection JSON emitted fine, no crash. (a)+(b)+(c) prove the crash needs *both* a target AND a failed compile, narrowing it to "non-null-reflection requested over a failed program." Static read of the call path then pinned the exact line. Faster and cleaner than installing a debugger.

**3. Test-directive gotcha:** `tests/reflection/*.slang` `//TEST:REFLECTION:` drives the **`slang-reflection-test` tool** (`tools/slang-reflection-test/`), NOT the `slangc -reflection-json` CLI emission path (`slang-reflection-json.cpp` via `EndToEndCompileRequest::compile`). A regression test for a `slangc -reflection-json` bug must invoke slangc directly (e.g. a `SIMPLE`/`DIAGNOSTIC_TEST:SIMPLE` directive); slang-test counts a segfault as a test failure, so a clean run is the guard.

Related upstream: #6192 is the same family (reflection over an absent/invalid program layout) with a different trigger/frame.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782146682704-localizing-slangc-reflection-json-crash-on-failed-.md`_
