---
title: "Building & regression-testing Slang's LLVM path (slang-llvm, -emit-cpu-via-llvm, host TableGen)"
type: concept
group: slang-tooling
tags: [slang-llvm, llvm, emit-cpu-via-llvm, llvm-host-ir, use-system-llvm, filecheck, dxc, cross-compile, macos, tablegen]
source_count: 6
---

## TL;DR

Testing anything on Slang's LLVM-based CPU/JIT path has two build traps and one test-target trap: the
default build doesn't even compile `source/slang-llvm`, `-target host-callable` swallows an invalid
module silently, and a universal macOS build that ships x86_64-only host tools was, in #13077, Slang's own CMake arg plumbing rather than LLVM.

- **A source edit under `source/slang-llvm/` is inert in the default build.** `SLANG_SLANG_LLVM_FLAVOR`
  defaults to `FETCH_BINARY_IF_POSSIBLE`, which downloads a prebuilt `libslang-llvm.so` and does NOT
  compile `source/slang-llvm` — your fix has zero effect and a `-llvm`/`cpu+llvm` test stays RED. Local
  GREEN needs `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` + the pinned LLVM+Clang toolchain (very
  expensive); PR CI builds it from source, so GREEN is CI-gated — demonstrate RED locally + say so.
- **Regress the LLVM emitter with `-target llvm-host-ir -o -`, NOT `-target host-callable`.**
  `host-callable` runs `llvm::verifyModule` but *ignores its return value*, so an invalid module
  compiles exit-0 and the IR never reaches slang-test's FileCheck buffer — a `CHECK-NOT` there passes
  on the buggy binary (useless). `llvm-host-ir -o -` puts textual IR on captured stdout for a real
  red→green.
- **A `CHECK-NOT: noinline` can false-match the mangled symbol name** — keep the substring out of the
  filename and anchor the `CHECK-NOT` *after* the `attributes #N = {` positive match.
- **A universal macOS build with x86_64-only host tools: check Slang's own arg plumbing first.** #13077
  was a `\;` escape consumed by an unquoted `set()` hop in FetchDXC.cmake; the `LLVM_USE_HOST_TOOLS` and
  `CROSS_TOOLCHAIN_FLAGS_NATIVE` rounds were the wrong layer.
- **A `.slang` test file is compiled at test time, not baked into the binary** — a test-file edit
  re-runs with NO rebuild (`./build/Debug/bin/slang-test <file>`).

## Editing source/slang-llvm needs a from-source build (USE_SYSTEM_LLVM)

When fixing anything in `source/slang-llvm/` (e.g. `slang-llvm-builder.cpp`, the LLVM CPU/JIT codegen
used by `-llvm` and `-cpu -emit-cpu-via-llvm`), the DEFAULT build does not compile your change.
`SLANG_SLANG_LLVM_FLAVOR` defaults to `FETCH_BINARY_IF_POSSIBLE`, which downloads a prebuilt
`libslang-llvm.so`; in that mode `source/slang-llvm` is **not compiled**, so your edit has zero effect
on the built binary and a `-llvm`/`cpu+llvm` test stays RED even with a correct fix. To build/test the
change locally you need `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` with the pinned LLVM+Clang dev
toolchain — the pin lives in `external/build-llvm.sh` (as of 2026-09: `llvmorg-21.1.2`, built with the
clang project). Building LLVM 21 from source is very expensive; if the box has only older LLVM
(14/17), a local GREEN is effectively infeasible
[editing source/slang-llvm requires a from-source build](../learnings/1789619858349-editing-source-slang-llvm-requires-a-from-source-b.md).

PR CI *does* build it from source: the Linux x86_64 build jobs set
`-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` (`.github/workflows/ci-slang-build-container.yml`) and the
`-api cpu+llvm` test job (`ci.yml`, `test-linux-release-gcc-x86_64-cpu`) runs the freshly built binary.
So a source change to slang-llvm IS exercised by PR CI red→green WITHOUT waiting for a new slang-llvm
binary release (releases are cut only on version tags via `release.yml`). Practical consequence: for
such a fix you can only demonstrate the RED state locally (fetched unfixed binary) — which still
validates that the test catches the bug (pair it with a `-cpu` emit-C++ control directive that stays
green) — and GREEN is CI-gated; say so transparently in the PR/report rather than claiming a local
green. A `.slang` test file is compiled at test time by slang-test, NOT baked into the binary, so
re-running/validating a *test-file* edit needs NO rebuild — just re-run `./build/Debug/bin/slang-test
<file>`.

## Regression-testing the LLVM emitter: -target llvm-host-ir -o -, not host-callable

To write a deterministic slang-test regression for something in `source/slang/slang-emit-llvm.cpp`
(the `-emit-cpu-via-llvm` path), emit **textual LLVM IR to stdout** and FileCheck it:

```
//TEST:SIMPLE(filecheck=CHECK): -target llvm-host-ir -emit-cpu-via-llvm -o -
// CHECK: attributes #0 = { alwaysinline
// CHECK-NOT: noinline
```

Gotchas learned the hard way [regression-test the LLVM emitter with -target llvm-host-ir](../learnings/1789480942899-regression-testing-slang-s-llvm-emitter-use-target.md):

- `-target host-callable -emit-cpu-via-llvm` does **not** work for regressions: `slang-llvm-builder.cpp`
  calls `llvm::verifyModule(*m, &llvm::errs())` and **ignores the return value**, so an invalid module
  (e.g. conflicting `alwaysinline`+`noinline`) is non-fatal — the verifier message goes to raw stderr,
  the compile exits 0, and the text never reaches slang-test's FileCheck buffer. A `CHECK-NOT` on that
  output passes even on the buggy binary (useless).
- `-target llvm-host-ir -o -` puts the textual IR into slang-test's captured stdout, giving a real
  red→green check.
- FileCheck `CHECK-NOT: noinline` can false-match the **mangled symbol name**: a test file named
  `...noinline...` mangles into `_SR..forceinline_2Dxnoinline_2Dx..`, which literally contains
  "noinline". Avoid the substring in the filename AND anchor the `CHECK-NOT` AFTER the
  `attributes #N = { ...` positive match so FileCheck scans only the attribute set, not the earlier
  `define @<symbol>` line.
- To validate the red side without rebuilding a buggy binary, `sed 's/{ alwaysinline/{ alwaysinline
  noinline/'` the emitted IR and confirm the `CHECK-NOT` fires.

Note the cross-emitter invariant behind that test: the `[ForceInline]`-wins-over-`[noinline]`
precedence must be applied in BOTH emitters. CUDA (`slang-emit-cuda.cpp`) uses a user-only predicate
(generic force-inline is already inlined away before CUDA emit), but the LLVM emitter must use the
union `ForceInline || UserForceInline`, because on the LLVM path inlining is deferred to LLVM via the
`alwaysinline` attribute, so both kinds reach the function decl and must suppress `noinline`.

## Forcing host-native LLVM TableGen tools was the wrong layer for #13077

For the macOS universal DXC build failure (#13077, `clang-tblgen: Bad CPU type in executable`), the rounds that enabled `LLVM_USE_HOST_TOOLS` and then injected `-DCMAKE_OSX_ARCHITECTURES=<host>` through `CROSS_TOOLCHAIN_FLAGS_NATIVE` rested on the theory that the vendored LLVM's host-tool arch handling was at fault. It was not: Slang's own `FetchDXC.cmake` consumed the list's `\;` escape in an unquoted `set()` hop, so DXC was configured x86_64-only from the start. The durable CMake fact is the one those rounds brushed against, that a `\;` escape survives exactly one unquoted expansion; the durable process rule is to dump the argv the child actually received before theorising about a vendored build. The full account and the argv-harness recipe are in [Slang tooling: build runtime libs](../concepts/slang-tooling-build-runtime-libs.md) ([CMake: unquoted list expansion consumes \; escapes — verify your own arg plumbing before blaming a vendored dep](../learnings/1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver.md)).

## emitCast Int-Widening Is SOURCE-Signedness-Driven; the Default `-cpu` Never Reaches slang-emit-llvm.cpp

When adjudicating whether flipping `isSignedType(<type>)` (e.g. adding `kIROp_IntPtrType` → signed) causes a "silent cross-backend behavior change" in the CPU/LLVM `IntCast`, trace which flag `emitCast` actually consumes — the plausible-sounding finding is usually wrong. In `slang-llvm-builder.cpp` `LLVMBuilder::emitCast(src, dst, srcIsSigned, dstIsSigned)`, an **int→int width change** picks `CreateSExtOrTrunc` vs `CreateZExtOrTrunc` from the **SOURCE** operand's signedness, NOT `dstIsSigned`; `dstIsSigned` (= `isSignedType(dst)`) is consulted **only** for float↔int (`FPToSI/FPToUI`, `SIToFP/UIToFP`). `slang-emit-llvm.cpp`'s `kIROp_IntCast` passes `isSigned(operand)` as srcIsSigned. So `int x=-1; intptr_t y=x;` sign-extends regardless of `isSignedType(IntPtr)` (the source `int` is always signed) — a `-cpu` COMPARE_COMPUTE test on that is **false coverage** (passes with the fix reverted). Compounding: the default `-cpu` target emits **C++ source** (`SLANG_PASS_THROUGH_GENERIC_C_CPP`), never reaching `slang-emit-llvm.cpp` at all — the LLVM IntCast is reached only via `-emit-cpu-via-llvm` / `-target llvm` (`llvm-shader-ir`). The genuine GPU-free witnesses of an `isSignedType(dst)` flip are: `float→intptr` on `-target llvm` (FPToUI→FPToSI, negative float) and a negative-intptr `icmp slt`; and on SPIR-V, `_arithmeticOpCodeConvert` uses `isSignedType(basicType)` (`slang-emit-spirv.cpp:841`) to pick `OpSLessThan` vs `OpULessThan`, so a spirv-asm FileCheck asserting `OpSLessThan` on a signed-intptr `<` is the load-bearing guard. Lesson: adjudicate the exact source/dest types and whether the cited target path even reaches the cited emitter, and A/B the actual binaries, before requiring a "pin the behavior" regression test (context: #13200 / PR #13202) ([slang-llvm emitCast int-widening picks SExt/ZExt by SOURCE signedness, not isSignedType(dst)](../learnings/1790012965767-slang-llvm-emitcast-int-widening-picks-sext-zext-b.md), [Adjudicating "isSignedType flip changes CPU/LLVM sign-extension" claims in Slang PR review](../learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md)).

## Target-Gating an Emitted-Code Optimization: Exclude `isCPUTargetViaLLVM` on the Producer Side

The two-CPU-paths split above (default `-cpu` emits C++ source via the C-family emitter; `-emit-cpu-via-llvm` / `-target llvm` goes through `slang-emit-llvm.cpp`) has a codegen consequence when you gate an *emitted-code* optimization on a Slang target predicate (e.g. "this target can express an `unreachable` terminator, so prune the dead arm"). The C-family source path (`cpp`/`host-cpp`/`torch` + CUDA, `emitRegion` in `slang-emit-c-like.cpp`) picks up a `SLANG_PRELUDE_UNREACHABLE()`-style macro (debug-trap / release-no-return) from the text preludes (`slang-cpp-types-core.h`, `slang-cuda-prelude.h`), but **CPU-via-LLVM** (`emitLLVMForEntryPoints`) maps `kIROp_Unreachable` → a **raw, trap-less** `CreateUnreachable()` and touches no text prelude. So a `CodeGenTarget`-level `isCUDATarget || isCPUTarget` is too broad for the **producer** side: it would let the LLVM-CPU path convert a defined default into untrapped UB. Fix: give the predicate a `TargetRequest*` overload that additionally excludes `isCPUTargetViaLLVM` (`slang-code-gen.cpp`) and keep the LLVM path's defined default; the `CodeGenTarget` overload can't see the LLVM-vs-source distinction, so consult it **only** from the C-like emitter (which never runs for LLVM). The split is gap-free by construction because the same `isCPUTargetViaLLVM` predicate drives both the producer's choice (via the `TargetRequest*` overload) and the LLVM-vs-source emitter routing — so on the LLVM path the producer keeps the default AND the C-like emitter never runs (no stranded marker), and on a source path producer-emits-unreachable ⟺ emitter-emits-marker; verify each overload has exactly one caller. (`isCUDATarget` covers `CUDASource`/`CUDAHeader`/`PTX` but not `CUDAObjectCode` — self-consistent, at most a missed optimization on that payload, never a correctness bug.) Context: #13220 / PR #13228, `doesTargetSupportUnreachableTerminator` ([target-gating an emitted-code optimization: CPU-via-LLVM uses a separate emitter — exclude it](../learnings/1790131269708-target-gating-an-emitted-code-optimization-cpu-via.md)).

**Source learnings (6):**
- [target-gating an emitted-code optimization: CPU-via-LLVM (slang-emit-llvm.cpp, raw trap-less CreateUnreachable) is a separate emitter with no text prelude — a producer predicate must exclude isCPUTargetViaLLVM (#13220/PR #13228)](../learnings/1790131269708-target-gating-an-emitted-code-optimization-cpu-via.md)
- [emitCast int→int widening is SOURCE-signedness-driven (SExt/ZExt from srcIsSigned), not dstIsSigned; dstIsSigned only gates float↔int; default `-cpu` emits C++ (never slang-emit-llvm.cpp); a `-cpu` test of `int→intptr` is false coverage (#13202)](../learnings/1790012965767-slang-llvm-emitcast-int-widening-picks-sext-zext-b.md)
- [adjudicating an "isSignedType flip = silent cross-backend change" review finding: the genuine GPU-free witnesses are float→intptr on `-target llvm` and `OpSLessThan` on SPIR-V (slang-emit-spirv.cpp:841); verify the target path reaches the emitter before requiring a test](../learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md)
- [Editing source/slang-llvm requires a from-source build (USE_SYSTEM_LLVM) to test](../learnings/1789619858349-editing-source-slang-llvm-requires-a-from-source-b.md) — default `FETCH_BINARY_IF_POSSIBLE` doesn't compile `source/slang-llvm`; local GREEN needs `USE_SYSTEM_LLVM` + pinned LLVM 21 (expensive); PR CI builds it from source so GREEN is CI-gated; a `.slang` test-file edit needs no rebuild.
- [Regression-testing Slang's LLVM emitter: use -target llvm-host-ir -o -, not host-callable](../learnings/1789480942899-regression-testing-slang-s-llvm-emitter-use-target.md) — `host-callable` ignores `verifyModule`'s return so an invalid module exits 0 and never reaches FileCheck; `llvm-host-ir -o -` gives red→green; `CHECK-NOT: noinline` false-matches the mangled name; `[ForceInline]` must beat `[noinline]` in both emitters.
- [CMake: unquoted list expansion consumes \; escapes (#13077 root cause)](../learnings/1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver.md) — supersedes the LLVM_USE_HOST_TOOLS / NATIVE-flags diagnosis.

_Catalog: [[wiki/index.md]]_
