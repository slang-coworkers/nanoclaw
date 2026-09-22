---
title: "Building & regression-testing Slang's LLVM path (slang-llvm, -emit-cpu-via-llvm, host TableGen)"
type: concept
group: slang-tooling
tags: [slang-llvm, llvm, emit-cpu-via-llvm, llvm-host-ir, use-system-llvm, filecheck, dxc, cross-compile, macos, tablegen]
source_count: 5
---

## TL;DR

Testing anything on Slang's LLVM-based CPU/JIT path has two build traps and one test-target trap: the
default build doesn't even compile `source/slang-llvm`, `-target host-callable` swallows an invalid
module silently, and a universal macOS build re-picks-up the fat arch for its host tools.

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
- **`LLVM_USE_HOST_TOOLS` alone won't force host-native TableGen** when `CMAKE_OSX_ARCHITECTURES` is a
  process env var — omission ≠ host-native; inject `-DCMAKE_OSX_ARCHITECTURES=<host>` via
  `CROSS_TOOLCHAIN_FLAGS_NATIVE`.
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

## Forcing host-native LLVM TableGen tools in a universal (fat) macOS build

When fixing a universal (fat) macOS build of a vendored LLVM-based dependency (e.g. DXC in Slang's
`cmake/FetchDXC.cmake`), enabling `LLVM_USE_HOST_TOOLS=ON` builds TableGen host tools
(clang-tblgen/llvm-tblgen) in a nested "NATIVE" build. LLVM's `CrossCompile.cmake` NATIVE configure
*omits* `-DCMAKE_OSX_ARCHITECTURES`, on the assumption that omission → host-native. **Trap:** that
omission is NOT enough if the arch was set as a *process environment variable*
(`os.environ["CMAKE_OSX_ARCHITECTURES"]="x86_64;arm64"`). `CMAKE_OSX_ARCHITECTURES` is a documented
CMake env var that initializes the cache, and the NATIVE `execute_process` inherits the parent env, so
the NATIVE build re-picks-up the universal value and the host tool is still non-runnable (`Bad CPU
type in executable` on a no-Rosetta arm64 host). Omission ≠ host-native when the value comes from the
environment [LLVM_USE_HOST_TOOLS alone won't force host-native](../learnings/1789507360762-llvm-use-host-tools-alone-won-t-force-host-native-.md).

Fix: explicitly force the NATIVE build host-native by injecting `-DCMAKE_OSX_ARCHITECTURES=<host>` via
`CROSS_TOOLCHAIN_FLAGS_NATIVE` (a command-line `-D` overrides env-var cache init). Resolve host =
`CMAKE_APPLE_SILICON_PROCESSOR` (authoritative under Rosetta) else `CMAKE_HOST_SYSTEM_PROCESSOR`
(macOS `uname -m` → arm64/x86_64, no normalization). Also forward any main-build compiler-flag
workarounds (e.g. AppleClang≥21 `-Wno-invalid-specialization`) — the NATIVE build does not inherit
`CMAKE_CXX_FLAGS`. Escaping gotcha (verified): `CROSS_TOOLCHAIN_FLAGS_NATIVE` is one cache value
expanded *unquoted* by CrossCompile.cmake, so multiple `-D`s must be `;`-joined with the `;` escaped as
`\;` — it then survives the outer DXC-configure `execute_process` as ONE argv element, is stored as a
2-element list by the child cmake, and re-splits into two NATIVE configure args. Confirm with a
two-layer `cmake -P` harness (outer builds+escapes → `execute_process` → inner does `list(LENGTH)`).
Ref: shader-slang/slang#13077, PR #13079; DXC `CrossCompile.cmake:43-46/55`, `TableGen.cmake:95-102`,
`CMakeLists.txt:628-630`.

## emitCast Int-Widening Is SOURCE-Signedness-Driven; the Default `-cpu` Never Reaches slang-emit-llvm.cpp

When adjudicating whether flipping `isSignedType(<type>)` (e.g. adding `kIROp_IntPtrType` → signed) causes a "silent cross-backend behavior change" in the CPU/LLVM `IntCast`, trace which flag `emitCast` actually consumes — the plausible-sounding finding is usually wrong. In `slang-llvm-builder.cpp` `LLVMBuilder::emitCast(src, dst, srcIsSigned, dstIsSigned)`, an **int→int width change** picks `CreateSExtOrTrunc` vs `CreateZExtOrTrunc` from the **SOURCE** operand's signedness, NOT `dstIsSigned`; `dstIsSigned` (= `isSignedType(dst)`) is consulted **only** for float↔int (`FPToSI/FPToUI`, `SIToFP/UIToFP`). `slang-emit-llvm.cpp`'s `kIROp_IntCast` passes `isSigned(operand)` as srcIsSigned. So `int x=-1; intptr_t y=x;` sign-extends regardless of `isSignedType(IntPtr)` (the source `int` is always signed) — a `-cpu` COMPARE_COMPUTE test on that is **false coverage** (passes with the fix reverted). Compounding: the default `-cpu` target emits **C++ source** (`SLANG_PASS_THROUGH_GENERIC_C_CPP`), never reaching `slang-emit-llvm.cpp` at all — the LLVM IntCast is reached only via `-emit-cpu-via-llvm` / `-target llvm` (`llvm-shader-ir`). The genuine GPU-free witnesses of an `isSignedType(dst)` flip are: `float→intptr` on `-target llvm` (FPToUI→FPToSI, negative float) and a negative-intptr `icmp slt`; and on SPIR-V, `_arithmeticOpCodeConvert` uses `isSignedType(basicType)` (`slang-emit-spirv.cpp:841`) to pick `OpSLessThan` vs `OpULessThan`, so a spirv-asm FileCheck asserting `OpSLessThan` on a signed-intptr `<` is the load-bearing guard. Lesson: adjudicate the exact source/dest types and whether the cited target path even reaches the cited emitter, and A/B the actual binaries, before requiring a "pin the behavior" regression test (context: #13200 / PR #13202) ([slang-llvm emitCast int-widening picks SExt/ZExt by SOURCE signedness, not isSignedType(dst)](../learnings/1790012965767-slang-llvm-emitcast-int-widening-picks-sext-zext-b.md), [Adjudicating "isSignedType flip changes CPU/LLVM sign-extension" claims in Slang PR review](../learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md)).

**Source learnings (5):**
- [emitCast int→int widening is SOURCE-signedness-driven (SExt/ZExt from srcIsSigned), not dstIsSigned; dstIsSigned only gates float↔int; default `-cpu` emits C++ (never slang-emit-llvm.cpp); a `-cpu` test of `int→intptr` is false coverage (#13202)](../learnings/1790012965767-slang-llvm-emitcast-int-widening-picks-sext-zext-b.md)
- [adjudicating an "isSignedType flip = silent cross-backend change" review finding: the genuine GPU-free witnesses are float→intptr on `-target llvm` and `OpSLessThan` on SPIR-V (slang-emit-spirv.cpp:841); verify the target path reaches the emitter before requiring a test](../learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md)
- [Editing source/slang-llvm requires a from-source build (USE_SYSTEM_LLVM) to test](../learnings/1789619858349-editing-source-slang-llvm-requires-a-from-source-b.md) — default `FETCH_BINARY_IF_POSSIBLE` doesn't compile `source/slang-llvm`; local GREEN needs `USE_SYSTEM_LLVM` + pinned LLVM 21 (expensive); PR CI builds it from source so GREEN is CI-gated; a `.slang` test-file edit needs no rebuild.
- [Regression-testing Slang's LLVM emitter: use -target llvm-host-ir -o -, not host-callable](../learnings/1789480942899-regression-testing-slang-s-llvm-emitter-use-target.md) — `host-callable` ignores `verifyModule`'s return so an invalid module exits 0 and never reaches FileCheck; `llvm-host-ir -o -` gives red→green; `CHECK-NOT: noinline` false-matches the mangled name; `[ForceInline]` must beat `[noinline]` in both emitters.
- [LLVM_USE_HOST_TOOLS alone won't force host-native tools when CMAKE_OSX_ARCHITECTURES is an env var](../learnings/1789507360762-llvm-use-host-tools-alone-won-t-force-host-native-.md) — CrossCompile.cmake omits the arch but the NATIVE `execute_process` inherits the fat env var; inject `-DCMAKE_OSX_ARCHITECTURES=<host>` via `CROSS_TOOLCHAIN_FLAGS_NATIVE` (`;` escaped as `\;`); resolve host from `CMAKE_APPLE_SILICON_PROCESSOR`.

_Catalog: [[wiki/index.md]]_
