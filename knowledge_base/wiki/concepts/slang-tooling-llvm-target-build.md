---
title: "Building & regression-testing Slang's LLVM path (slang-llvm, -emit-cpu-via-llvm, host TableGen, CI LLVM prebuilts)"
type: concept
group: slang-tooling
tags: [slang-llvm, llvm, emit-cpu-via-llvm, llvm-host-ir, use-system-llvm, filecheck, dxc, cross-compile, macos, tablegen, llvm-prebuilt, gcs, ci]
source_count: 22
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
- **For BAB-legalization changes on CPU-via-LLVM, count `llvm.memcpy` / load shapes in `-target llvm-shader-ir`** — a `-llvm` buffer compare passes on aligned render-test buffers either way.
- **A `CHECK-NOT: noinline` can false-match the mangled symbol name** — keep the substring out of the
  filename and anchor the `CHECK-NOT` *after* the `attributes #N = {` positive match.
- **A universal macOS build with x86_64-only host tools: check Slang's own arg plumbing first.** #13077
  was a `\;` escape consumed by an unquoted `set()` hop in FetchDXC.cmake; the `LLVM_USE_HOST_TOOLS` and
  `CROSS_TOOLCHAIN_FLAGS_NATIVE` rounds were the wrong layer.
- **A `.slang` test file is compiled at test time, not baked into the binary** — a test-file edit
  re-runs with NO rebuild (`./build/Debug/bin/slang-test <file>`).
- **Changing slang-test's `IFileCheck` interface skews against the fetched slang-llvm** — the
  default build keeps the last release's library, so slang-test fails at startup until a release
  ships, and most CI legs (from-source slang-llvm) cannot catch the skew.
- **Check which `libslang-llvm.so` a fresh worktree actually has before blaming a PR.** A fresh
  configure can fetch an old release (v2026.9.1 instead of v2026.19): every `(llvm)` leg then fails
  with `result code = 1` and empty stderr. A `--target slangc slang-test` build may have no library
  at all: filecheck tests are then counted *ignored* while the summary still says 100% passed.
  Compare `SLANG_SLANG_LLVM_BINARY_URL` in `CMakeCache.txt` with a known-good tree, copy a current
  `libslang-llvm.so` into `build/<cfg>/lib/`, and grep the run for `ignored test`.
- **CI LLVM prebuilts: a key change on master also breaks Release (no gcloud auth in release.yml) and the nightlies.** A reseed that edits `build-llvm.sh` moves the key again, so gate reruns on the NEW key returning 200 per required platform, never on the old key.
- **A 200 on a prebuilt tarball is not a working prebuilt.** A reseed can publish linux only (smoke test lacks C++17), ship a zstd dependency the CI container lacks, or skew against the runners' MSVC toolset; canary one rerun and read its log before fanning out.
- **To see whether an upstream LLVM fix is on `main` or a tag, grep the raw file for a symbol the fix adds**, never a name that already existed before it (a false hit). For a merged fix, `git merge-base --is-ancestor <sha> <tag>` in a blobless shallow clone, backed by a content grep; a `main` fix reaches x.1.y only via a `/cherry-pick` backport.
- **Any edit to `external/build-llvm.sh` or `external/llvm-*.patch` moves the LLVM prebuilt key, even a comment.** Recompute a post-merge key from the PR's current head, and hash with python `hashlib` (`xxd` is absent, and a failed `xxd -r -p` silently hashes empty input).

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

The same fetch pins the **slang-test ↔ slang-llvm FileCheck interface**. `FETCH_BINARY_IF_POSSIBLE`
downloads the slang-llvm from the GitHub release that matches the last git tag
(`cmake/GitHubRelease.cmake:58`), or builds with LLVM disabled when it can't. So a change to `IFileCheck`
(`tools/slang-test/filecheck.h`, GUID-checked in `createLLVMFileCheck_V1`) leaves a default local build
on the old library until the next release ships: with LLVM present, `locateLLVMFileCheck`
(`test-context.cpp:104-123`) fails and slang-test returns failure at startup
(`slang-test-main.cpp:7065-7068`). Most CI legs build slang-llvm from source with `USE_SYSTEM_LLVM`, so
CI won't catch the skew (the Windows debug leg builds it first and then consumes it through
FETCH_BINARY; some legs disable LLVM). Calling `performTest` once per prefix avoids the interface change
but loses FileCheck's cross-prefix ordering: FileCheck keeps every prefix's checks in one ordered list, so
separate calls cannot enforce `A:` before `B:` or limit a `B-NOT:` to the region between two `A:`
matches. A parser note from the same PR: `StringUtil::split` on an empty slice returns no pieces, so
`SIMPLE()` creates no empty option key, unlike Python's `''.split(',')` → `['']` (shader-slang/slang#13359)
([slang-test ↔ slang-llvm FileCheck interface is pinned by the prebuilt release](../learnings/1791326969343-slang-test-slang-llvm-filecheck-interface-is-pinne.md)).

## A fresh worktree's slang-llvm can be stale or absent: (llvm) failures and "ignored" FileCheck tests

The default `FETCH_BINARY_IF_POSSIBLE` flavor makes the `libslang-llvm.so` in a worktree depend on
what configure fetched, and on whether that target was built at all. Two failure shapes look like PR
problems but are build artifacts.

**A stale fetch fails every `(llvm)` leg.** A fresh `cmake --preset default` in a new worktree
(2026-10-08, master `f6238cee3b`) resolved `SLANG_SLANG_LLVM_BINARY_URL` to the **v2026.9.1**
release zip, while worktrees configured earlier had v2026.19. With the old library every `(llvm)`
test leg failed with `result code = 1` and empty stderr, and `slangc -target host-callable` printed
`error[E00098]: cannot access as a blob`. Before attributing llvm-only failures to a PR, compare
`grep SLANG_SLANG_LLVM_BINARY_URL build/CMakeCache.txt` against a known-good build. Then either copy
`build/Release/lib/libslang-llvm.so` from a worktree whose cache shows the current release, or
configure with `-DSLANG_SLANG_LLVM_BINARY_URL=<current release zip>`
([fresh configure can fetch a stale slang-llvm](../learnings/1791508327549-fresh-slang-worktree-configure-can-fetch-a-stale-s.md)).

**A missing library hides FileCheck tests as "ignored".** A fresh
`cmake --build --preset release --target slangc slang-test` neither builds nor fetches
`libslang-llvm.so`, which is the library slang-test loads FileCheck from. slang-test then prints
`FileCheck is not availableignored test: ...` and counts every `TEST:SIMPLE(filecheck=...)` test as
**ignored**, not failed, and the summary still reads "100% of tests passed". On #13538, 4 of the 14
PR tests were silently skipped this way. The fix is the same copy
(`cp <other worktree>/build/Release/lib/libslang-llvm.so build/Release/lib/`; copies exist in, for
example, `/workspace/agent/wt-13389-master/build/Release/lib/`), followed by a rerun. Grep the
slang-test output for `ignored test` before claiming a filecheck test passes
([missing libslang-llvm.so makes filecheck tests "ignored"](../learnings/1791516327523-slang-test-filecheck-is-not-available-silently-ign.md)).
The interface-version skew above, and the `COMPARE_COMPUTE(filecheck-buffer=)` variant that reports
*passed* rather than ignored, are covered on
[Slang Test — FileCheck Authoring and Opt-Levels](slang-test-filecheck-authoring-and-opt-levels.md).

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

**A byte-address-buffer legalization change on CPU-via-LLVM needs an IR-shape check, not a
buffer compare.** CPU-via-LLVM sets `scalarizeVectorLoadStore` (`slang-emit.cpp:2222`), so a
change to `legalizeByteAddressBufferOps` changes the LLVM output, but a `-llvm` COMPARE_COMPUTE
run usually passes before and after because render-test buffers are well aligned. Compile with
`slangc <t> -target llvm-shader-ir -entry computeMain -stage compute -o x.ll` and count the
shapes: in #13815, whole-array BAB loads appear as `llvm.memcpy` (17 at base, 0
at head), and head had 32 `load float` where base had 16 `load i64` + 8 `load float`. A
FileCheck `LLVM-NOT: llvm.memcpy` row tells the two apart. In that build `-target llvm-ir` and
`host-callable -emit-cpu-via-llvm` both failed ("Unsupported instruction for LLVM target" /
unknown target), so `llvm-shader-ir` was the working form
[CPU-via-LLVM BAB aggregate loads: count llvm.memcpy in llvm-shader-ir](../learnings/1792584200379-cpu-via-llvm-bab-aggregate-loads-count-llvm-memcpy.md).

## Forcing host-native LLVM TableGen tools was the wrong layer for #13077

For the macOS universal DXC build failure (#13077, `clang-tblgen: Bad CPU type in executable`), the rounds that enabled `LLVM_USE_HOST_TOOLS` and then injected `-DCMAKE_OSX_ARCHITECTURES=<host>` through `CROSS_TOOLCHAIN_FLAGS_NATIVE` rested on the theory that the vendored LLVM's host-tool arch handling was at fault. It was not: Slang's own `FetchDXC.cmake` consumed the list's `\;` escape in an unquoted `set()` hop, so DXC was configured x86_64-only from the start. The durable CMake fact is the one those rounds brushed against, that a `\;` escape survives exactly one unquoted expansion; the durable process rule is to dump the argv the child actually received before theorising about a vendored build. The full account and the argv-harness recipe are in [Slang tooling: build runtime libs](../concepts/slang-tooling-build-runtime-libs.md) ([CMake: unquoted list expansion consumes \; escapes — verify your own arg plumbing before blaming a vendored dep](../learnings/1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver.md)).

## emitCast Int-Widening Is SOURCE-Signedness-Driven; the Default `-cpu` Never Reaches slang-emit-llvm.cpp

When adjudicating whether flipping `isSignedType(<type>)` (e.g. adding `kIROp_IntPtrType` → signed) causes a "silent cross-backend behavior change" in the CPU/LLVM `IntCast`, trace which flag `emitCast` actually consumes — the plausible-sounding finding is usually wrong. In `slang-llvm-builder.cpp` `LLVMBuilder::emitCast(src, dst, srcIsSigned, dstIsSigned)`, an **int→int width change** picks `CreateSExtOrTrunc` vs `CreateZExtOrTrunc` from the **SOURCE** operand's signedness, NOT `dstIsSigned`; `dstIsSigned` (= `isSignedType(dst)`) is consulted **only** for float↔int (`FPToSI/FPToUI`, `SIToFP/UIToFP`). `slang-emit-llvm.cpp`'s `kIROp_IntCast` passes `isSigned(operand)` as srcIsSigned. So `int x=-1; intptr_t y=x;` sign-extends regardless of `isSignedType(IntPtr)` (the source `int` is always signed) — a `-cpu` COMPARE_COMPUTE test on that is **false coverage** (passes with the fix reverted). Compounding: the default `-cpu` target emits **C++ source** (`SLANG_PASS_THROUGH_GENERIC_C_CPP`), never reaching `slang-emit-llvm.cpp` at all — the LLVM IntCast is reached only via `-emit-cpu-via-llvm` / `-target llvm` (`llvm-shader-ir`). The genuine GPU-free witnesses of an `isSignedType(dst)` flip are: `float→intptr` on `-target llvm` (FPToUI→FPToSI, negative float) and a negative-intptr `icmp slt`; and on SPIR-V, `_arithmeticOpCodeConvert` uses `isSignedType(basicType)` (`slang-emit-spirv.cpp:841`) to pick `OpSLessThan` vs `OpULessThan`, so a spirv-asm FileCheck asserting `OpSLessThan` on a signed-intptr `<` is the load-bearing guard. Lesson: adjudicate the exact source/dest types and whether the cited target path even reaches the cited emitter, and A/B the actual binaries, before requiring a "pin the behavior" regression test (context: #13200 / PR #13202) ([slang-llvm emitCast int-widening picks SExt/ZExt by SOURCE signedness, not isSignedType(dst)](../learnings/1790012965767-slang-llvm-emitcast-int-widening-picks-sext-zext-b.md), [Adjudicating "isSignedType flip changes CPU/LLVM sign-extension" claims in Slang PR review](../learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md)).

## Target-Gating an Emitted-Code Optimization: Exclude `isCPUTargetViaLLVM` on the Producer Side

The two-CPU-paths split above (default `-cpu` emits C++ source via the C-family emitter; `-emit-cpu-via-llvm` / `-target llvm` goes through `slang-emit-llvm.cpp`) has a codegen consequence when you gate an *emitted-code* optimization on a Slang target predicate (e.g. "this target can express an `unreachable` terminator, so prune the dead arm"). The C-family source path (`cpp`/`host-cpp`/`torch` + CUDA, `emitRegion` in `slang-emit-c-like.cpp`) picks up a `SLANG_PRELUDE_UNREACHABLE()`-style macro (debug-trap / release-no-return) from the text preludes (`slang-cpp-types-core.h`, `slang-cuda-prelude.h`), but **CPU-via-LLVM** (`emitLLVMForEntryPoints`) maps `kIROp_Unreachable` → a **raw, trap-less** `CreateUnreachable()` and touches no text prelude. So a `CodeGenTarget`-level `isCUDATarget || isCPUTarget` is too broad for the **producer** side: it would let the LLVM-CPU path convert a defined default into untrapped UB. Fix: give the predicate a `TargetRequest*` overload that additionally excludes `isCPUTargetViaLLVM` (`slang-code-gen.cpp`) and keep the LLVM path's defined default; the `CodeGenTarget` overload can't see the LLVM-vs-source distinction, so consult it **only** from the C-like emitter (which never runs for LLVM). The split is gap-free by construction because the same `isCPUTargetViaLLVM` predicate drives both the producer's choice (via the `TargetRequest*` overload) and the LLVM-vs-source emitter routing — so on the LLVM path the producer keeps the default AND the C-like emitter never runs (no stranded marker), and on a source path producer-emits-unreachable ⟺ emitter-emits-marker; verify each overload has exactly one caller. (`isCUDATarget` covers `CUDASource`/`CUDAHeader`/`PTX` but not `CUDAObjectCode` — self-consistent, at most a missed optimization on that payload, never a correctness bug.) Context: #13220 / PR #13228, `doesTargetSupportUnreachableTerminator` ([target-gating an emitted-code optimization: CPU-via-LLVM uses a separate emitter — exclude it](../learnings/1790131269708-target-gating-an-emitted-code-optimization-cpu-via.md)).

## CI LLVM Prebuilts: Key Changes, Reseeds, and Why a 200 Is Not a Working Tarball (#13515 / #13540, Oct 2026)

Slang CI does not build LLVM on every job. `setup-llvm-from-gcs` downloads a tarball from `storage.googleapis.com/slang-ci-cache/llvm-prebuilts/llvm-<platform>-<key>.tar.gz`, and only a master-ref cold build uploads one. The PR-side half of a key change (a PR that edits `external/build-llvm.sh` cold-builds LLVM, and Windows aarch64 never heals on its own) is on [CI Flake — Real-Regression Signatures](ci-flake-real-regression-signatures.md). This section covers what happened after #13139 moved the key on 2026-10-08 and the reseed that followed.

**The key is reproducible offline.** `common-setup/action.yml:128` computes it as `hashFiles('external/build-llvm.sh', 'external/llvm-*.patch')`. That value is a sha256 over the concatenation of each matched file's raw sha256 *digest*, with files sorted by path; it is not a hash of the file contents. Fetch each file at a ref (`git show <ref>:<file>`, or `gh api repos/O/R/contents/<path>?ref=<sha>` and base64-decode) and hash the same way: master's files gave `6bf2a1a7…`, which matched the live key in the CI logs. Use this to predict whether a fix PR moves the key and to check any claimed key before probing it, because a made-up key returns a 404 that means nothing ([recompute a hashFiles() cache key offline](../learnings/1791548045410-recompute-a-github-actions-hashfiles-cache-key-off.md), [LLVM prebuilt key moves at reseed: probe both keys](../learnings/1791549704518-llvm-prebuilt-cache-key-moves-at-reseed-probe-both.md), [reseeded Windows LLVM prebuilt fails slang-llvm link on MSVC toolset skew](../learnings/1791577358779-reseeded-windows-llvm-prebuilt-can-fail-slang-llvm.md)).

**Any edit to a hashed file moves the key, even a comment.** A comment-only reword of `build-llvm.sh` changed it (e15770f1 → b3ad5163…, and 15848f85 → dfeb31f6…), so "what key will master use after PR X merges" must be recomputed from X's *current* head, never reused from an earlier head. Probe a key with an HTTP HEAD on `storage.googleapis.com/slang-ci-cache/llvm-prebuilts/llvm-<os>-<compiler>-<platform>-<key>.tar.gz` (200 vs 404). Do the hashing in `python3 hashlib`: `xxd` is absent in the container, and `printf <hex> | xxd -r -p | sha256sum` then silently hashes empty input (`e3b0c442…`) [LLVM prebuilt GCS key moves with any edit to build-llvm.sh](../learnings/1791792494149-slang-llvm-prebuilt-gcs-key-moves-with-any-edit-to.md).

**A key change on master breaks three things besides the PR jobs.**
- *Release.* The "Upload LLVM to GCS" step runs on any master-ref cold build. It skips only when `gcloud` is absent, and otherwise hard-fails with `You do not currently have an active account selected`, because `release.yml` has no `google-github-actions/auth` step. Release run 37862468754 failed on linux-x86_64 only: the hosted Ubuntu image has gcloud, and macOS does not, so it skipped and stayed green. This is filed as #13540. In the Setup step log the sequence is "LLVM prebuilt not found in GCS", then `ERROR: (gcloud.storage.cp)` ([LLVM prebuilt key change hard-fails master-ref cold builds in release.yml](../learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md)).
- *Nightlies.* Nightly Slang Test (60-minute limit) and Nightly Sanitizer (90 minutes, cancelled by a 59-minute cold LLVM build) time out. Grep their logs for "LLVM prebuilt not found in GCS" before calling them flaky ([LLVM prebuilt key change hard-fails master-ref cold builds in release.yml](../learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md), [slang-ci-analytics merge_queue counter misreports](../learnings/1791534536175-slang-ci-analytics-merge-queue-counter-misreports-.md)).
- *Merge queue.* Non-required Windows aarch64 jobs time out and set the run conclusion to `cancelled`; the counter consequences are on [CI rate metrics](ci-c-ci-metrics-rates.md).

Cold-build cost depends on the platform. Linux takes about 15 minutes, so the 120-minute ceiling bites only on macOS and Windows aarch64. One exception is sanitizer-linux-clang-x86_64: a cold LLVM build (~1.5 h) plus the sanitizer build exceeds its 2-hour job ceiling and the job is cancelled. Grep its log for "LLVM prebuilt not found in GCS" then "LLVM build complete"; a rerun reuses the old merge SHA, so only update-branch helps [back-audit after tightening a verdict gate](../learnings/1791807134236-back-audit-the-whole-tracker-after-tightening-a-ve.md). On macOS it is a race, not a certain failure (macOS debug took 94–99 minutes), so do not gate requeues on tarball probes ([seeded LLVM prebuilt downloads fine yet breaks CMake configure (zstd)](../learnings/1791542291163-seeded-llvm-prebuilt-can-download-fine-yet-break-c.md), [failed merge-group check-ci does not imply eviction](../learnings/1791564244082-failed-merge-group-check-ci-does-not-imply-evictio.md)).

**A reseed that edits a hashed file moves the key.** The zstd fix below added `-DLLVM_ENABLE_ZSTD=OFF` to `build-llvm.sh` (reseed run 37924945546 @ cb2d0f6a), which moved the key from `6bf2a1a7` to `dfeb31f6be1d…`. The reseed writes only the new key, so a rerun gate of "poll the current master key for 200" can never be met. The same trap applies from the other side: a seed or populate run on the PR branch publishes under the PR's key, and master keeps consuming the old one until the PR merges. Gate reruns on two things: the fix PR has merged, and the new key returns 200 for every platform a required job uses (ignore platforms no `ci.yml` entry uses, such as macos-x86_64). The bucket has no object versioning, so a deleted tarball leaves no `timeDeleted` trace ([LLVM prebuilt key moves at reseed: probe both keys](../learnings/1791549704518-llvm-prebuilt-cache-key-moves-at-reseed-probe-both.md), [recompute a hashFiles() cache key offline](../learnings/1791548045410-recompute-a-github-actions-hashfiles-cache-key-off.md)).

**A reseed can publish only some platforms.** In `sccache-populate.yml`, the "Validate installed LLVM and Clang packages" step builds a `find_package(LLVM)` smoke project without setting `CMAKE_CXX_STANDARD`. LLVM headers need C++17, so Windows fails validation with MSVC C2429 (nested-namespace-definition) and macOS fails on a missing `std::is_enum_v`. `publish-llvm` then fails and only the linux tarballs are uploaded. List the bucket per platform (`storage.googleapis.com/storage/v1/b/slang-ci-cache/o?prefix=llvm-prebuilts/`) before assuming a merged reseed warmed every runner ([LLVM prebuilt reseed publishes linux only](../learnings/1791563376870-llvm-prebuilt-reseed-publishes-linux-only-smoke-te.md)).

**A 200 on the tarball URL does not mean the prebuilt works.** Two failures appeared after a successful download:
- *zstd at configure.* The `6bf2a1a7` linux-gcc-x86_64 and linux-gcc-wasm tarballs from a manual "Seed all LLVM prebuilts" run referenced `zstd::libzstd_shared` in `lib/cmake/llvm/LLVMExports.cmake`. The CI container (`slang-linux-gpu-ci:v1.7.0`) has no zstd, so jobs logged "Downloaded LLVM prebuilt" and then failed CMake configure within about a minute. To check, run `curl -s <tarball> | tar -xzO --wildcards --occurrence=1 '*lib/cmake/llvm/LLVMExports.cmake' | grep zstd` and compare against an older tarball. This is the failure the `LLVM_ENABLE_ZSTD=OFF` reseed fixed ([seeded LLVM prebuilt downloads fine yet breaks CMake configure (zstd)](../learnings/1791542291163-seeded-llvm-prebuilt-can-download-fine-yet-break-c.md)).
- *MSVC toolset skew at link.* On #13526 the reseeded windows-cl-x86_64 tarball (`dfeb31f6…`, HTTP 200) downloaded fine, but `slang-llvm.dll` failed to link with LNK2019/LNK2001 unresolved `__std_find_first_of_trivial_pos_1` (plus LNK1120), deterministically on all three Windows x86_64 jobs. The working hypothesis is that the tarball was built on GitHub-hosted windows-2022 (MSVC 14.44.35207), while the `win-build-*` runners have MSVC 14.43.34808, which lacks that STL-internal helper. Do not rerun. Compare the toolsets by grepping `EXTERNAL_INCLUDE` / `MSVC\14.4x` in the seed and CI job logs ([reseeded Windows LLVM prebuilt fails slang-llvm link on MSVC toolset skew](../learnings/1791577358779-reseeded-windows-llvm-prebuilt-can-fail-slang-llvm.md)).

So before fanning out reruns after a reseed, rerun one job as a canary and read its log.

**Probe and log mechanics.** Probe a tarball with `curl -s -o /dev/null -w '%{http_code}' -I <url>`. Through the proxy, the first `HTTP/1.1 200` in `curl -sI` output can be the CONNECT response, which produces false 200s. `gh api .../actions/jobs/<id>/logs` needs `--allow-escape-sequences` here; strip ANSI codes before quoting line numbers. After `gh run rerun <run> --job <id>` the run is `in_progress`, and further `--job` reruns fail with "cannot be rerun"; wait for it to finish and use the new attempt's job ids ([LLVM prebuilt key change hard-fails master-ref cold builds in release.yml](../learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md), [recompute a hashFiles() cache key offline](../learnings/1791548045410-recompute-a-github-actions-hashfiles-cache-key-off.md), [LLVM prebuilt key moves at reseed: probe both keys](../learnings/1791549704518-llvm-prebuilt-cache-key-moves-at-reseed-probe-both.md), [LLVM prebuilt reseed publishes linux only](../learnings/1791563376870-llvm-prebuilt-reseed-publishes-linux-only-smoke-te.md)).

## Checking Whether an Upstream LLVM Fix Has Shipped Before Planning a Bump

For a "bump LLVM to a version containing upstream PR X" issue (for example slang#13549 / llvm#229712), check three things before writing a bump plan. First, the PR state: `gh pr view <N> -R llvm/llvm-project --json state,mergedAt`. `gh api repos/llvm/...` REST calls return 401 through the gateway, but `gh pr view` goes through GraphQL and works. Second, whether the fix is in any release: fetch the touched file from raw.githubusercontent.com at each release tag (`llvmorg-21.1.8`, `22.1.8`, `23.1.x`, `main`), compare md5s, and run `git apply --check` of the local backport on a temp tree that holds just those files. A quicker check is `curl https://raw.githubusercontent.com/llvm/llvm-project/<ref>/<path> | grep <symbol>`, which works through the gateway, but grep for a symbol the fix *adds* (for llvm#229712, the helper `read32AArch64LdrAddend` in `RuntimeDyldCOFFAArch64.h`), not a relocation name like `PAGEOFFSET_12L` that exists before the fix and gives a false hit. On 2026-10-19 the helper was absent on `main` and `llvmorg-22.1.8`, so the Slang backport patch stays ([grep raw.githubusercontent for a symbol the fix adds](../learnings/1792427631921-check-whether-an-unmerged-llvm-fix-landed-on-main-.md)). Once the PR has merged, `gh pr view <n> -R llvm/llvm-project --json state,mergedAt,mergeCommit,milestone,comments` gives the merge SHA, and ancestry settles which tag holds it: a cheap clone (`git init; git remote add origin https://github.com/llvm/llvm-project.git; git fetch --filter=blob:none --shallow-since=<a few months back> origin refs/heads/release/23.x:refs/remotes/origin/release/23.x refs/heads/main:refs/remotes/origin/main refs/tags/llvmorg-23.1.4:refs/tags/llvmorg-23.1.4`, about 25 s), then `git merge-base --is-ancestor <sha> <tag>`. A negative ancestry result in a shallow clone is weak evidence, so back it with `git show <tag>:<file> | grep <new symbol>`. A fix merged to `main` reaches an x.1.y release only through a backport (per llvm/docs/GitHub.md: set the PR milestone to "LLVM X.Y Release" and comment `/cherry-pick <sha>`), and `llvmorg-N-init` is the branch point on main, not a release ([is an LLVM main commit in a release tag](../learnings/1793197406074-check-if-an-llvm-main-commit-is-in-a-release-tag-w.md)). Third, tag dates: `git ls-remote --tags` gives the list, and the GraphQL `ref(qualifiedName:"refs/tags/…")` committedDate gives the dates. Slang facts as of 2026-10-09: the LLVM pin lives only in `external/build-llvm.sh:57` and `build-llvm.ps1:58`; the CI cache key globs `external/llvm-*.patch`, so deleting a backport patch rekeys the prebuilts (see the section above); moving to LLVM 23 trips `static_assert(LLVM_VERSION_MAJOR < 23)` in `slang-llvm-jit-shared-library.cpp` (the Win64 RTDyld workaround); and draft #11017 bumps to 22.1.4 ([checking whether an upstream LLVM fix has shipped](../learnings/1791577897128-checking-whether-an-upstream-llvm-fix-has-shipped-.md)).

**Source learnings (22):**
- [target-gating an emitted-code optimization: CPU-via-LLVM (slang-emit-llvm.cpp, raw trap-less CreateUnreachable) is a separate emitter with no text prelude — a producer predicate must exclude isCPUTargetViaLLVM (#13220/PR #13228)](../learnings/1790131269708-target-gating-an-emitted-code-optimization-cpu-via.md)
- [emitCast int→int widening is SOURCE-signedness-driven (SExt/ZExt from srcIsSigned), not dstIsSigned; dstIsSigned only gates float↔int; default `-cpu` emits C++ (never slang-emit-llvm.cpp); a `-cpu` test of `int→intptr` is false coverage (#13202)](../learnings/1790012965767-slang-llvm-emitcast-int-widening-picks-sext-zext-b.md)
- [adjudicating an "isSignedType flip = silent cross-backend change" review finding: the genuine GPU-free witnesses are float→intptr on `-target llvm` and `OpSLessThan` on SPIR-V (slang-emit-spirv.cpp:841); verify the target path reaches the emitter before requiring a test](../learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md)
- [Editing source/slang-llvm requires a from-source build (USE_SYSTEM_LLVM) to test](../learnings/1789619858349-editing-source-slang-llvm-requires-a-from-source-b.md) — default `FETCH_BINARY_IF_POSSIBLE` doesn't compile `source/slang-llvm`; local GREEN needs `USE_SYSTEM_LLVM` + pinned LLVM 21 (expensive); PR CI builds it from source so GREEN is CI-gated; a `.slang` test-file edit needs no rebuild.
- [Fresh slang worktree configure can fetch a stale slang-llvm → silent (llvm) test failures](../learnings/1791508327549-fresh-slang-worktree-configure-can-fetch-a-stale-s.md) — v2026.9.1 vs v2026.19 via `SLANG_SLANG_LLVM_BINARY_URL`; `(llvm)` legs `result code = 1`, `E00098 cannot access as a blob`; copy a current lib or set the URL
- [slang-test 'FileCheck is not available' silently ignores filecheck tests; copy libslang-llvm.so into the build](../learnings/1791516327523-slang-test-filecheck-is-not-available-silently-ign.md) — `--target slangc slang-test` build has no library; 4/14 PR tests ignored on #13538 under "100% passed"; grep `ignored test`
- [Regression-testing Slang's LLVM emitter: use -target llvm-host-ir -o -, not host-callable](../learnings/1789480942899-regression-testing-slang-s-llvm-emitter-use-target.md) — `host-callable` ignores `verifyModule`'s return so an invalid module exits 0 and never reaches FileCheck; `llvm-host-ir -o -` gives red→green; `CHECK-NOT: noinline` false-matches the mangled name; `[ForceInline]` must beat `[noinline]` in both emitters.
- [CPU-via-LLVM BAB aggregate loads: count llvm.memcpy in -target llvm-shader-ir; a buffer-compare -llvm run can't tell](../learnings/1792584200379-cpu-via-llvm-bab-aggregate-loads-count-llvm-memcpy.md) — #13815: 17→0 `llvm.memcpy`; `scalarizeVectorLoadStore` on CPU-via-LLVM; `LLVM-NOT: llvm.memcpy` row
- [CMake: unquoted list expansion consumes \; escapes (#13077 root cause)](../learnings/1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver.md) — supersedes the LLVM_USE_HOST_TOOLS / NATIVE-flags diagnosis.
- [slang-test ↔ slang-llvm FileCheck interface is pinned by the prebuilt release in default local builds](../learnings/1791326969343-slang-test-slang-llvm-filecheck-interface-is-pinne.md) — #13359: an `IFileCheck` change fails `locateLLVMFileCheck` at startup until a release ships; per-prefix `performTest` loses cross-prefix ordering
- [LLVM prebuilt cache-key change can hard-fail master-ref cold builds in release.yml](../learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md) — #13540: "Upload LLVM to GCS" fails without gcloud auth; probe with `-w '%{http_code}'`
- [Seeded LLVM prebuilt can download fine yet break CMake configure (zstd)](../learnings/1791542291163-seeded-llvm-prebuilt-can-download-fine-yet-break-c.md)
- [Recompute a GitHub Actions hashFiles() cache key offline to predict which key a PR will use](../learnings/1791548045410-recompute-a-github-actions-hashfiles-cache-key-off.md)
- [LLVM prebuilt cache key moves at reseed: probe both 6bf2a1a7 and dfeb31f6](../learnings/1791549704518-llvm-prebuilt-cache-key-moves-at-reseed-probe-both.md)
- [LLVM prebuilt reseed publishes linux only: smoke test sets no C++ standard](../learnings/1791563376870-llvm-prebuilt-reseed-publishes-linux-only-smoke-te.md)
- [Reseeded Windows LLVM prebuilt can fail slang-llvm link on MSVC toolset skew (LNK2019 __std_find_first_of_trivial_pos_1)](../learnings/1791577358779-reseeded-windows-llvm-prebuilt-can-fail-slang-llvm.md)
- [Checking whether an upstream LLVM fix has shipped: compare the file across release tags](../learnings/1791577897128-checking-whether-an-upstream-llvm-fix-has-shipped-.md)
- [Check whether an unmerged LLVM fix landed on main via raw.githubusercontent grep](../learnings/1792427631921-check-whether-an-unmerged-llvm-fix-landed-on-main-.md) — grep a symbol the fix adds (`read32AArch64LdrAddend`), not a pre-existing relocation name; absent on main/22.1.8 on 2026-10-19.
- [slang-ci-analytics merge_queue counter misreports when non-required MQ jobs time out](../learnings/1791534536175-slang-ci-analytics-merge-queue-counter-misreports-.md)
- [Failed merge-group check-ci does not imply eviction: a stacked later entry's green run merges earlier entries](../learnings/1791564244082-failed-merge-group-check-ci-does-not-imply-evictio.md)
- [Slang LLVM prebuilt GCS key moves with ANY edit to external/build-llvm.sh, even a comment](../learnings/1791792494149-slang-llvm-prebuilt-gcs-key-moves-with-any-edit-to.md) — recompute the key from the PR's current head; HEAD-probe the tarball URL; `xxd` is absent, use hashlib
- [Check if an LLVM main commit is in a release tag when REST to llvm-project 401s](../learnings/1793197406074-check-if-an-llvm-main-commit-is-in-a-release-tag-w.md) — blobless shallow clone + `merge-base --is-ancestor`, content-check backup; x.1.y needs a `/cherry-pick` backport

_Catalog: [[wiki/index.md]]_
