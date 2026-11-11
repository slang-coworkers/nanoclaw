---
title: "slang-test False Greens and Verification Discipline"
type: concept
group: slang-grab-bag
tags: [slang-test, test-harness, test-server, false-green, verification, positive-control, negative-control, stale-binary, unit-test, verbosity, replay-collision, CI]
source_count: 35
---

# slang-test False Greens and Verification Discipline

How a green slang-test run can carry zero information (test-server false greens, stale binaries, vacuous DIAGNOSTIC and FileCheck tests, SPIR-V lanes that never validate) and the controls that keep a PASS meaningful. Harness internals (`-v` plumbing, replay-folder collisions, in-process unit tests) are on [slang-test Harness Internals and In-Process Unit Tests](slang-test-harness-internals-and-unit-tests.md).

## TL;DR

- **Run `slang-test` from the repo root** (`-use-test-server -server-count 8`; `tests/x.slang`; `slang-unit-test-tool/`). **Never trust `$?`** (exit 0 seen on a FAILED test); parse `FAILED test:` / `% of tests passed`.
- **Harness false greens:** before PR #11753 a test-server crash was reported PASSED (a test "failing after #11753" crashes the server); the retry path reported failures as passes (#11911) until PR #12453 merged 2026-08-12.
- **Environment:** device caching defeats per-invocation debug-callback bridges; GPU-free tests of real RHI code use a real CPU device in a `gfx-unit-test`; an in-container startup crash is not a compiler failure if `slangc` works; suspect workload sizing for a flaky test. `-wgpu` rows run on the L40S only in a tree configured FRESH with `-DSLANG_EXCLUDE_DAWN=OFF` (plus `XDG_RUNTIME_DIR=/tmp`).
- **Prove the relink** (`test_binary_mtime > build_start`): would this be green if my change were not compiled in?
- **Drill on PR head + `origin/master`** when a related PR merged after the base; before claiming new master commits cannot affect a test, diff `tools/` and `slang-session.cpp`.
- **Re-run pass-counts and subagent reproducers yourself; grep IR by TYPE** (`kIROp_PseudoPtr`). Path arguments are string prefixes. A capability claim read off a mechanism one layer below is the tell; run the tool.
- **Negative-control every branch-coverage claim**; keep **one positive control per HAZARD, not per fix** (sabotage the specific guard, `if (owned)` → `if (true)`). **Count assertion-bearing tests and name the discriminating one**: where the fallback gives the fix's answer, the test proves nothing.
- **Probe each branch of a new pass at each parent kind** (function, global init, module-scope `static const`) via a whole-value use; a lowering moved later needs a `-target glsl` value run.
- **Bound a shared-resolver change by byte-comparing head vs master `slangc` over every SPIR-V test** (normalize worktree/prelude paths). Green on its own tests can still regress programs master compiles.
- **A worktree-cleanliness-guard trip can be a crashed test**: grep for `FAILED test:` first.
- **`diag=CHECK` is not FileCheck**: only `//CHECK:` is parsed (`CHECK-NOT`/`CHECK-DAG` silently dropped); matching is exhaustive by default and by substring; one diagnostic is often two rows. Single-line carets start at column 9; a separate `// ^^^` line checks nothing; use `/*CHECK: … */`. Drill each row on master; it catches crash→diagnostic only if crash and diagnostic are mutually exclusive.
- **SIMPLE lanes never run spirv-val, and failed modules still disassemble with `internal error 99999:`**, so `CHECK-NOT: error:` is vacuous; assert the buggy artifact absent. slang-test injects `-O0` (pass `-O1`) and reports compile-only SPIR-V tests IGNORED without Vulkan; verify with `slangc` + `SLANG_RUN_SPIRV_VALIDATION=1`.
- **Backend-codegen time is measurable** (`-report-perf-benchmark` + `tools/compile-perf`).

## Harness False Greens: Test-Server Crashes and Retries

Before PR #11753 a unit test that crashed the test server was reported **PASSED**: an RPC/connection death left `ExecuteResult` at default `resultCode=0` (Pass) ([crash reported PASSED (#11751)](../learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md)). #11753 changes only reporting, so a test that "starts failing after #11753" is crashing the server ([#11753: 'fails after' ⇒ crash](../learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md)). The retry path also reported failed unit tests as passing (#11911: the retry re-ran zero tests and the pending results were never counted) ([retry false-green](../learnings/1783009679066-slang-test-test-server-retry-false-green-11911-gh-.md)). Verify such fixes behaviorally (the registry-drain repro is platform-dependent); struct-driven harness internals can still carry a `slang-unit-test` ([verify behaviorally](../learnings/1783013967417-slang-test-harness-false-green-fixes-verify-behavi.md); [Harness Internals](slang-test-harness-internals-and-unit-tests.md)). A green merge-queue or per-PR gate did **not** certify C++ unit-test health until #11911 was fixed: PR #11913 closed unmerged, and PR #12453 merged 2026-08-12 ([merge-queue green ≠ unit-test health](../learnings/1783239972308-slang-merge-queue-green-c-unit-test-health-test-se.md)).

## Environment Traps: Startup Crash, Device Cache, GPU-Free Devices, Flaky Workloads, wgpu

`slang-test` can crash at startup in-container while `slangc` runs fine: not a compiler failure. Beware a codex "revert-without-rebuild" false positive (old binary still on disk) ([startup crash](../learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md)). Device caching silently defeats per-invocation debug-callback bridges: a cached device reuses the prior callback wiring, so a per-invocation regression goes green (from PR #11785) ([device caching](../learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md)). A GPU-free regression test of **real** RHI device code (not a mock) creates a real CPU-backend device in a `gfx-unit-test` `SLANG_UNIT_TEST` ([real CPU device](../learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md)). Flaky `parallelGenericEntryPointCompile` (#11759) was over-diagnosed as a concurrency race; the maintainer's PR #11761 was a 4-line workload reduction ([postmortem](../learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md)).

**`-wgpu` rows run locally only in a tree configured fresh with Dawn.** A default-preset build (`SLANG_EXCLUDE_DAWN=ON`) reports every `-wgpu` row `ignored`. A fresh tree configured with `cmake --preset default -DSLANG_EXCLUDE_DAWN=OFF` and run with `XDG_RUNTIME_DIR=/tmp` prints `Check wgpu,webgpu: Supported` on the L40S and gives real Tint + GPU runs; a tree reconfigured from excluded to OFF still reports `Not Supported` (that stale-cache state caused an earlier, now-corrected note that local wgpu rows never run). Dawn details: [WGSL on-GPU execution](slang-backends-wgsl-on-gpu-execution.md) ([-wgpu rows DO run](../learnings/1792790967029-correction-slang-test-wgpu-rows-do-run-locally-on-.md)).

## Stale Binaries and Per-Hazard Positive Controls

**A stale test binary can pass the very test you are validating.** Capture a timestamp before the build and require `test_binary_mtime > build_start`; a build can exit 0 having rebuilt nothing. On slangpy#1073 a 10-day-old `sgl_tests` binary passed the cross-thread profiler test meant to validate a concurrency fix; the mtime check caught it. *Would this be green if my change had not been compiled in?* applies to every derived artifact: binaries, generated docs, emitted assembly, lockfiles ([stale binary passes](../learnings/1785772374507-a-stale-test-binary-can-pass-the-very-test-you-re-.md)).

**One positive control per HAZARD, not per fix.** The slangpy#1073 fix for a reference leak in `Profiler::end_zone` released on every zone-stack mismatch, so one reference could be released twice, underflowing a packed counter in release builds (`release_zone_from_global_frame` asserts `count > 0`). Two controls: remove the release stanza (catches the leak) and weaken the ownership guard to `true` (catches the double-release; the test re-presents the rejected token so it can trip). Enumerate hazards (leak, double-release, underflow, deadlock, stall), sabotage each specific guard, and watch for a fix turning failure A into B (common in refcounting, ring buffers, completion gates) ([one control per hazard](../learnings/1785773520364-one-positive-control-per-hazard-when-a-fix-introdu.md)).

## Reproducer, Coverage and Count Discipline

**Negative-control a branch-coverage claim.** A test meant for one branch may pass through another always-present trigger: neuter the branch (`continue` instead of `return true`), rebuild, re-run; still green means it does not isolate the branch. On PR #12281 a generic-empty-type test passed with the `IRGeneric` branch of `hasEmptyTypeLegalizationWork` neutered (any named empty struct is hoisted to module scope and fires the struct-root scan anyway), so it was dropped ([negative control](../learnings/1785548777549-verify-a-test-isolates-its-target-branch-with-a-ne.md)).

**Drill on the merge, not only on the base.** When a related PR merged after a PR's base, build PR head + `origin/master` and re-run the drills there. On #13897 its hoisted shadow globals made #13883's regression test pass with #13883's fix reverted; a fragment-stage row, whose shadow is not hoisted, restores the pin. When a WGSL change removes a validation error, also probe multi-entry modules compiled without `-entry` (#13687): a shadow hoisted into a by-value/struct context turns a Tint rejection into a silently wrong value (the second entry point's context is never written; reads 0) ([base + master drills](../learnings/1792790967029-correction-slang-test-wgpu-rows-do-run-locally-on-.md)).

**"New master commits can't affect test X" needs a harness diff too.** On #14060 2 new commits touched neither the CUDA prelude, emitter nor `tests/`, but changed `tools/render-test/slang-support.cpp` and `source/slang/slang-session.cpp`, and render-test runs every CUDA/VK COMPARE_COMPUTE test. Run `git diff --stat <old> <new> -- tools/ source/slang/slang-session.cpp source/slang/slang-compiler*.cpp` and re-run on the new SHA if anything moved ([diff the harness](../learnings/1793317790858-new-master-commits-don-t-affect-test-x-diff-the-te.md)).

**Re-run a subagent's reproducer and grep IR by TYPE.** A subagent reported a PseudoPtr reproducer it never ran: the source failed in the front end with E41019, and its "PseudoPtr count" came from `grep -i pseudo` matching the mangled name `test_pseudo_ptr`. Anchor IR-type greps (`= *pseudo_ptr\(`, `kIROp_PseudoPtr`) ([grep the TYPE](../learnings/1785548791828-verify-a-subagent-s-reproducer-by-running-it-grep-.md)). PR-body pass counts are load-bearing: a subagent's `defer/` 39/39 was 38/38 fresh (13 dx11 variants ignored) ([re-run pass-counts](../learnings/1785349753826-verify-slang-test-suite-pass-counts-from-a-fresh-r.md)). Path arguments match by string prefix: `slang-test tests/autodiff` also ran `tests/autodiff-dstdlib/` (86 of 1165 lines on #13976). Pass a trailing slash or count what ran with `grep -oE 'tests/[a-z-]+/' <log> | sort | uniq -c` ([paths are prefixes](../learnings/1793207631255-slang-test-path-arguments-are-prefixes-not-directo.md)).

**Probe every branch of a pass at every parent kind, through whole-value uses.** On #13378 R2, `lowerArrayBuiltinCasts` looped for casts over 16 elements, and the loop branch asserted an enclosing block although its condition was `!literal || count > 16`. So `static const row_major float4x4 src[17]; static const float4x4 dst[17] = src;` with `dst` passed to a function hit release assert E99997 on every target; `dst[i]` reads missed it (a `getElement(cast)` peephole folds the cast). When a PR moves a lowering past `deferBufferLoad`, build its value test with `-target glsl`, where revived whole-buffer loads emit `copyLogical` and hit E99999 (#13379) ([arrays above the unroll limit](../learnings/1790933910032-late-lowered-ir-pass-test-literal-length-arrays-un.md)).

**Count assertion-bearing tests, not files, and name the discriminating one.** "6 tests committed" was 3 assertion-bearing tests plus 3 support inputs, and two of the three passed with the feature broken: PR #10907 (#10906) scoped a SPIR-V `DebugFunction` to its owning `DebugCompilationUnit`, but on a lookup miss emission falls back to a module-global scope pinned to the entry-point CU, so in a single-CU unit the broken fallback gives the expected answer. Only the two-CU test discriminates; say so in the PR body and a test comment. With a fallback, build the case where fallback and fix differ ([count assertion-bearing tests](../learnings/1785824059809-count-assertion-bearing-tests-not-test-files-and-n.md)).

**A worktree-cleanliness-guard failure can mask a real test failure.** On PR #12182 a leftover `moduleG6276.slang` (`slang-test left generated or modified files in the worktree`) looked like hygiene, but a fresh run showed `optixMultipleDefinition.internal` crashing deterministically on linux and windows. Grep the same run's log for `FAILED test:` / `COMPILE ERROR` / crash first ([guard masks a failure](../learnings/1785535887677-worktree-cleanliness-guard-can-mask-a-real-test-fa.md)).

## Bounding a Shared-Resolver Change: Byte-Compare Head vs Master

A small shared-resolver edit (PR #13610, `getGlobalParamAddressSpace` in `slang-ir-spirv-legalize.cpp`) cannot be bounded by reading the diff, but can be measured. Build Release at head, reuse a same-base Release build as master, and run both `slangc` binaries with identical arguments on every SPIR-V `//TEST:SIMPLE...:` line (cwd = head worktree, `-o` into a scratch dir) and compare stdout plus stderr; also compile every Vulkan compute test with `-target spirv-asm -stage compute`, plain and with `-fvk-t-shift 100 0 -fvk-s-shift 200 0 -fvk-u-shift 300 0`. **Normalize worktree paths first**: `-g2` embeds the `-I <bin dir>` `OpString` and source hashes (100+ apparent diffs vanished). Also log, under a `getenv` gate, every input where old and new logic disagree and run the suite with it set.

On #13610 this found an **undisclosed second fix**: a ParameterBlock in space ≥ 1 under `-fvk-u-shift`/`-fvk-t-shift` threw E99997 on master because the old loop was order-dependent (`[UA, RegisterSpace]` threw, `[RegisterSpace, UA]` did not); no issue, no test. The other ~226 changed reconciliations were overridden downstream. Cross-check newly accepted output against master's `-emit-spirv-via-glsl` `Binding`/`DescriptorSet` decorations (it never ICEd). A new `git worktree add` tree has no submodules: copy `external/` from a same-base worktree with `tar` ([byte-compare head vs master](../learnings/1791924730900-review-technique-byte-compare-head-vs-master-slang.md)), or run `git -c protocol.file.allow=always submodule update --init --recursive`; a plain update fails on the local-path URLs, and configure then fails with many `add_subdirectory` errors ([protocol.file.allow](../learnings/1792745836053-diagnostic-test-check-not-is-inert-but-passes-lint.md)).

**A branch green on its own tests can still regress programs master compiles.** PR #12014 (Metal exports) passed tests and review; /code-review plus a fresh master `slangc` (~6 min, `--target slangc`, 64 cores) found 3 regressions (shapes on [IR address-space specialization](slang-compiler-ir-address-space-specialization.md)). Pitfalls: a `--target slangc`-only baseline lacks slang-glslang/spirv-opt (`-target spirv-asm` exits 255); cuda/cpp output embeds the worktree's absolute prelude `#include` path, so normalize it before `cmp`; and the 3 `tests/cooperative-matrix/fp8-cuda*.slang` tests fail on master on an L40S with CUDA_ERROR_INVALID_PTX ([compare against a master binary](../learnings/1793271336216-compare-a-compiler-fix-against-a-master-binary-not.md)).

## DIAGNOSTIC_TEST (`diag=CHECK`) Authoring

**The matcher is not LLVM FileCheck.** `checkAnnotations` (`tools/slang-test/diagnostic-annotation-util.cpp`, via `_diagnosticAnnotationTest`) matches against machine-readable diagnostics (one tab-separated row of code, severity, location, message; no source echo). Only `//CHECK:` is recognized; `//CHECK-NOT:` and `//CHECK-DAG:` are **silently dropped** (they work only under `filecheck=CHECK`), so a `non-exhaustive` test with only those passes vacuously. Negative guarantees come from **exhaustive matching, the default** (`exhaustive = !isNonExhaustiveDiagTest()`): every emitted row must match and vice versa, so an unexpected `E99997` ICE or a duplicate diagnostic fails "Exhaustive check failed", and a case that must not warn stays unannotated. Each annotation matches one row by substring of message, severity, code or "severity code". One diagnostic is often two rows (primary + span, deduplicated only when the span text equals the primary), so annotate both (`//CHECK: E29000` + `//CHECK: snippet`). No-location diagnostics (Line 0/Col 0) work if every row is annotated by text, in emission order. Use `non-exhaustive` only for a deliberately unannotated secondary diagnostic (the harness rejects an unneeded one) ([CHECK-DAG ignored](../learnings/1789680163713-slang-test-diag-check-check-dag-is-ignored-and-non.md); [exhaustive](../learnings/1789718875570-slang-diag-check-diagnostic-test-is-exhaustive-and.md)). Corollary: when two passes diagnose one IR shape, establish the winning diagnostic exactly where you suppress the other, since the passes can differ in reachability.

**Caret columns.** `//CHECK:` is 8 chars, so `//CHECK:^^^ E41000` puts the first caret at column 9, while `//CHECK: ^^^` shifts every caret and fails "Column position(s) don't match". Copy the "Suggested annotations" block printed on mismatch; match by error CODE, not free text. Provenance: `git blame`/`%aN` render names via `.mailmap` (`Tim Foley` → `Theresa Foley`), so quote the name blame shows, not raw `%an`; find a comment's origin PR with `git log -1 <sha>` or `git log -S '<text>' --reverse` ([carets + .mailmap (#12236/#12245)](../learnings/1785230187967-diagnostic-test-caret-alignment-git-blame-mailmap-.md)).

**Two caret forms check nothing or cannot reach.** A `//CHECK:` line followed by `//   ^^^^ message` is not a check: on PR #13659 such a `DIAGNOSTIC_TEST(diag=CHECK,non-exhaustive)` passed on master (no such diagnostic) and with the cause removed. The single-line form cannot point below column 10. The block form works, carets aligned to the previous non-annotation line:
```
uint loadWithTargetOnly()
/*CHECK:
     ^^^^^^^^^^^^^^^^^^ 'loadWithTargetOnly' uses undeclared capability 'spirv_1_0'
*/
```
Every new diagnostic test must FAIL on master or without the cause ([separate caret line](../learnings/1792102157772-diagnostic-test-caret-annotations-a-separate-check.md)).

**Drill per row, not per file.** On #13718 (local types cannot see enclosing locals), the row `cbuffer CB { int c; }; struct L { int get() { return c; } };` passed on head, but master gave the same `E30015 undefined identifier 'c'` at the same column, so it guarded nothing and the fix's breadcrumb leg (`_refersToFunctionCallValue`) was untested: disabled, all 13 rows stayed green; `fprintf` instrumentation over all 5,329 test files gave it 0 hits. It was reachable only through a lambda (`let f = () => { struct L { int get() { return c; } }; ... }`), where master emits a silent `return _S1;` and the SPIR-V emitter ICEs ([row pins nothing](../learnings/1792181706579-a-diagnostic-test-row-can-pin-nothing-when-master-.md)).

**Crash→diagnostic regressions.** `_diagnosticAnnotationTest` ignores the result code, yet catches a crash regression: the segfault leaves stderr empty, so the expected diagnostic (e.g. `E30015`) is unmatched. That holds only when diagnostic and crash are mutually exclusive, as for a front-end error, because `executeActionsInner` returns before `generateIR()` on a non-zero error count; if the crash is downstream of the diagnostic, add a `SIMPLE` `.expected` test asserting `result code = N`. A fatal diagnostic suppresses codegen, so positive-compilation cases live in a separate file ([empty stderr](../learnings/1785349746955-diagnostic-diag-check-catches-a-crash-regression-v.md)).

## SPIR-V Test Verification

**FileCheck vacuity.** A `-target spirv` SIMPLE test with a positive shape line plus `//CHECK-NOT: error:` can pass with or without the fix (#12592): rejected SPIR-V is still disassembled (`slang-emit.cpp` calls `disassemble(...)` regardless), so `OpTypePointer StorageBuffer` matches the failed output, and a validation failure prints `internal error 99999:`, with no `error:` substring. It also matches buggy and fixed modules alike when only a slot's pointee is wrong. Assert the buggy artifact is ABSENT (`//CHECK-NOT: PhysicalStorageBuffer`) or that `OpVariable`/`OpStore` operand types agree, and run every new SPIR-V test against the pre-fix binary ([`internal error` defeats `CHECK-NOT`](../learnings/1789244351461-slang-spir-v-test-vacuity-a-validation-failure-dis.md)).

**A SIMPLE lane does not run SPIR-V validation.** A control fragment shader calling `GroupMemoryBarrierWithGroupSync()` (VUID-04682 under slangc with validation on) PASSED a `-target spirv -stage fragment` SIMPLE lane with `X-NOT: VUID`, and the "standard error = {" block also matches a naive `-NOT: error`. Pin the construct with `-target spirv-asm` (`CHECK: OpEntryPoint Fragment`, `CHECK-NOT: OpControlBarrier`), run validation separately with slangc for PR evidence, and test any "no error" detector against a known-bad control (#13631 / PR #13659) ([SIMPLE skips validation](../learnings/1792090114561-slang-test-simple-lanes-do-not-run-spir-v-validati.md)).

**Local verification traps** on a GPU- or Vulkan-less machine:

1. spirv/spirv-asm tests carry a Vulkan render-API requirement and report **IGNORED (0/0)** with no Vulkan device (slang-test-main.cpp ~5980-6009), even known-good `coverage-counter-width-*-spirv.slang` and `atomic-64bit.slang`. SPIR-V emit is compile-time, so verify with `slangc` plus `SLANG_RUN_SPIRV_VALIDATION=1` (off by default; CI exports it). It validates Slang's **pre-optimizer** module, and spirv-asm shows a constant's value but not its word count, so FileCheck on `OpConstant %long 0` cannot catch a 32-bit-under-64-bit pointer-sized constant; only validation can ([IGNORED without Vulkan](../learnings/1790009629117-spir-v-compile-only-tests-are-render-api-tagged-ve.md)).
2. slang-test injects `-O0` when a directive gives no opt level (`slang-test -v` confirms), so a `CHECK-NOT: OpCompositeConstruct` never exercises spirv-opt: at `-O0` the #13206 repro is still invalid but emits `OpCompositeExtract`, a false green. Pass `-O1` on SIMPLE and `-Xslang -O1` on COMPARE_COMPUTE ([injects -O0](../learnings/1790037466327-slang-test-injects-o0-verifying-spir-v-logical-poi.md)).
3. The in-tree validator is **v2026.4.rc2** (not the recalled v2024.2) and rejects logical-pointer Function vars, so validation (plus a spirv-asm `CHECK-NOT` on `OpCompositeConstruct`/`OpCompositeExtract` of a `%_ptr_Workgroup_*` type) beats text matching. Check the version; don't recall it ([v2026.4.rc2](../learnings/1790785645539-slang-in-tree-spirv-val-v2026-4-rc2-does-catch-log.md)).

## Subagent Bottom Lines: Backend-Codegen Timing Is Measurable

"Front-end or backend?" needs no compiler change: `slangc -report-perf-benchmark` prints `[*] <phase> <count> <ms>` timers, and `tools/compile-perf/breakdown.py:56` lists **`emitEntryPointsSourceFromIR`** (the `SLANG_PROFILE` at `slang-emit.cpp:2747`) as a named bucket under `generateOutput`. An `Explore` subagent concluded the opposite, reading `SLANG_PROFILE` as a flat RAII timer and missing that `breakdown.py` reconstructs nesting. The tell is a CAPABILITY claim derived from a MECHANISM one layer below; run the tool. The profiler is flat, so `breakdown.py` shows a parent's unnamed residual as `<parent> (self)` ([codegen timing](../learnings/1785838127386-backend-codegen-compile-time-is-separately-measura.md)).

## The Through-Line

Skipped test, stale binary, vacuous assertion, inert `CHECK-NOT`, a row master already rejects: one bug, **present but not exercising**. Name the assertion that fails when only the defect is reintroduced, and control both directions (break each positive, expect RED; restore, confirm green).

**Source learnings (35):**
- [SPIR-V tests IGNORED without Vulkan](../learnings/1790009629117-spir-v-compile-only-tests-are-render-api-tagged-ve.md)
- [spirv-val v2026.4.rc2](../learnings/1790785645539-slang-in-tree-spirv-val-v2026-4-rc2-does-catch-log.md)
- [slang-test injects `-O0`](../learnings/1790037466327-slang-test-injects-o0-verifying-spir-v-logical-poi.md)
- [`internal error` defeats `CHECK-NOT: error:`](../learnings/1789244351461-slang-spir-v-test-vacuity-a-validation-failure-dis.md)
- [RPC failure reporting (#11753)](../learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md)
- [test-server crash reported Pass (#11751)](../learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md)
- [flaky test: workload, not race (#11759)](../learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md)
- [startup crash; revert-without-rebuild](../learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md)
- [device caching defeats callback bridges](../learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md)
- [real CPU device in gfx-unit-test](../learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md)
- [retry false-green (#11911)](../learnings/1783009679066-slang-test-test-server-retry-false-green-11911-gh-.md)
- [harness fixes: verify behaviorally](../learnings/1783013967417-slang-test-harness-false-green-fixes-verify-behavi.md)
- [merge-queue green ≠ unit-test health](../learnings/1783239972308-slang-merge-queue-green-c-unit-test-health-test-se.md)
- [caret columns + .mailmap (#12236)](../learnings/1785230187967-diagnostic-test-caret-alignment-git-blame-mailmap-.md)
- [diag=CHECK catches crash via empty stderr](../learnings/1785349746955-diagnostic-diag-check-catches-a-crash-regression-v.md)
- [re-run pass-counts (39/39 vs 38/38)](../learnings/1785349753826-verify-slang-test-suite-pass-counts-from-a-fresh-r.md)
- [cleanliness guard masks a failure (#12182)](../learnings/1785535887677-worktree-cleanliness-guard-can-mask-a-real-test-fa.md)
- [negative-control branch coverage](../learnings/1785548777549-verify-a-test-isolates-its-target-branch-with-a-ne.md)
- [run the reproducer; grep IR by TYPE](../learnings/1785548791828-verify-a-subagent-s-reproducer-by-running-it-grep-.md)
- [stale binary passes (slangpy#1073)](../learnings/1785772374507-a-stale-test-binary-can-pass-the-very-test-you-re-.md)
- [one positive control per hazard](../learnings/1785773520364-one-positive-control-per-hazard-when-a-fix-introdu.md)
- [count assertion-bearing tests (#10907)](../learnings/1785824059809-count-assertion-bearing-tests-not-test-files-and-n.md)
- [backend-codegen time is measurable](../learnings/1785838127386-backend-codegen-compile-time-is-separately-measura.md)
- [CHECK-DAG ignored; non-exhaustive vacuous](../learnings/1789680163713-slang-test-diag-check-check-dag-is-ignored-and-non.md)
- [diag=CHECK exhaustive; primary + span rows](../learnings/1789718875570-slang-diag-check-diagnostic-test-is-exhaustive-and.md)
- [late-lowered pass arrays (#13378)](../learnings/1790933910032-late-lowered-ir-pass-test-literal-length-arrays-un.md)
- [byte-compare head vs master (#13610)](../learnings/1791924730900-review-technique-byte-compare-head-vs-master-slang.md)
- [SIMPLE lanes skip SPIR-V validation (#13659)](../learnings/1792090114561-slang-test-simple-lanes-do-not-run-spir-v-validati.md)
- [separate caret line checks nothing (#13659)](../learnings/1792102157772-diagnostic-test-caret-annotations-a-separate-check.md)
- [row pins nothing when master rejects (#13718)](../learnings/1792181706579-a-diagnostic-test-row-can-pin-nothing-when-master-.md)
- [-wgpu rows run; head + master drills](../learnings/1792790967029-correction-slang-test-wgpu-rows-do-run-locally-on-.md)
- [worktree submodules need `protocol.file.allow`](../learnings/1792745836053-diagnostic-test-check-not-is-inert-but-passes-lint.md)
- [path arguments are prefixes](../learnings/1793207631255-slang-test-path-arguments-are-prefixes-not-directo.md)
- [compare against a master binary (#12014)](../learnings/1793271336216-compare-a-compiler-fix-against-a-master-binary-not.md)
- [new master commits: diff the harness (#14060)](../learnings/1793317790858-new-master-commits-don-t-affect-test-x-diff-the-te.md)

_Catalog: [[wiki/index.md]]_
