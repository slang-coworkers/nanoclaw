---
title: "slang #11641 mac-aarch64 rhi flake = cmd-query timing assert (slang-rhi#775), NOT LLVM instruction-set"
type: learning
topic: slang-compiler
source: learnings/1781679288468-slang-11641-mac-aarch64-rhi-flake-cmd-query-timing.md
---

# slang #11641 mac-aarch64 rhi flake = cmd-query timing assert (slang-rhi#775), NOT LLVM instruction-set

**Issue:** shader-slang/slang#11641 — "intermittent mac-aarch64 slang-rhi test", author (jkwak-work) suspected an LLVM instruction-set issue analogous to the x86_64 SIGILL workaround in PR #11105 (which pins the slang-llvm JIT CPU to baseline "x86-64" via `disableAVX512ForJIT`, gated on env `SLANG_DISABLE_AVX512=1`).

**What it actually was:** CI forensics over ~80 recent ci.yml runs showed 4/4 mac-aarch64 `test-slang-rhi` failures had the IDENTICAL signature `external/slang-rhi/tests/test-cmd-query.cpp:183: CHECK( durationGPU < durationCPU ) is NOT correct!` (doctest `10431541 assertions | 1 failed`), with **NO SIGILL/SIGABRT/SIGSEGV/crash**. That's the known cmd-query GPU-timestamp-vs-CPU-wallclock timing flake — a doctest assertion, not JIT-compiled host code crashing. So the #11105 aarch64-analogue was the WRONG fix. (Apple-Silicon runners are homogeneous — no Azure-style CPUID mismatch that caused the real x86_64 SIGILL in #11062.)

**The real fix:** slang-rhi#775 (merged 687dc18, 2026-06-16) loosens that exact assert to `durationGPU <= durationCPU + 2e-6 + 2.0/timestampFrequency`.

**Two reusable lessons:**
1. **Verify the actual CI failure SIGNATURE before trusting a root-cause hypothesis.** "Intermittent + suspect LLVM" ≠ instruction-set issue. Pull `gh run view --job <id> --log-failed` and grep for `FAILED:|SIGILL|SIGABRT|SIGSEGV|Assertion` — a doctest `CHECK(...) is NOT correct!` line is a flaky assertion, not a codegen crash.
2. **A merged slang-rhi fix is NOT live in slang until the `external/slang-rhi` submodule pin is bumped past its merge commit.** Verify authoritatively: `gh api repos/shader-slang/slang-rhi/compare/<merge-sha>...<pin-sha> --jq '{status,behind_by}'` — `status:"behind"` / `behind_by>0` means the pin LACKS the fix. (Here pin d1ae6a9d was 2 commits behind #775.) Don't trust the local submodule working-copy log — it can be checked out at a different SHA than the recorded pin (`git ls-tree HEAD external/slang-rhi`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781679288468-slang-11641-mac-aarch64-rhi-flake-cmd-query-timing.md`_
