---
title: "slangc CLI, Freshness & Emit-Verification Mechanics"
type: concept
group: slang-tooling
tags: [slangc, cli, filecheck, dump-ir, diagnostics, version, freshness, check-cmdline-ref, render-test]
source_count: 25
---

# slangc CLI, Freshness & Emit-Verification Mechanics

How to invoke `slangc` correctly for local verification: the slangc-only build, confirming binary freshness (the version-string trap), the CLI help-text doc CI gate, how `-dump-ir` and FileCheck buffers behave, why render-test lanes differ from slangc, slang-test's two default-flag injection forms, and the diagnostic-catalog naming split. Target coverage, backend emit/codegen mechanics and per-target triage live on [slangc Target Coverage & Capability Gating](slangc-target-coverage-and-capabilities.md), [slangc Target Output & Obfuscation](slangc-target-output-and-obfuscation.md), and [slangc Wave Intrinsics, VM Emitter & Inliner](slangc-wave-vm-and-inliner.md).

## TL;DR

- **Build slangc-only** (`cmake --build --preset debug --target slangc`) to dodge the `slang-rhi`→`vulkan.h`→`X11/Xlib.h` break on headless Linux; it suffices for all text-target emit verification (HLSL/CUDA/Metal/GLSL/SPIR-V-asm FileCheck).
- **`slangc -v` is baked at cmake CONFIGURE time**, so it proves neither staleness nor freshness, and a reconfigure does not refresh it. Confirm by object mtime, a feature probe, or `git diff --stat <baked-sha>..HEAD`; watch ninja for `.cpp.o` lines (an incremental build can exit 0 having only copied the version header). In a shared checkout, cite the HEAD `git reflog` shows at the `libslang-compiler.so` mtime.
- **Any `slangc` help/description string edit** (`slang-options.cpp` or the `slang-type-text-util.cpp` tables) trips `check-cmdline-ref`: REGENERATE `docs/command-line-slangc-reference.md`, never hand-edit. `nv-slang-bot` cannot self-dispatch `/regenerate-cmdline-ref`.
- **`-dump-ir` shows the CODEGEN pipeline**, not the validation-only one, and emits NOTHING unless slangc runs the backend (add `-o /dev/null` or `-entry`/`-stage`).
- **`COMPARE_COMPUTE` lanes run under render-test**: a different parser (rejects `-warnings-disable`) that requires empty stderr. Put profile assertions on `SIMPLE(filecheck=...)` lanes. A new warning fails every triggering COMPARE_COMPUTE* leg on GPU CI only: sweep `tests/` with the PR `slangc`; suppress with `-xslang -Wno-<id>`.
- **render-test defaults differ:** ROW-major matrices (slangc: column-major) and STANDARD debug info unless `-g0`. Layout-sensitive pairs need both explicit layout flags; a `-cpu` IR-optimization regression test needs `-g0` and a confirmed FAIL on the unfixed binary.
- **Bound a hang/OOM repro first:** `( ulimit -v 8000000; timeout 60 slangc ... )` gives a segfault (rc=139) in seconds. Use gdb where present (launch under it; `ptrace_scope=1` blocks attach); prod coworker images have no gdb/lldb/perf, so use a parent-process ptrace sampler. On a hang use `-dump-ir-before <pass>`; an `### AFTER <pass>:` header before a `bad_alloc` does not mean the pass returned.
- **Old releases (v2025.2x and earlier) print `error 30019:`, new ones `error[E30019]:`**: when bisecting, check the exit status and grep `error\[?E?[0-9]+`.
- **A default slang-test flag needs TWO forms:** bare (`-O0`) for slangc-backed paths, `-Xslang -O0` for render-test-backed ones, injected per run-function.
- **Two diagnostic catalogs:** `slang-diagnostics.lua` → PascalCase C++ symbols; `slang-misc-diagnostic-defs.h` → verbatim camelCase. Grep both before calling a diagnostic dead.

## Building slangc-only to avoid slang-rhi / X11 failures

On Linux containers without X11 headers, a full `cmake --build --preset debug` fails because `external/slang-rhi` pulls in `vulkan.h` → `X11/Xlib.h`. `slangc` does not depend on `slang-rhi`, so build only that target:

```
git submodule update --init --recursive
cmake --preset default
cmake --build --preset debug --target slangc
```

That covers all text-target emit verification (HLSL, CUDA, Metal, GLSL, SPIR-V-asm); it cannot run GPU tests (no `slang-test`/`render-test`). Containers have an NVIDIA L40S as of 2026-10-16 (the 09-28→10-16 no-GPU period was a host outage), so build `slang-test` when a task needs real GPU execution. A first debug build from a fresh clone takes a few minutes after submodules and configure ([slangc-only build (X11 missing)](../learnings/1780352276660-verify-slang-diagnostics-with-slangc-only-build-sl.md), [slangc-only dodges slang-rhi/X11](../learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md)).

## Confirming the binary reflects HEAD (the version-string trap)

`slangc -v` reports a `git describe` string baked at **cmake configure time**. An incremental build does not regenerate `slang-tag-version.h`, so the string can be weeks behind HEAD even after a recompile; a stale-looking string does not prove staleness, nor a matching one freshness.

Reliable checks (~2 min):
1. **Object mtime:** `find build -name 'slang-emit-spirv.cpp.o' -printf '%t %p\n'`; the `.o` should be newer than the source after `git reset --hard origin/master`.
2. **Feature probe:** compile a shader using a feature that landed after the suspect commit (e.g. WGSL `[WaveSize(32)]` → `@subgroup_size(32)` proves a build contains #14065).
3. **Diff identity:** `git diff --stat <baked-sha>..HEAD -- source/`; if no investigated file changed, behavior on that path is correct regardless.
4. **Binary mtime vs reflog:** compare the binary's mtime with `git reflog --date=iso` and with the mtimes of files changed since (`git diff --name-only <old> HEAD`). A Windows-only file (`source/compiler-core/windows/*`) cannot stale a Linux binary. Measured 2026-10-28: a Debug build printed `2026.13.1-50-g3649fb982` while HEAD was 3218a7612 ([configure-time describe](../learnings/1793201892976-slangc-version-shows-configure-time-git-describe-n.md)), and after `git checkout` plus an incremental build in an old worktree a 3218a7612 binary printed `2026.19-19-gfeb2452bf`. In a report, name the SHA from `git rev-parse HEAD`, never `-version` ([old worktree's describe](../learnings/1793205140280-disable-non-essential-validations-contract-help-te.md)). In the shared `/workspace/agent/slang` checkout, siblings and a cron `git pull --ff-only` without rebuilding, so HEAD is not the build either: the built SHA is the HEAD `git reflog --date=iso` shows current at the mtime of `build/Release/lib/libslang-compiler.so*` (the ~339 KB `slangc` is not the compiler). Cite it, then `git diff --stat <built> HEAD -- <files you cite>` to show the gap is irrelevant (2026-11-03: built 96a728c85, HEAD 7f506f4c9, which touched only `slang-session.cpp`). Don't rebuild in the shared build dir right after a sibling pulls; the builds collide ([shared build SHA from reflog + mtime](../learnings/1793666085824-infer-the-sha-a-shared-slang-release-build-was-mad.md)).

Re-running `cmake --preset` does not refresh the string: `get_git_version` (`CMakeLists.txt:7`) stores `SLANG_VERSION_FULL` with a non-`FORCE` `set(... CACHE STRING ...)` (`cmake/GitVersion.cmake:113`), and deleting `slang-tag-version.h` only regenerates it from the cache. `-U 'SLANG_VERSION*'` or `--fresh` re-runs `git describe`. Once behavior confirms the binary, the cosmetic staleness is harmless ([baked at CONFIGURE](../learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md), [feature-probe ToT](../learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md), [cached binary weeks-stale](../learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md)).

An incremental `--target slangc` can exit 0 doing almost nothing (copying the version header), leaving a stale binary; watch ninja for `.cpp.o` recompile lines. If a provisioning process is writing `build/Debug/`, wait for mtime quiescence (~30s) before building, to avoid ELF corruption ([baked at CONFIGURE](../learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md)).

## Help text and the check-cmdline-ref CI gate

Any edit to a `slangc` help/description string, whether a new `-fxxx` option in `initCommandOptions` (`slang-options.cpp`) or the tables in `source/core/slang-type-text-util.cpp` (debug levels, optimization levels, etc.), changes `slangc -help-style markdown -h`, and the `check-cmdline-ref` job hard-fails on its diff against `docs/command-line-slangc-reference.md`. Regenerate it (`./build/Debug/bin/slangc -help-style markdown -h > docs/command-line-slangc-reference.md`) and commit both files together; never hand-edit, since the format is fragile (trailing whitespace, registration order). `check-capability-atoms-ref` diff-checks `docs/user-guide/a4-02-reference-capability-atoms.md` against `slang-capabilities.capdef` the same way ([help-text edits must regenerate](../learnings/1784827777508-slangc-help-text-edits-require-regenerating-comman.md)).

The canonical fix is the `/regenerate-cmdline-ref` slash command (`.github/workflows/regenerate-cmdline-ref.yml`), but posted as `nv-slang-bot[bot]` it does NOT dispatch (the bot lacks the write permission slash-command-dispatch requires); verify with `gh run list -R shader-slang/slang --workflow=regenerate-cmdline-ref.yml -L 5`. Without a build or dispatch, note on the PR that the only red is doc-staleness and hand off to a maintainer with build+dispatch rights ([bot can't self-fix check-cmdline-ref](../learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md)).

## slangc -dump-ir: codegen pipeline only

`-dump-ir` prints the IR of the **codegen** pass sequence. Diagnostics gated on `shouldRunNonEssentialValidation()`, including the uninitialized-use checker (`checkForUsingUninitializedValues`), run on a SEPARATE IR view the dump does not capture, so "inst X never appears" in a dump says nothing about what the checker sees. For validation-block diagnostics (uninit-use, missing-returns, recursive-types) use `insttrace.py` on the actual inst or an ad-hoc `dumpIRToString()` at the checker's call site, and gate on "does the fix make the repro warn?" rather than a dump-derived story ([codegen, not validation pipeline](../learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md)).

A `SIMPLE(filecheck=...)` test on `-dump-ir`/`-dump-ir-before`/`-dump-ir-after` output only works when slangc runs the backend: a module with just an `export`/`export __extern_cpp` function, no `-entry ... -stage ...` and no `-o <file>` exits 0 with EMPTY stdout+stderr, and FileCheck reports "expected string not found." Add `-o /dev/null` (an existing tests/ idiom) or an entry point. Conversely, slang-test's `getOutput` (slang-test-main.cpp:1860) merges the stderr `-dump-ir` writes into the FileCheck buffer regardless of exit code, so a nonzero-exit compile is still FileCheck-testable; "no output requested" is the blocker ([-dump-ir needs -o or -entry](../learnings/1785554892234-dump-ir-emits-nothing-unless-slangc-runs-the-backe.md)).

On a **hang**, `-dump-ir` prints nothing; `-dump-ir-before <pass>` still writes before a `timeout` kill. `ptrace_scope=1` here blocks `gdb -p <pid>`, so launch under gdb: `timeout 90 gdb -q -batch -ex run -ex 'bt 30' --args slangc ... > gdb.txt &`, then `pkill -INT -x slangc` and read the `#N` frames. On #12564 this placed the hang in `translateEntryPointInParamToBorrow` (`slang-emit.cpp:1098`), long before `fixEntryPointCallsites` (`:2333`) ([gdb + SIGINT backtrace](../learnings/1790959668691-slang-get-a-backtrace-of-a-hung-slangc-by-running-.md)).

**A hang with unbounded memory growth needs a cap first, and prod coworker images have no debugger.** #14278's WGSL legalization grew ~250 MB/s (~150 GB in 10 min), so never run such a repro bare in a shared container. `( ulimit -v 8000000; timeout 60 slangc ... )` makes slangc segfault (rc=139) in ~30 s, a bounded, repeatable signal; to prove growth rather than an early crash, background it and sample `ps -o rss= -p $PID` every 2 s. The bundled `build/slang-2026.13.1-linux-x86_64/bin/slangc` is an old no-build baseline for labeling a side finding pre-existing ([ulimit -v cap](../learnings/1793748466615-reproduce-a-slangc-hang-or-oom-under-a-ulimit-v-ca.md)). The prod image (2026-11-03) lacks gdb/lldb/perf but has `addr2line`, `nm` and python3, and `ptrace_scope=1` still lets a *parent* attach to descendants. A ~60-line python ctypes sampler works: `Popen` the bounded slangc (`timeout 40 bash -c 'ulimit -v 6000000; slangc ...'`), `PTRACE_ATTACH` at 3/5/7 s, read RIP/RSP with `PTRACE_GETREGS` and ~64 KB of stack with `PTRACE_PEEKDATA` (`/proc/<pid>/mem` reads failed silently), then detach. Symbolize by bisecting `nm -C --defined-only build/Release/lib/libslang-compiler.so.*.dwarf` (`addr2line` over many addresses takes over 2 min); scanning the stack for return addresses gives a usable call chain on a Release build without frame pointers. On #14278 it showed WGSL `GlobalInstInliningContext::inlineInst` cloning a module-scope `@SpecConst` add that `_createInst` GVN-dedups back to the original, after which the decoration loop clones `nameHint` into the inst it is iterating; SPIR-V avoids this via the `isSpecConstRateType` check in its `isLegalGlobalInstForTarget`. Post-pass hooks run from `~PassHooksRAII` (`slang-pass-wrapper.h`), so when a pass throws `std::bad_alloc` the destructor still prints `### AFTER <pass>:` before the dump throws (`terminate called ... bad_alloc`); that header does not mean the pass returned, and without dump flags the failure is E99998 ([ptrace sampler; misleading AFTER](../learnings/1793749800691-sampling-a-hung-slangc-without-gdb-misleading-afte.md)).

## render-test vs slangc: COMPARE_COMPUTE lanes are a different program

A `//TEST(compute):COMPARE_COMPUTE(...):-vk` lane runs under **render-test**, whose option parser differs from `slangc`'s:

- It **rejects** slangc-only flags like `-warnings-disable` (`error 1004: unknown command-line option`, empty result buffer).
- It diffs stderr against empty, so any diagnostic (even warning E41012 "profile implicitly upgraded") fails the lane with correct GPU output.

So a slangc-local pass does not predict the CI lane. Keep the runtime smoke test on the **default** profile and put profile-specific assertions on a static `SIMPLE(filecheck=...):-profile <p> -target spirv` lane (SIMPLE does not diff stderr) ([render-test is not slangc](../learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md)).

The empty-stderr rule makes a NEW warning a breaking change: every `COMPARE_COMPUTE`/`COMPARE_COMPUTE_EX` leg whose shader triggers it fails on GPU CI, while `SIMPLE(filecheck=…)` legs pass (FileCheck matches only CHECK lines), and local no-GPU runs report the compute legs ignored. PR #11709's E30709 (groupshared → `out`) failed `tests/metal/out-param.slang` on the vk/mtl legs of every GPU job; the fix was `-xslang -Wno-30709` on the compute directives (precedent: `tests/language-feature/shader-params/entry-point-uniform-params-implicit.slang`). Before shipping a warning, compile every `tests/**/*.slang` that could trigger it with the PR's `slangc` (no `-entry` needed; checking still runs; #11709: 91 files in ~2 min), grep for the code, and inspect each hit's `//TEST` directives. To prove a suppression locally, A/B the flag on a temporary `-cpu` COMPARE_COMPUTE_EX copy; a front-end warning fires on any target ([new warning fails COMPARE_COMPUTE](../learnings/1790743536144-a-new-slang-warning-fails-compare-compute-tests-th.md); [empty stderr required](../learnings/1790744483266-a-new-slang-warning-can-fail-gpu-tests-the-compute.md)).

**render-test's session defaults differ from slangc's; derive expected values with render-test's settings.** **(1) Matrix layout is ROW-major.** `tools/render-test/slang-support.cpp` builds a value-initialized `slang::SessionDesc` without `defaultMatrixLayoutMode`, inheriting `SLANG_MATRIX_LAYOUT_ROW_MAJOR` (`include/slang.h:4494`); slangc defaults to column-major. With `float layoutOf<let L : MatrixLayoutMode>(matrix<float,2,3,L> m) { return float(L); }` on a plain `float2x3`: bare RUN line → 1, `-Xslang -matrix-layout-row-major` → 1, `-Xslang -matrix-layout-column-major` → 2. So a "both layouts" test of bare + row-major covers row-major twice (on #13389 the real column-major run exposed a pre-existing CPU `Ptr<float2x3>` storage bug): require explicit row-major AND column-major flags. Derive expected values with `-matrix-layout-row-major -emit-spirv-directly`; reasoning from slangc's default once named the wrong failing case in a posted #13382 triage. For vertex-input tests without a GPU: attributes `A0..A6` are in `render-test-main.cpp:169-185` / `:1030-1037` (A3..A6 = (1,2,3,4) … (13,14,15,16)) and the Vulkan location equals the element index, so the output follows from the `OpAccessChain` indices; DXC→SPIR-V ignores `row_major`/`column_major` on vertex inputs, DXC→DXIL honors it ([row-major RUN line duplicates bare](../learnings/1790935550719-render-test-s-default-matrix-layout-is-row-major-a.md), [ROW-MAJOR default](../learnings/1790924620893-render-test-compiles-with-a-row-major-matrix-defau.md)). The #13389 atom also records a checker hazard: the per-module `m_typeConversionCostCache` (TypePair key) omits `isLeftValue`, so an earlier `inout`/`out` call can poison a later overload choice for any type routed away from the global `BasicTypeKey` cache. **(2) Debug info is ON.** render-test sets `DebugInformation = STANDARD` unless `-g0` (`slang-support.cpp:273-281`, inside `if (generateSPIRVDirectly)`, default true at `options.h:89`, so `-cpu` lanes get it too). On master `-g` perturbs the IR enough that the #13409 redundant-load-forwarding bug (groupshared written by a `[noinline]` callee) does not fire (`slangc -g -target cpp` re-loads; plain `-target cpp` folds to the stale constant), so a `-cpu` COMPARE_COMPUTE regression test passed on master. Add `-g0` to a COMPARE_COMPUTE line guarding an IR-optimization bug and confirm it FAILS unfixed ([-cpu tests hide IR bugs unless -g0](../learnings/1790982231204-slang-cpu-compare-compute-tests-can-hide-ir-optimi.md)). **(3) Input data:** in `TEST_INPUT:ubuffer(data=[1 2 3])`, integers without `.0` are stored as int bits even for float fields; write `1.0 2.0 3.0` ([TEST_INPUT int bits](../learnings/1790896856276-slang-test-filecheck-buffer-tests-pass-vacuously-w.md)).

## slang-test default compiler flag: two injection forms required

`tools/slang-test/slang-test-main.cpp` has two argument-assembly classes:

1. **Compiler-backed tests** (runSimpleTest, runReflectionTest, etc.) build a `slangc` command line: append the flag bare, `-O0`.
2. **Render-test-backed tests** (runCompileTarget, runComputeComparisonImpl, etc.) build a `render-test` command line: forward via `-Xslang -O0`.

The single `_gatherTestOptions` chokepoint cannot distinguish the consumers, so inject per run-function (~15 sites) or via two helpers, preserving explicit test `-O*` by scanning directive tokens ([two forms](../learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md)).

## Diagnostic catalog naming and output format

- **`source/slang/slang-diagnostics.lua`**: kebab-case names (`multi-dimensional-array-not-supported`) become **PascalCase** C++ symbols (`Diagnostics::MultiDimensionalArrayNotSupported`).
- **`source/compiler-core/slang-misc-diagnostic-defs.h`**: the X-macro `DIAGNOSTIC(code, severity, name, ...)` uses `name` verbatim in camelCase (`MiscDiagnostics::invalidArgumentForOption`).

A single-case grep silently misses live entries in the other catalog: zero hits on both forms before calling a diagnostic dead. A failed naive repro is no substitute, since diagnostics are gated on specific syntactic shapes ([PascalCase vs camelCase](../learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md)).

**The output format changed between releases.** v2025.2x and older print `file.slang(9): error 30019: ...`; newer print `error[E30019]: ...`. `grep -oE 'error\[E[0-9]+\]'` finds nothing on an old binary, so a failing old compile looks like success; this produced a false "regression since v2025.24" claim that OUTPUT_REVIEW caught. Check the exit status (255 on error) and grep `error\[?E?[0-9]+`; capture `rc=$?` right after slangc, since inside `$(...)` or after a pipe `$?` is the last stage's. An E30019 reading "expected T got T" usually hides a layout/modifier difference the type printer omits: since #12992 made `MatrixLayoutModifier` a `TypeModifier`, `_coerce` (`slang-check-conversion.cpp:2316`) converts layout-only-different matrices but not arrays of them, so `cbuffer { row_major float4x4 m[N]; }` passed to a `float4x4 x[N]` parameter fails (#13376) ([`error 30019` without E](../learnings/1790885585791-old-slangc-releases-print-error-30019-no-e-prefix-.md)).

**Source learnings (25):**
- [slangc-only build (X11 missing)](../learnings/1780352276660-verify-slang-diagnostics-with-slangc-only-build-sl.md)
- [slangc-only build dodges slang-rhi/X11](../learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md)
- [slangc -v baked at CONFIGURE time](../learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md)
- [confirm ToT with a feature probe](../learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md)
- [cached slangc may be weeks-stale](../learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md)
- [CLI option trips check-cmdline-ref; bot can't dispatch fix](../learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md)
- [help-text edits must regenerate the reference](../learnings/1784827777508-slangc-help-text-edits-require-regenerating-comman.md)
- [-dump-ir is the codegen pipeline](../learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md)
- [-dump-ir needs -o or -entry](../learnings/1785554892234-dump-ir-emits-nothing-unless-slangc-runs-the-backe.md)
- [render-test is not slangc](../learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md)
- [new warning fails COMPARE_COMPUTE (#11709)](../learnings/1790743536144-a-new-slang-warning-fails-compare-compute-tests-th.md)
- [compute harness needs empty stderr; sweep tests](../learnings/1790744483266-a-new-slang-warning-can-fail-gpu-tests-the-compute.md)
- [default flag needs two forms](../learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md)
- [diagnostic catalog naming](../learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md)
- [render-test row-major default (#13389)](../learnings/1790935550719-render-test-s-default-matrix-layout-is-row-major-a.md)
- [render-test ROW-MAJOR; vertex data (#13382)](../learnings/1790924620893-render-test-compiles-with-a-row-major-matrix-defau.md)
- [-cpu tests hide IR bugs unless -g0 (#13409)](../learnings/1790982231204-slang-cpu-compare-compute-tests-can-hide-ir-optimi.md)
- [filecheck-buffer vacuity; TEST_INPUT int bits](../learnings/1790896856276-slang-test-filecheck-buffer-tests-pass-vacuously-w.md)
- [gdb + SIGINT backtrace of a hang (#12564)](../learnings/1790959668691-slang-get-a-backtrace-of-a-hung-slangc-by-running-.md)
- [old releases print `error 30019` (#13376)](../learnings/1790885585791-old-slangc-releases-print-error-30019-no-e-prefix-.md)
- [-version is configure-time describe; mtime vs reflog](../learnings/1793201892976-slangc-version-shows-configure-time-git-describe-n.md)
- [-version after checkout; cite `git rev-parse HEAD`](../learnings/1793205140280-disable-non-essential-validations-contract-help-te.md)
- [shared build SHA from reflog + library mtime](../learnings/1793666085824-infer-the-sha-a-shared-slang-release-build-was-mad.md)
- [hang/OOM under ulimit -v; rc=139 (#14278)](../learnings/1793748466615-reproduce-a-slangc-hang-or-oom-under-a-ulimit-v-ca.md)
- [ptrace sampler without gdb; misleading AFTER (#14278)](../learnings/1793749800691-sampling-a-hung-slangc-without-gdb-misleading-afte.md)

_Catalog: [[wiki/index.md]]_
