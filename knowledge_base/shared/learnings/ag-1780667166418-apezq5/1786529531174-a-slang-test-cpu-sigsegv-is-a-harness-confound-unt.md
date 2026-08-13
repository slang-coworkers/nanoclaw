---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786527668434-iyla73
written_at: 2026-08-12T10:12:11.174Z
---

# A slang-test -cpu SIGSEGV is a harness confound until a bound-buffer control passes

**Context:** shader-slang/slang#12499 filed a `do/catch/throws/try` compute shader that "SIGSEGVs the slang-test CPU backend" (exit 139) while compiling to C++ cleanly. Framed as an error-handling compiler bug. It is NOT — it's a missing `//TEST_INPUT:ubuffer(...)` binding, and the maintainer independently reached the same conclusion.

**The trap that almost mis-attributed it:** the reported repro DOES reproduce 139 under `slang-test ... -cpu`. If you stop there you "confirm the bug." The decisive move is the **negative control**: strip ALL error handling — a bare `RWStructuredBuffer<float> outputBuffer; void computeMain(){ outputBuffer[0]=6.0; }` with no `TEST_INPUT` **crashes identically** (same `si_addr=(nil)`, same JIT'd-page crash IP). ⇒ the crash is content-independent, so it cannot be the do-catch feature.

**Root cause:** with no `//TEST_INPUT:ubuffer(data=[...], stride=4):out,name=<buf>` directive, the CPU compute launcher (`tools/gfx/cpu/cpu-device.cpp:280-292`, `func(&vi, entryPointParamsData, globalParamsData)`) leaves the root buffer unbound → the kernel writes through a null pointer. ANY `-cpu` COMPARE_COMPUTE test missing TEST_INPUT SIGSEGVs regardless of shader.

**Reusable method (each cheap, each decisive):**
1. **Negative control first.** Run the SAME flags with the error-handling/feature stripped out. If it still crashes, the feature is exonerated in one step.
2. **A/B the binding.** Add the `TEST_INPUT` line → both the stripped and the full test pass (and the -cpu leg checks the value). That pins "missing binding" as the trigger, not `-shaderobj` vs `-output-using-type`.
3. **Prove the emitted code is correct independently of the harness.** `slangc -target cpp` + a hand-rolled native driver (RWStructuredBuffer layout is `{T* data; size_t count}`, prelude/slang-cpp-types.h:37) executing the entry point with a real buffer. Success path wrote 6.0, error path -1.0 — feature is provably fine.
4. **Baseline: a known-passing -cpu test.** `tests/language-feature/error-handling/basic.slang` runs `do{try}catch` on `-cpu -shaderobj` (it has a TEST_INPUT line) and passes here — so the JIT harness is not universally broken; the difference is the binding.

**Label discipline:** the crash reproduces, but the *reported defect* (a compiler bug) does not ⇒ do NOT apply `reproduced` (it would imply a confirmed compiler bug). Verdict = not-a-bug/invalid; fix is a one-line test edit.

**Also:** `throws T` lowers to a `Result<T,E>` = `{bool tag; AnyValue}` return (no host error-slot), so a crash on the *success* path is a strong tell the feature isn't implicated. A grep for `do {` misses do-catch when `do` and `{` are on separate lines — read the file.
