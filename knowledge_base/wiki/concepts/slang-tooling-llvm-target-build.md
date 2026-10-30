---
title: "Building & regression-testing Slang's LLVM path (slang-llvm, -emit-cpu-via-llvm, host TableGen, CI LLVM prebuilts)"
type: concept
group: slang-tooling
tags: [slang-llvm, llvm, emit-cpu-via-llvm, llvm-host-ir, use-system-llvm, filecheck, dxc, cross-compile, macos, tablegen, llvm-prebuilt, gcs, ci]
source_count: 22
---

## TL;DR

Testing anything on Slang's LLVM-based CPU/JIT path has two build traps and one test-target trap: the
default build doesn't compile `source/slang-llvm`, `-target host-callable` swallows an invalid module
silently, and the #13077 universal-macOS host-tool failure was Slang's own CMake arg plumbing, not LLVM.

- **A source edit under `source/slang-llvm/` is inert in the default build.** `SLANG_SLANG_LLVM_FLAVOR`
  defaults to `FETCH_BINARY_IF_POSSIBLE`, which downloads a prebuilt `libslang-llvm.so` and does NOT
  compile `source/slang-llvm`, so a `-llvm`/`cpu+llvm` test stays RED. Local GREEN needs
  `USE_SYSTEM_LLVM` + the pinned LLVM+Clang (very expensive); PR CI builds it from source, so GREEN is
  CI-gated — demonstrate RED locally and say so.
- **A `.slang` test file is compiled at test time** — a test-file edit re-runs with NO rebuild.
- **Changing slang-test's `IFileCheck` interface skews against the fetched slang-llvm** — slang-test
  fails at startup until a release ships, and most CI legs (from-source slang-llvm) cannot catch it.
- **Check which `libslang-llvm.so` a worktree actually has before blaming a PR.** A fresh configure can
  fetch an old release (every `(llvm)` leg fails with `result code = 1`, empty stderr); a
  `--target slangc slang-test` build may have none (filecheck tests counted *ignored* under "100%
  passed"). Compare `SLANG_SLANG_LLVM_BINARY_URL` in `CMakeCache.txt`, copy a current library into
  `build/<cfg>/lib/`, and grep the run for `ignored test`.
- **Regress the LLVM emitter with `-target llvm-host-ir -o -`, NOT `-target host-callable`** —
  `host-callable` ignores `llvm::verifyModule`'s result, so an invalid module exits 0 and never reaches
  FileCheck. Anchor `CHECK-NOT: noinline` after the `attributes #N = {` match (the mangled name can
  contain it).
- **For BAB-legalization changes on CPU-via-LLVM, count `llvm.memcpy` / load shapes in
  `-target llvm-shader-ir`** — a `-llvm` buffer compare passes on aligned buffers either way.
- **The default `-cpu` emits C++ and never reaches `slang-emit-llvm.cpp`**; `emitCast` int widening
  follows SOURCE signedness. Check which path a review finding reaches before requiring a test.
- **Gate an emitted-code optimization on the producer side with a `TargetRequest*` predicate that
  excludes `isCPUTargetViaLLVM`** — the LLVM-CPU path has its own emitter and no text prelude.
- **x86_64-only host tools in a universal macOS build: check Slang's own arg plumbing first.**
- **Any edit to `external/build-llvm.sh` or `external/llvm-*.patch` moves the CI LLVM prebuilt key,
  even a comment or a reseed fix** — and on master it also breaks Release (no gcloud auth) and the
  nightlies. Recompute the key offline from the PR's current head with python `hashlib` (`xxd` is
  absent); gate reruns on the NEW key returning 200 for every required platform.
- **A 200 on a prebuilt tarball is not a working prebuilt** — a reseed can publish linux only, depend on
  zstd the CI container lacks, or skew against the runners' MSVC toolset; canary one rerun first.
- **To see whether an upstream LLVM fix is on `main` or a tag, grep the raw file for a symbol the fix
  adds**, never one that existed before. For a merged fix, `git merge-base --is-ancestor <sha> <tag>`
  in a blobless shallow clone, backed by a content grep; a `main` fix reaches x.1.y only via
  `/cherry-pick`.

## Editing source/slang-llvm needs a from-source build (USE_SYSTEM_LLVM)

A fix in `source/slang-llvm/` (e.g. `slang-llvm-builder.cpp`, the LLVM CPU/JIT codegen behind `-llvm`
and `-cpu -emit-cpu-via-llvm`) is not compiled by the DEFAULT build. `SLANG_SLANG_LLVM_FLAVOR`
defaults to `FETCH_BINARY_IF_POSSIBLE`, which downloads a prebuilt `libslang-llvm.so` and skips
`source/slang-llvm`, so a correct fix leaves a `-llvm`/`cpu+llvm` test RED. Testing locally needs
`SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` with the pinned LLVM+Clang toolchain from
`external/build-llvm.sh` (as of 2026-09: `llvmorg-21.1.2`, with the clang project). With only LLVM 14/17 on
the box a local GREEN is effectively infeasible. PR CI
does build it from source: the Linux x86_64 build jobs set `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`
(`ci-slang-build-container.yml`) and the `-api cpu+llvm` job (`test-linux-release-gcc-x86_64-cpu`)
runs that binary, so the fix is exercised red→green without a new slang-llvm release (releases come
only from version tags via `release.yml`). Demonstrate RED locally with the fetched unfixed binary,
paired with a `-cpu` emit-C++ control that stays green, and say plainly that GREEN is CI-gated. A
`.slang` test file is compiled at test time, not baked into the binary, so a test-file edit needs no
rebuild — re-run `./build/Debug/bin/slang-test <file>`
[editing source/slang-llvm requires a from-source build](../learnings/1789619858349-editing-source-slang-llvm-requires-a-from-source-b.md).

The same fetch pins the **slang-test ↔ slang-llvm FileCheck interface**. `FETCH_BINARY_IF_POSSIBLE`
downloads the slang-llvm of the release matching the last git tag (`cmake/GitHubRelease.cmake:58`), or
builds with LLVM disabled. A change to `IFileCheck` (`tools/slang-test/filecheck.h`, GUID-checked in
`createLLVMFileCheck_V1`) therefore leaves a default local build on the old library until the next
release: `locateLLVMFileCheck` (`test-context.cpp:104-123`) fails and slang-test returns failure at
startup (`slang-test-main.cpp:7065-7068`). Most CI legs build slang-llvm from source, so CI won't
catch the skew (Windows debug builds it and then consumes it through FETCH_BINARY; some legs disable
LLVM). Calling `performTest` once per prefix avoids the interface change but loses FileCheck's
cross-prefix ordering — separate calls cannot enforce `A:` before `B:` or confine a `B-NOT:` between
two `A:` matches. Also: `StringUtil::split` on an empty slice returns no pieces, so `SIMPLE()` creates
no empty option key, unlike Python's `''.split(',')` (shader-slang/slang#13359)
([slang-test ↔ slang-llvm FileCheck interface is pinned by the prebuilt release](../learnings/1791326969343-slang-test-slang-llvm-filecheck-interface-is-pinne.md)).

## A fresh worktree's slang-llvm can be stale or absent: (llvm) failures and "ignored" FileCheck tests

Under `FETCH_BINARY_IF_POSSIBLE`, a worktree's `libslang-llvm.so` is whatever configure fetched, if the
target was built at all. Two shapes look like PR problems but are build artifacts.

**A stale fetch fails every `(llvm)` leg.** A fresh `cmake --preset default` (2026-10-08, master
`f6238cee3b`) resolved `SLANG_SLANG_LLVM_BINARY_URL` to the **v2026.9.1** zip while older worktrees had
v2026.19; every `(llvm)` leg then failed with `result code = 1` and empty stderr, and `slangc -target
host-callable` printed `error[E00098]: cannot access as a blob`. Compare `grep
SLANG_SLANG_LLVM_BINARY_URL build/CMakeCache.txt` with a known-good build, then copy
`build/Release/lib/libslang-llvm.so` from a current worktree or configure with
`-DSLANG_SLANG_LLVM_BINARY_URL=<current release zip>`
([fresh configure can fetch a stale slang-llvm](../learnings/1791508327549-fresh-slang-worktree-configure-can-fetch-a-stale-s.md)).

**A missing library hides FileCheck tests as "ignored".** `cmake --build --preset release --target
slangc slang-test` neither builds nor fetches `libslang-llvm.so`, the library slang-test loads
FileCheck from. slang-test prints `FileCheck is not availableignored test: ...`, counts every
`TEST:SIMPLE(filecheck=...)` test as **ignored**, and still reports "100% of tests passed"; on #13538,
4 of 14 PR tests were skipped this way. Copy the library in (e.g. from
`/workspace/agent/wt-13389-master/build/Release/lib/`), rerun, and grep for `ignored test` before
claiming a filecheck test passes
([missing libslang-llvm.so makes filecheck tests "ignored"](../learnings/1791516327523-slang-test-filecheck-is-not-available-silently-ign.md)).
The `COMPARE_COMPUTE(filecheck-buffer=)` variant that reports *passed* rather than ignored is on
[Slang Test — FileCheck Authoring and Opt-Levels](slang-test-filecheck-authoring-and-opt-levels.md).

## Regression-testing the LLVM emitter: -target llvm-host-ir -o -, not host-callable

For a deterministic regression in `source/slang/slang-emit-llvm.cpp` (the `-emit-cpu-via-llvm` path),
emit **textual LLVM IR to stdout** and FileCheck it
[regression-test the LLVM emitter with -target llvm-host-ir](../learnings/1789480942899-regression-testing-slang-s-llvm-emitter-use-target.md):

```
//TEST:SIMPLE(filecheck=CHECK): -target llvm-host-ir -emit-cpu-via-llvm -o -
// CHECK: attributes #0 = { alwaysinline
// CHECK-NOT: noinline
```

- `-target host-callable -emit-cpu-via-llvm` does **not** work: `slang-llvm-builder.cpp` calls
  `llvm::verifyModule(*m, &llvm::errs())` and **ignores the return value**, so an invalid module (e.g.
  `alwaysinline`+`noinline`) goes to raw stderr, exits 0, and never reaches the FileCheck buffer — a
  `CHECK-NOT` passes even on the buggy binary. `-target llvm-host-ir -o -` puts the IR on captured
  stdout for a real red→green.
- `CHECK-NOT: noinline` can false-match the **mangled symbol**: a file named `...noinline...` mangles
  into `_SR..forceinline_2Dxnoinline_2Dx..`. Keep the substring out of the filename AND anchor the
  `CHECK-NOT` after the `attributes #N = { ...` match so only the attribute set is scanned.
- Validate the red side without a buggy build: `sed 's/{ alwaysinline/{ alwaysinline noinline/'` the
  emitted IR and confirm the `CHECK-NOT` fires.

The invariant behind that test: `[ForceInline]` beats `[noinline]` in BOTH emitters. CUDA
(`slang-emit-cuda.cpp`) uses a user-only predicate because generic force-inline is inlined away before
CUDA emit, but the LLVM emitter must use `ForceInline || UserForceInline`, since LLVM-path inlining is
deferred to LLVM via `alwaysinline` and both kinds reach the function decl.

**A byte-address-buffer legalization change on CPU-via-LLVM needs an IR-shape check, not a buffer
compare.** CPU-via-LLVM sets `scalarizeVectorLoadStore` (`slang-emit.cpp:2222`), so a
`legalizeByteAddressBufferOps` change alters the LLVM output, yet a `-llvm` COMPARE_COMPUTE run passes
before and after on well-aligned render-test buffers. Compile with `slangc <t> -target llvm-shader-ir
-entry computeMain -stage compute -o x.ll` and count shapes: in #13815 whole-array BAB loads were
`llvm.memcpy` (17 at base, 0 at head), and head had 32 `load float` where base had 16 `load i64` + 8
`load float`; an `LLVM-NOT: llvm.memcpy` row tells them apart. `-target llvm-ir` and `host-callable
-emit-cpu-via-llvm` both failed in that build, so `llvm-shader-ir` was the working form
[CPU-via-LLVM BAB aggregate loads: count llvm.memcpy in llvm-shader-ir](../learnings/1792584200379-cpu-via-llvm-bab-aggregate-loads-count-llvm-memcpy.md).

## Forcing host-native LLVM TableGen tools was the wrong layer for #13077

For the macOS universal DXC failure (#13077, `clang-tblgen: Bad CPU type in executable`), enabling `LLVM_USE_HOST_TOOLS` and injecting `-DCMAKE_OSX_ARCHITECTURES=<host>` through `CROSS_TOOLCHAIN_FLAGS_NATIVE` assumed the vendored LLVM's host-tool arch handling was at fault. It was not: Slang's `FetchDXC.cmake` consumed the list's `\;` escape in an unquoted `set()` hop, so DXC was configured x86_64-only from the start. The durable facts: a `\;` escape survives exactly one unquoted expansion, and you dump the argv the child actually received before theorising about a vendored build. Full account and argv-harness recipe: [Slang tooling: build runtime libs](../concepts/slang-tooling-build-runtime-libs.md) ([CMake: unquoted list expansion consumes \; escapes — verify your own arg plumbing before blaming a vendored dep](../learnings/1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver.md)).

## emitCast Int-Widening Is SOURCE-Signedness-Driven; the Default `-cpu` Never Reaches slang-emit-llvm.cpp

A review claim that flipping `isSignedType(<type>)` (e.g. `kIROp_IntPtrType` → signed) silently changes the CPU/LLVM `IntCast` is usually wrong; trace which flag `emitCast` consumes. In `slang-llvm-builder.cpp` `LLVMBuilder::emitCast(src, dst, srcIsSigned, dstIsSigned)`, an **int→int width change** picks `CreateSExtOrTrunc` vs `CreateZExtOrTrunc` from the **SOURCE** signedness; `dstIsSigned` (= `isSignedType(dst)`) is consulted only for float↔int (`FPToSI/FPToUI`, `SIToFP/UIToFP`), and `slang-emit-llvm.cpp`'s `kIROp_IntCast` passes `isSigned(operand)` as srcIsSigned. So `int x=-1; intptr_t y=x;` sign-extends regardless, and a `-cpu` COMPARE_COMPUTE test of it is **false coverage** (passes with the fix reverted). Worse, the default `-cpu` emits **C++ source** (`SLANG_PASS_THROUGH_GENERIC_C_CPP`) and never reaches `slang-emit-llvm.cpp`; only `-emit-cpu-via-llvm` / `-target llvm` (`llvm-shader-ir`) does. The genuine GPU-free witnesses of an `isSignedType(dst)` flip are `float→intptr` on `-target llvm` (FPToUI→FPToSI, negative float), a negative-intptr `icmp slt`, and on SPIR-V `_arithmeticOpCodeConvert`'s `isSignedType(basicType)` choice of `OpSLessThan` vs `OpULessThan` (`slang-emit-spirv.cpp:841`) — a spirv-asm FileCheck on a signed-intptr `<` is the load-bearing guard. Adjudicate the exact types and whether the target path reaches the cited emitter, and A/B the binaries, before requiring a "pin the behavior" test (#13200 / PR #13202) ([slang-llvm emitCast int-widening picks SExt/ZExt by SOURCE signedness, not isSignedType(dst)](../learnings/1790012965767-slang-llvm-emitcast-int-widening-picks-sext-zext-b.md), [Adjudicating "isSignedType flip changes CPU/LLVM sign-extension" claims in Slang PR review](../learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md)).

## Target-Gating an Emitted-Code Optimization: Exclude `isCPUTargetViaLLVM` on the Producer Side

The two CPU paths matter when an *emitted-code* optimization is gated on a target predicate (e.g. "this target can express an `unreachable` terminator, so prune the dead arm"). The C-family source path (`cpp`/`host-cpp`/`torch` + CUDA, `emitRegion` in `slang-emit-c-like.cpp`) gets a `SLANG_PRELUDE_UNREACHABLE()`-style macro (debug-trap / release-no-return) from the text preludes (`slang-cpp-types-core.h`, `slang-cuda-prelude.h`), but **CPU-via-LLVM** (`emitLLVMForEntryPoints`) maps `kIROp_Unreachable` to a **raw, trap-less** `CreateUnreachable()`. A `CodeGenTarget`-level `isCUDATarget || isCPUTarget` is therefore too broad for the **producer**: it would turn the LLVM-CPU path's defined default into untrapped UB. Give the predicate a `TargetRequest*` overload that also excludes `isCPUTargetViaLLVM` (`slang-code-gen.cpp`), and consult the `CodeGenTarget` overload only from the C-like emitter, which never runs for LLVM. The split is gap-free because the same `isCPUTargetViaLLVM` drives both the producer's choice and the emitter routing: on the LLVM path the producer keeps the default and no marker is stranded; on a source path producer-emits-unreachable ⟺ emitter-emits-marker. Verify each overload has exactly one caller. (`isCUDATarget` excludes `CUDAObjectCode` — at most a missed optimization.) Context: #13220 / PR #13228, `doesTargetSupportUnreachableTerminator` ([target-gating an emitted-code optimization: CPU-via-LLVM uses a separate emitter — exclude it](../learnings/1790131269708-target-gating-an-emitted-code-optimization-cpu-via.md)).

## CI LLVM Prebuilts: Key Changes, Reseeds, and Why a 200 Is Not a Working Tarball (#13515 / #13540, Oct 2026)

Slang CI does not build LLVM per job: `setup-llvm-from-gcs` downloads `storage.googleapis.com/slang-ci-cache/llvm-prebuilts/llvm-<os>-<compiler>-<platform>-<key>.tar.gz`, and only a master-ref cold build uploads one. The PR-side half of a key change (a PR editing `external/build-llvm.sh` cold-builds LLVM; Windows aarch64 never heals on its own) is on [CI Flake — Real-Regression Signatures](ci-flake-real-regression-signatures.md); this section covers #13139's key move on 2026-10-08 and the reseed after it.

**The key is reproducible offline, and any edit to a hashed file moves it.** `common-setup/action.yml:128` computes `hashFiles('external/build-llvm.sh', 'external/llvm-*.patch')`: a sha256 over the concatenation of each matched file's raw sha256 *digest*, files sorted by path — not a hash of the contents. Fetch each file at a ref (`git show <ref>:<file>`, or `gh api repos/O/R/contents/<path>?ref=<sha>` base64-decoded) and hash the same way; master's files gave `6bf2a1a7…`, matching the live key. Check a claimed key this way before probing; a made-up key's 404 means nothing ([recompute a hashFiles() cache key offline](../learnings/1791548045410-recompute-a-github-actions-hashfiles-cache-key-off.md), [LLVM prebuilt key moves at reseed: probe both keys](../learnings/1791549704518-llvm-prebuilt-cache-key-moves-at-reseed-probe-both.md), [reseeded Windows LLVM prebuilt fails slang-llvm link on MSVC toolset skew](../learnings/1791577358779-reseeded-windows-llvm-prebuilt-can-fail-slang-llvm.md)). A comment-only reword of `build-llvm.sh` moved it (e15770f1 → b3ad5163…, 15848f85 → dfeb31f6…), so "which key will master use after PR X merges" must be recomputed from X's *current* head. HEAD-probe the tarball URL (200 vs 404), and hash in `python3 hashlib`: `xxd` is absent, and `printf <hex> | xxd -r -p | sha256sum` then silently hashes empty input (`e3b0c442…`) [LLVM prebuilt GCS key moves with any edit to build-llvm.sh](../learnings/1791792494149-slang-llvm-prebuilt-gcs-key-moves-with-any-edit-to.md).

**A reseed that edits a hashed file moves the key too.** The zstd fix added `-DLLVM_ENABLE_ZSTD=OFF` to `build-llvm.sh` (reseed run 37924945546 @ cb2d0f6a), moving the key from `6bf2a1a7` to `dfeb31f6be1d…`; the reseed writes only the new key, so "poll the current master key for 200" can never be met. Conversely, a seed/populate run on a PR branch publishes under the PR's key while master keeps the old one until merge. Gate reruns on the fix PR having merged AND the new key returning 200 for every platform a required job uses (ignore unused ones such as macos-x86_64). The bucket has no object versioning, so a deleted tarball leaves no `timeDeleted` trace ([LLVM prebuilt key moves at reseed: probe both keys](../learnings/1791549704518-llvm-prebuilt-cache-key-moves-at-reseed-probe-both.md), [recompute a hashFiles() cache key offline](../learnings/1791548045410-recompute-a-github-actions-hashfiles-cache-key-off.md)).

**A key change on master breaks three things besides the PR jobs.**
- *Release.* "Upload LLVM to GCS" runs on any master-ref cold build, skips only when `gcloud` is absent, and otherwise hard-fails (`You do not currently have an active account selected`) because `release.yml` has no `google-github-actions/auth` step. Release run 37862468754 failed on linux-x86_64 only (macOS lacks gcloud, so it skipped) — #13540. The Setup log shows "LLVM prebuilt not found in GCS" then `ERROR: (gcloud.storage.cp)` ([LLVM prebuilt key change hard-fails master-ref cold builds in release.yml](../learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md)).
- *Nightlies.* Nightly Slang Test (60 min) and Nightly Sanitizer (90 min, cancelled by a 59-minute cold LLVM build) time out; grep for "LLVM prebuilt not found in GCS" before calling them flaky ([LLVM prebuilt key change hard-fails master-ref cold builds in release.yml](../learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md), [slang-ci-analytics merge_queue counter misreports](../learnings/1791534536175-slang-ci-analytics-merge-queue-counter-misreports-.md)).
- *Merge queue.* Non-required Windows aarch64 jobs time out and set the run conclusion to `cancelled`; counter consequences are on [CI rate metrics](ci-c-ci-metrics-rates.md).

A Linux cold build takes ~15 minutes, so the 120-minute ceiling bites only macOS and Windows aarch64 — except sanitizer-linux-clang-x86_64, where a ~1.5 h cold LLVM build plus the sanitizer build exceeds the 2-hour ceiling. Grep its log for "LLVM prebuilt not found in GCS" then "LLVM build complete"; a rerun reuses the old merge SHA, so only update-branch helps [back-audit after tightening a verdict gate](../learnings/1791807134236-back-audit-the-whole-tracker-after-tightening-a-ve.md). On macOS it is a race (debug took 94–99 minutes), not a certain failure, so don't gate requeues on tarball probes ([seeded LLVM prebuilt downloads fine yet breaks CMake configure (zstd)](../learnings/1791542291163-seeded-llvm-prebuilt-can-download-fine-yet-break-c.md), [failed merge-group check-ci does not imply eviction](../learnings/1791564244082-failed-merge-group-check-ci-does-not-imply-evictio.md)).

**A reseed can publish only some platforms.** `sccache-populate.yml`'s "Validate installed LLVM and Clang packages" step builds a `find_package(LLVM)` smoke project without `CMAKE_CXX_STANDARD`; LLVM headers need C++17, so Windows fails with MSVC C2429 and macOS on a missing `std::is_enum_v`, `publish-llvm` fails, and only linux tarballs upload. List the bucket per platform (`storage.googleapis.com/storage/v1/b/slang-ci-cache/o?prefix=llvm-prebuilts/`) before assuming a reseed warmed every runner ([LLVM prebuilt reseed publishes linux only](../learnings/1791563376870-llvm-prebuilt-reseed-publishes-linux-only-smoke-te.md)).

**A 200 on the tarball URL does not mean the prebuilt works** — so before fanning out reruns after a reseed, canary one job and read its log.
- *zstd at configure.* The `6bf2a1a7` linux-gcc-x86_64 and linux-gcc-wasm tarballs from a manual "Seed all LLVM prebuilts" run referenced `zstd::libzstd_shared` in `lib/cmake/llvm/LLVMExports.cmake`; the CI container (`slang-linux-gpu-ci:v1.7.0`) has no zstd, so jobs logged "Downloaded LLVM prebuilt" and failed CMake configure within a minute. Check with `curl -s <tarball> | tar -xzO --wildcards --occurrence=1 '*lib/cmake/llvm/LLVMExports.cmake' | grep zstd` against an older tarball; the `LLVM_ENABLE_ZSTD=OFF` reseed fixed it ([seeded LLVM prebuilt downloads fine yet breaks CMake configure (zstd)](../learnings/1791542291163-seeded-llvm-prebuilt-can-download-fine-yet-break-c.md)).
- *MSVC toolset skew at link.* On #13526 the reseeded windows-cl-x86_64 tarball (`dfeb31f6…`, HTTP 200) downloaded fine, but `slang-llvm.dll` failed to link (LNK2019/LNK2001 unresolved `__std_find_first_of_trivial_pos_1`, LNK1120) on all three Windows x86_64 jobs. Working hypothesis: the tarball was built on hosted windows-2022 (MSVC 14.44.35207) while the `win-build-*` runners have 14.43.34808, which lacks that STL helper. Don't rerun; compare toolsets by grepping `EXTERNAL_INCLUDE` / `MSVC\14.4x` in the seed and CI logs ([reseeded Windows LLVM prebuilt fails slang-llvm link on MSVC toolset skew](../learnings/1791577358779-reseeded-windows-llvm-prebuilt-can-fail-slang-llvm.md)).

**Probe and log mechanics.** Probe with `curl -s -o /dev/null -w '%{http_code}' -I <url>`; through the proxy the first `HTTP/1.1 200` in `curl -sI` can be the CONNECT response (false 200). `gh api .../actions/jobs/<id>/logs` needs `--allow-escape-sequences`; strip ANSI codes before quoting line numbers. After `gh run rerun <run> --job <id>` the run is `in_progress` and further `--job` reruns fail with "cannot be rerun"; wait and use the new attempt's job ids ([LLVM prebuilt key change hard-fails master-ref cold builds in release.yml](../learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md), [recompute a hashFiles() cache key offline](../learnings/1791548045410-recompute-a-github-actions-hashfiles-cache-key-off.md), [LLVM prebuilt key moves at reseed: probe both keys](../learnings/1791549704518-llvm-prebuilt-cache-key-moves-at-reseed-probe-both.md), [LLVM prebuilt reseed publishes linux only](../learnings/1791563376870-llvm-prebuilt-reseed-publishes-linux-only-smoke-te.md)).

## Checking Whether an Upstream LLVM Fix Has Shipped Before Planning a Bump

For a "bump LLVM to a version containing upstream PR X" issue (e.g. slang#13549 / llvm#229712), check three things before planning. **PR state:** `gh pr view <N> -R llvm/llvm-project --json state,mergedAt` — `gh api repos/llvm/...` REST returns 401 through the gateway, but `gh pr view` uses GraphQL and works. **Whether the fix is in a release:** fetch the touched file from raw.githubusercontent.com at each tag (`llvmorg-21.1.8`, `22.1.8`, `23.1.x`, `main`), compare md5s, and `git apply --check` the local backport on a temp tree of just those files. The quick form is `curl https://raw.githubusercontent.com/llvm/llvm-project/<ref>/<path> | grep <symbol>`, grepping a symbol the fix *adds* (for llvm#229712, `read32AArch64LdrAddend` in `RuntimeDyldCOFFAArch64.h`), not a pre-existing relocation name like `PAGEOFFSET_12L` (a false hit); on 2026-10-19 the helper was absent on `main` and `llvmorg-22.1.8`, so the Slang backport stays ([grep raw.githubusercontent for a symbol the fix adds](../learnings/1792427631921-check-whether-an-unmerged-llvm-fix-landed-on-main-.md)). Once merged, `gh pr view <n> -R llvm/llvm-project --json state,mergedAt,mergeCommit,milestone,comments` gives the merge SHA, and ancestry settles the tag: a cheap clone (`git init; git remote add origin https://github.com/llvm/llvm-project.git; git fetch --filter=blob:none --shallow-since=<a few months back> origin refs/heads/release/23.x:refs/remotes/origin/release/23.x refs/heads/main:refs/remotes/origin/main refs/tags/llvmorg-23.1.4:refs/tags/llvmorg-23.1.4`, ~25 s), then `git merge-base --is-ancestor <sha> <tag>`. A negative result in a shallow clone is weak, so back it with `git show <tag>:<file> | grep <new symbol>`. A `main` fix reaches an x.1.y release only through a backport (milestone "LLVM X.Y Release" + `/cherry-pick <sha>`, per llvm/docs/GitHub.md), and `llvmorg-N-init` is the branch point, not a release ([is an LLVM main commit in a release tag](../learnings/1793197406074-check-if-an-llvm-main-commit-is-in-a-release-tag-w.md)). **Tag dates:** `git ls-remote --tags` for the list, GraphQL `ref(qualifiedName:"refs/tags/…")` committedDate for dates. Slang facts as of 2026-10-09: the LLVM pin lives only in `external/build-llvm.sh:57` and `build-llvm.ps1:58`; deleting a backport patch rekeys the prebuilts (the key globs `external/llvm-*.patch`); LLVM 23 trips `static_assert(LLVM_VERSION_MAJOR < 23)` in `slang-llvm-jit-shared-library.cpp` (the Win64 RTDyld workaround); draft #11017 bumps to 22.1.4 ([checking whether an upstream LLVM fix has shipped](../learnings/1791577897128-checking-whether-an-upstream-llvm-fix-has-shipped-.md)).

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
