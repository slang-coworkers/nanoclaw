---
title: "slangc CLI, Freshness & Emit-Verification Mechanics"
type: concept
group: slang-tooling
tags: [slangc, cli, filecheck, dump-ir, diagnostics, version, freshness, check-cmdline-ref, render-test]
source_count: 20
---

# slangc CLI, Freshness & Emit-Verification Mechanics

This page covers how to invoke `slangc` correctly for local verification work: the slangc-only build, confirming binary freshness (the version-string trap), the CLI-option/help-text doc CI gate, how `-dump-ir` and FileCheck buffers behave, why render-test lanes differ from slangc, the two default-flag injection forms in slang-test, and the diagnostic-catalog naming split. Target coverage, backend emit/codegen mechanics, and per-target triage live on the sibling page [slangc Targets, Emit/Codegen Traps & Triage](slang-tooling-slangc-cli-targets-2.md).

## TL;DR

- **Build slangc-only** (`cmake --build --preset debug --target slangc`) to dodge the `slang-rhi`→`vulkan.h`→`X11/Xlib.h` break on headless Linux — sufficient for all text-target emit verification (HLSL/CUDA/Metal/GLSL/SPIR-V-asm FileCheck), no GPU needed.
- **`slangc -v` is baked at cmake CONFIGURE time**, not build time — a stale-looking version string does NOT prove the binary is stale, and a fresh-looking one does NOT prove it's fresh. Confirm freshness by object mtime, a post-commit feature probe, or `git diff --stat <baked-sha>..HEAD`. An incremental `--target slangc` can exit 0 having only copied the version header — watch ninja for `.cpp.o` recompile lines.
- **Any edit to a `slangc` help/description string** (CLI options in `slang-options.cpp`, OR the tables in `slang-type-text-util.cpp`) changes `slangc -help-style markdown -h` and trips `check-cmdline-ref` CI — REGENERATE `docs/command-line-slangc-reference.md`, never hand-edit (whitespace/order is fragile). The `nv-slang-bot` cannot self-dispatch `/regenerate-cmdline-ref`.
- **`-dump-ir` shows the CODEGEN pipeline, not the validation-only pipeline** (uninit-use etc. run on a separate IR view). And `-dump-ir` emits NOTHING unless slangc runs the backend — a FileCheck test needs `-o /dev/null` or an `-entry`/`-stage`, else empty stdout+stderr and "expected string not found."
- **A `COMPARE_COMPUTE(...)` lane runs under render-test, not slangc** — different parser (rejects `-warnings-disable`), and it diffs stderr against empty (any warning fails the lane). A slangc-local pass does not predict the CI lane; put profile assertions on a `SIMPLE(filecheck=...)` lane.
- **A new warning fails every COMPARE_COMPUTE* leg whose shader triggers it, on GPU CI only** (no-GPU runs ignore those legs). Sweep `tests/` with the PR `slangc` before shipping a warning, and suppress intentional triggers with `-xslang -Wno-<id>` on the compute directive.
- **render-test's defaults are not slangc's:** matrix layout defaults to ROW-major (slangc: column-major) and debug info is STANDARD unless `-g0`. A layout-sensitive pair needs explicit row- AND column-major flags; an IR-optimization regression test on `-cpu` needs `-g0` and a confirmed FAIL on the unfixed binary.
- **Backtrace a hung slangc by launching it under gdb** (`ptrace_scope=1` blocks attach) and `pkill -INT`; on a hang use `-dump-ir-before <pass>`.
- **Old releases (v2025.2x and earlier) print `error 30019:`, new ones `error[E30019]:`** — when bisecting, check the exit status and grep `error\[?E?[0-9]+`.
- **Injecting a default slang-test compiler flag needs TWO forms:** bare (`-O0`) for slangc-backed paths, `-Xslang -O0` for render-test-backed paths — inject per-run-function, not at the single parse chokepoint.
- **Two diagnostic catalogs, two naming conventions:** `slang-diagnostics.lua` → PascalCase C++ symbols; `slang-misc-diagnostic-defs.h` X-macro → verbatim camelCase. A single-case grep silently misses the other catalog.

## Building slangc-only to avoid slang-rhi / X11 failures

On Linux containers without X11 headers, a full `cmake --build --preset debug` fails because `external/slang-rhi` pulls in `vulkan.h` → `X11/Xlib.h`. `slangc` itself does not depend on `slang-rhi`, so building only that target avoids the failure entirely:

```
git submodule update --init --recursive
cmake --preset default
cmake --build --preset debug --target slangc
```

This is sufficient for all text-target emit verification: HLSL, CUDA, Metal, GLSL, SPIR-V-asm. GPU test *execution* is unavailable but is not needed for FileCheck-style emit checks. The first debug build from a fresh clone takes only a few minutes once submodules and configure complete. ([Verify Slang diagnostics with slangc-only build (slang-test won't link: X11 missing)](../learnings/1780352276660-verify-slang-diagnostics-with-slangc-only-build-sl.md), [Verifying Slang PR emit locally: build slangc-only to dodge the slang-rhi/X11 build break](../learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md))

## Confirming the binary reflects HEAD (the version-string trap)

`slangc -v` reports a version string baked from `git describe` at **cmake configure time**, not at build time. An incremental `cmake --build` does not regenerate `slang-tag-version.h`, so the version string can show a commit weeks behind HEAD even though the object files were just recompiled. A stale-looking version string does NOT prove the binary is stale — but a matching-looking one does NOT prove it is fresh.

Reliable freshness checks (in ~2 min):
1. **Object mtime:** `find build -name 'slang-emit-spirv.cpp.o' -printf '%t %p\n'` — the `.o` mtime should be newer than the source mtime after `git reset --hard origin/master`.
2. **Feature probe:** compile a tiny shader exercising a feature that landed AFTER the suspect-stale commit. If the binary emits the new diagnostic / accepts the new attribute, it is provably newer than that commit.
3. **Diff identity:** `git diff --stat <baked-sha>..HEAD -- source/` — if none of the files under investigation changed since the baked commit, the binary's behavior for that code path is correct regardless.

The version header can be refreshed by deleting the generated `slang-tag-version.h` and reconfiguring, but for repro work the cosmetic staleness is harmless once the binary is confirmed by behavior. ([slangc -v version string is baked at CONFIGURE time, not build time](../learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md), [Confirm a build is really ToT with a feature-probe, not the slangc -v string (extends the #11483 stale-binary trap)](../learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md), [Verify-at-HEAD can be silently wrong: cached slangc binary may be weeks-stale — check freshness before trusting any repro](../learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md))

An incremental `cmake --build --target slangc` can exit 0 while doing essentially nothing (only copying the version header), leaving a genuinely stale binary. Always watch the ninja output for `.cpp.o` recompile lines. If a concurrent provisioning process is writing to `build/Debug/`, wait for mtime quiescence (~30s) before launching your own build to avoid ELF corruption. ([slangc -v version string is baked at CONFIGURE time, not build time](../learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md))

## Adding CLI options: check-cmdline-ref CI

Adding any `-fxxx` option to `initCommandOptions` (`slang-options.cpp`) changes the output of `slangc -help-style markdown -h` and causes the `check-cmdline-ref` CI job to hard-exit with a diff against the committed `docs/command-line-slangc-reference.md`. Every CLI-option PR must regenerate that doc.

The canonical fix is the `/regenerate-cmdline-ref` slash command (`.github/workflows/regenerate-cmdline-ref.yml`). Posting it as `nv-slang-bot[bot]` does NOT dispatch — the bot does not meet the write-permission level required by slash-command-dispatch. Verify with `gh run list -R shader-slang/slang --workflow=regenerate-cmdline-ref.yml -L 5`.

Do not hand-edit `docs/command-line-slangc-reference.md` without a working build to diff-verify — the auto-generated format is fragile (exact trailing whitespace, registration order). When build or dispatch is unavailable, post a PR note documenting the sole remaining red is doc-staleness and hand off to a maintainer with build+dispatch rights. ([Adding a slangc CLI option trips check-cmdline-ref CI; the bot can't self-fix it via /regenerate-cmdline-ref](../learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md))

The trigger is broader than adding options: **any** edit to a `slangc` help/description string — including the tables in `source/core/slang-type-text-util.cpp` (debug levels, optimization levels, etc.) — changes `slangc -help-style markdown -h` output and must be mirrored by regenerating the doc (build slangc, then `./build/Debug/bin/slangc -help-style markdown -h > docs/command-line-slangc-reference.md`, committing both files together and REGENERATING rather than hand-editing to avoid whitespace drift), or `check-cmdline-ref` fails. A parallel `check-capability-atoms-ref` diff-checks `docs/user-guide/a4-02-reference-capability-atoms.md` against `slang-capabilities.capdef` the same way ([any slangc help-text edit must regenerate command-line-slangc-reference.md — CI diff-checks it](../learnings/1784827777508-slangc-help-text-edits-require-regenerating-comman.md)).

## slangc -dump-ir: codegen pipeline only (not validation pipeline)

`slangc ... -dump-ir` prints the IR as seen by the **codegen** pass sequence. Diagnostics that fire from `shouldRunNonEssentialValidation()` — including the uninitialized-use checker (`checkForUsingUninitializedValues`) — run against a SEPARATE IR view not captured in the dump. A dump showing "inst X never appears / body is empty" is NOT evidence about what the validation checker sees.

For any diagnostic living in the validation block (uninit-use, missing-returns, recursive-types), use `insttrace.py` on the actual inst or add an ad-hoc `dumpIRToString()` at the checker's call site. Use an empirical "does the fix make the repro warn?" gate rather than a dump-derived mechanism story. ([slangc -dump-ir shows the codegen pipeline, NOT the validation-only pipeline (uninit-use checker)](../learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md))

A companion trap when writing a `SIMPLE(filecheck=...)` test that asserts on `-dump-ir`/`-dump-ir-before`/`-dump-ir-after` output: the dump is produced ONLY when slangc actually runs the backend, so a module with just an `export`/`export __extern_cpp` function and no `-entry ... -stage ...` and no `-o <file>` exits 0 with EMPTY stdout+stderr — the pass never runs and FileCheck reports "expected string not found." Add `-o /dev/null` (an existing tests/ idiom) or an entry point; conversely, because slang-test's `getOutput` (slang-test-main.cpp:1860) merges the stderr where `-dump-ir` writes into the FileCheck buffer regardless of exit code, a later nonzero-exit compile is NOT a reason a pass can't be FileCheck-tested — "no output requested" is ([-dump-ir emits nothing unless slangc runs the backend (need -o or -entry)](../learnings/1785554892234-dump-ir-emits-nothing-unless-slangc-runs-the-backe.md)).

On a **hang**, `-dump-ir` prints nothing; use `-dump-ir-before <pass>` for the pass that hangs, which still writes the dump before a `timeout` kill. For a backtrace, note that `ptrace_scope=1` in this container blocks `gdb -p <pid>`, so launch slangc under gdb instead: `timeout 90 gdb -q -batch -ex run -ex 'bt 30' --args slangc ... > gdb.txt &`, then `pkill -INT -x slangc` and read the `#N` frames. On #12564 this placed the hang in `translateEntryPointInParamToBorrow` (`slang-emit.cpp:1098`), long before `fixEntryPointCallsites` (`:2333`) ([backtrace a hung slangc by running it under gdb and sending SIGINT](../learnings/1790959668691-slang-get-a-backtrace-of-a-hung-slangc-by-running-.md)).

## render-test vs slangc: COMPARE_COMPUTE lanes are a different program

A `//TEST(compute):COMPARE_COMPUTE(...):-vk` lane runs under **render-test**, not `slangc`. These programs have different option parsers:

- render-test **rejects** `slangc`-only flags like `-warnings-disable`. Passing them produces `error 1004: unknown command-line option` and an empty result buffer.
- COMPARE_COMPUTE diffs stderr against an empty-expected, so any compile-time diagnostic (even a warning like E41012 "profile implicitly upgraded") fails the lane even when the shader and GPU output are correct.

A slangc-local pass does not predict whether the COMPARE_COMPUTE lane passes in CI. The robust split: keep the runtime smoke test on the **default** profile (proves ops execute), and put profile-specific assertions on a static `SIMPLE(filecheck=...):-profile <p> -target spirv` lane (SIMPLE does not diff stderr). ([render-test (COMPARE_COMPUTE) is not slangc — local slangc pass does not predict the runtime lane](../learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md))

The empty-stderr rule makes a NEW warning a breaking change for tests, not a no-op. Any `COMPARE_COMPUTE`/`COMPARE_COMPUTE_EX` leg whose shader triggers the warning fails on GPU CI, while `SIMPLE(filecheck=…)` legs of the same file still pass, because FileCheck matches only its CHECK lines. Local no-GPU runs report those compute legs as ignored, so a green local suite does not clear a new warning. PR #11709's E30709 (groupshared → `out`) failed `tests/metal/out-param.slang` on the vk/mtl legs of every GPU job; the fix was `-xslang -Wno-30709` on the compute directives (precedent: `tests/language-feature/shader-params/entry-point-uniform-params-implicit.slang`). Before shipping a warning, compile every `tests/**/*.slang` that could trigger it with the PR's `slangc` (no `-entry` needed, checking still runs; the #11709 sweep covered 91 files in about 2 minutes), grep the output for the warning code, and inspect each hit's `//TEST` directives: SIMPLE/filecheck legs are safe, COMPARE_COMPUTE* legs are not. To prove a suppression locally, make a temporary `-cpu` COMPARE_COMPUTE_EX copy of the leg and A/B the flag; a front-end warning fires on any target ([a new warning fails COMPARE_COMPUTE tests that trigger it](../learnings/1790743536144-a-new-slang-warning-fails-compare-compute-tests-th.md); [the compute harness requires empty stderr](../learnings/1790744483266-a-new-slang-warning-can-fail-gpu-tests-the-compute.md)).

**render-test's session defaults also differ from slangc's, so derive expected values with render-test's settings.** Two defaults bite. **(1) Matrix layout is ROW-major.** `tools/render-test/slang-support.cpp` builds its own value-initialized `slang::SessionDesc` and never sets `defaultMatrixLayoutMode`, so it inherits `SLANG_MATRIX_LAYOUT_ROW_MAJOR` from `include/slang.h:4494`; plain `slangc` defaults to column-major. Measured with `float layoutOf<let L : MatrixLayoutMode>(matrix<float,2,3,L> m) { return float(L); }` on a plain `float2x3`: bare RUN line → 1, `-Xslang -matrix-layout-row-major` → 1, `-Xslang -matrix-layout-column-major` → 2. So a "both layouts" test written as bare + `-matrix-layout-row-major` covers row-major twice — on #13389 the real column-major run exposed a pre-existing CPU `Ptr<float2x3>` storage bug — and require explicit `-matrix-layout-row-major` AND `-matrix-layout-column-major` on any layout-sensitive pair. When deriving an expected value from emitted code, compile with `-matrix-layout-row-major -emit-spirv-directly`; reasoning from slangc's default once named the wrong failing case in a posted #13382 triage. For vertex-input tests without a GPU: attributes `A0..A6` are in `render-test-main.cpp:169-185` / `:1030-1037` (A3..A6 = (1,2,3,4) … (13,14,15,16)), the Vulkan location equals the element index, so the output follows from the `OpAccessChain` indices; DXC→SPIR-V ignores `row_major`/`column_major` on vertex inputs while DXC→DXIL honors it ([render-test's default matrix layout is ROW-major; a `-matrix-layout-row-major` RUN line duplicates the bare line](../learnings/1790935550719-render-test-s-default-matrix-layout-is-row-major-a.md), [render-test compiles with a ROW-MAJOR matrix default, not slangc's column-major](../learnings/1790924620893-render-test-compiles-with-a-row-major-matrix-defau.md)). The #13389 atom also records an unrelated checker hazard: the per-module `m_typeConversionCostCache` (TypePair key) does not record `isLeftValue`, so an earlier `inout`/`out` call can poison a later overload choice for any type routed away from the global `BasicTypeKey` cache. **(2) Debug info is ON.** render-test sets `DebugInformation = STANDARD` unless `-g0` (`slang-support.cpp:273-281`, inside `if (generateSPIRVDirectly)`, which defaults true in `options.h:89`, so `-cpu` lanes get it too). On master `-g` perturbs the IR enough that the #13409 redundant-load-forwarding bug (groupshared written by a `[noinline]` callee) does not fire — `slangc -g -target cpp` re-loads, plain `slangc -target cpp` folds to the stale constant — so a `-cpu` COMPARE_COMPUTE regression test passed on master. Add `-g0` to a COMPARE_COMPUTE line guarding an IR-optimization bug and confirm it FAILS on an unfixed binary ([CPU COMPARE_COMPUTE tests can hide IR optimisation bugs unless -g0](../learnings/1790982231204-slang-cpu-compare-compute-tests-can-hide-ir-optimi.md)). A third input-side difference: in `TEST_INPUT:ubuffer(data=[1 2 3])`, integers without `.0` are stored as int bits even when the buffer's fields are float — write `1.0 2.0 3.0` ([filecheck-buffer tests pass vacuously when slang-llvm is disabled](../learnings/1790896856276-slang-test-filecheck-buffer-tests-pass-vacuously-w.md)).

## slang-test default compiler flag: two injection forms required

When injecting a default Slang compiler flag (e.g. `-O0`) into `slang-test` invocations, two distinct argument-assembly classes exist in `tools/slang-test/slang-test-main.cpp`:

1. **Compiler-backed tests** (runSimpleTest, runReflectionTest, etc.) build a `slangc` command line — append the flag bare: `-O0`.
2. **Render-test-backed tests** (runCompileTarget, runComputeComparisonImpl, etc.) build a `render-test` command line — forward via `-Xslang -O0`.

There is a single `_gatherTestOptions` parse chokepoint, but injecting there is wrong because it cannot distinguish the two consumers. Inject per-run-function (~15 sites) or via two helpers. Preserve explicit test `-O*` by scanning directive tokens. ([slang-test default compiler flag needs TWO forms: bare for slangc paths, -Xslang for render-test paths](../learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md))

## Diagnostic catalog naming: PascalCase vs camelCase

Slang has two diagnostic catalogs with different naming conventions:

- **`source/slang/slang-diagnostics.lua`** — lua uses kebab-case names (`multi-dimensional-array-not-supported`), which are converted to **PascalCase** C++ symbols (`Diagnostics::MultiDimensionalArrayNotSupported`). Grep with the PascalCase form.
- **`source/compiler-core/slang-misc-diagnostic-defs.h`** — the X-macro `DIAGNOSTIC(code, severity, name, ...)` uses `name` verbatim in camelCase (`MiscDiagnostics::invalidArgumentForOption`). Grep with the camelCase form.

A single-case grep (camel OR pascal) will silently miss alive entries in the other catalog. Before claiming a diagnostic is dead: run both forms and get zero hits. A "I tried a repro and it didn't fire" test is not a substitute — diagnostics are gated on specific syntactic shapes that a naive repro may not exercise. ([Slang diagnostic catalog name conventions — emit sites are PascalCase, not camelCase](../learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md))

**The diagnostic output format changed between releases, so grep both forms when bisecting.** Binaries from v2025.2x and older print `file.slang(9): error 30019: ...`; newer ones print `error[E30019]: ...`. A `grep -oE 'error\[E[0-9]+\]'` returns nothing on an old binary, so a failing old compile looks like a success — this produced a false "regression since v2025.24" claim that OUTPUT_REVIEW caught before filing. Check slangc's exit status (255 on error) and grep `error\[?E?[0-9]+`; capture `rc=$?` on the line right after slangc, because inside `$(...)` or after a pipe `$?` is the last stage's code. The same atom notes that an E30019 reading "expected T got T" usually hides a layout/modifier difference the type printer omits: since #12992 made `MatrixLayoutModifier` a `TypeModifier`, `_coerce` (`slang-check-conversion.cpp:2316`) converts layout-only-different matrices but not arrays of them, so `cbuffer { row_major float4x4 m[N]; }` passed to a `float4x4 x[N]` parameter fails (#13376) ([old slangc releases print `error 30019` with no E prefix](../learnings/1790885585791-old-slangc-releases-print-error-30019-no-e-prefix-.md)).

**Source learnings (20):**
- [Verify Slang diagnostics with slangc-only build (slang-test won't link: X11 missing)](../learnings/1780352276660-verify-slang-diagnostics-with-slangc-only-build-sl.md)
- [Verifying Slang PR emit locally: build slangc-only to dodge the slang-rhi/X11 build break](../learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md)
- [slangc -v version string is baked at CONFIGURE time, not build time](../learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md)
- [Confirm a build is really ToT with a feature-probe, not the slangc -v string](../learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md)
- [Verify-at-HEAD can be silently wrong: cached slangc binary may be weeks-stale](../learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md)
- [Adding a slangc CLI option trips check-cmdline-ref CI; the bot can't self-fix it via /regenerate-cmdline-ref](../learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md)
- [any slangc help-text edit must regenerate command-line-slangc-reference.md or CI fails](../learnings/1784827777508-slangc-help-text-edits-require-regenerating-comman.md)
- [slangc -dump-ir shows the codegen pipeline, NOT the validation-only pipeline](../learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md)
- [-dump-ir emits nothing unless slangc runs the backend — a filecheck test needs -o /dev/null or -entry/-stage](../learnings/1785554892234-dump-ir-emits-nothing-unless-slangc-runs-the-backe.md)
- [render-test (COMPARE_COMPUTE) is not slangc — local slangc pass does not predict the runtime lane](../learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md)
- [A new Slang warning fails COMPARE_COMPUTE tests that trigger it (stderr must be empty)](../learnings/1790743536144-a-new-slang-warning-fails-compare-compute-tests-th.md) — #11709 E30709 failed `tests/metal/out-param.slang` vk/mtl legs; `-xslang -Wno-<id>`; `-cpu` COMPARE_COMPUTE_EX A/B.
- [A new Slang warning can fail GPU tests: the compute harness requires empty stderr](../learnings/1790744483266-a-new-slang-warning-can-fail-gpu-tests-the-compute.md) — sweep every candidate test with the PR slangc (91 files, ~2 min); SIMPLE legs safe, COMPARE_COMPUTE* not.
- [slang-test default compiler flag needs TWO forms: bare for slangc paths, -Xslang for render-test paths](../learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md)
- [Slang diagnostic catalog name conventions — emit sites are PascalCase, not camelCase](../learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md)
- [render-test's default matrix layout is ROW-major; a `-matrix-layout-row-major` RUN line duplicates the bare line](../learnings/1790935550719-render-test-s-default-matrix-layout-is-row-major-a.md) — require both explicit layout flags (#13389)
- [render-test compiles with a ROW-MAJOR matrix default, not slangc's column-major](../learnings/1790924620893-render-test-compiles-with-a-row-major-matrix-defau.md) — derive expected values with `-matrix-layout-row-major`; vertex attribute data (#13382)
- [CPU COMPARE_COMPUTE tests can hide IR optimisation bugs unless -g0](../learnings/1790982231204-slang-cpu-compare-compute-tests-can-hide-ir-optimi.md) — render-test defaults to STANDARD debug info (#13409)
- [filecheck-buffer tests pass vacuously when slang-llvm is disabled](../learnings/1790896856276-slang-test-filecheck-buffer-tests-pass-vacuously-w.md) — TEST_INPUT integers without `.0` are int bits
- [backtrace a hung slangc by running it under gdb and sending SIGINT](../learnings/1790959668691-slang-get-a-backtrace-of-a-hung-slangc-by-running-.md) — `ptrace_scope=1`; `-dump-ir-before` on a hang (#12564)
- [old slangc releases print `error 30019` (no E prefix) — grep both forms when bisecting](../learnings/1790885585791-old-slangc-releases-print-error-30019-no-e-prefix-.md) — plus array-of-layout-matrix E30019 (#13376)

_Catalog: [[wiki/index.md]]_
