---
title: "slangc CLI, Freshness & Emit-Verification Mechanics"
type: concept
group: slang-tooling
tags: [slangc, cli, filecheck, dump-ir, diagnostics, version, freshness, check-cmdline-ref, render-test]
source_count: 12
---

# slangc CLI, Freshness & Emit-Verification Mechanics

This page covers how to invoke `slangc` correctly for local verification work: the slangc-only build, confirming binary freshness (the version-string trap), the CLI-option/help-text doc CI gate, how `-dump-ir` and FileCheck buffers behave, why render-test lanes differ from slangc, the two default-flag injection forms in slang-test, and the diagnostic-catalog naming split. Target coverage, backend emit/codegen mechanics, and per-target triage live on the sibling page [slangc Targets, Emit/Codegen Traps & Triage](slang-tooling-slangc-cli-targets-2.md).

## TL;DR

- **Build slangc-only** (`cmake --build --preset debug --target slangc`) to dodge the `slang-rhi`→`vulkan.h`→`X11/Xlib.h` break on headless Linux — sufficient for all text-target emit verification (HLSL/CUDA/Metal/GLSL/SPIR-V-asm FileCheck), no GPU needed.
- **`slangc -v` is baked at cmake CONFIGURE time**, not build time — a stale-looking version string does NOT prove the binary is stale, and a fresh-looking one does NOT prove it's fresh. Confirm freshness by object mtime, a post-commit feature probe, or `git diff --stat <baked-sha>..HEAD`. An incremental `--target slangc` can exit 0 having only copied the version header — watch ninja for `.cpp.o` recompile lines.
- **Any edit to a `slangc` help/description string** (CLI options in `slang-options.cpp`, OR the tables in `slang-type-text-util.cpp`) changes `slangc -help-style markdown -h` and trips `check-cmdline-ref` CI — REGENERATE `docs/command-line-slangc-reference.md`, never hand-edit (whitespace/order is fragile). The `nv-slang-bot` cannot self-dispatch `/regenerate-cmdline-ref`.
- **`-dump-ir` shows the CODEGEN pipeline, not the validation-only pipeline** (uninit-use etc. run on a separate IR view). And `-dump-ir` emits NOTHING unless slangc runs the backend — a FileCheck test needs `-o /dev/null` or an `-entry`/`-stage`, else empty stdout+stderr and "expected string not found."
- **A `COMPARE_COMPUTE(...)` lane runs under render-test, not slangc** — different parser (rejects `-warnings-disable`), and it diffs stderr against empty (any warning fails the lane). A slangc-local pass does not predict the CI lane; put profile assertions on a `SIMPLE(filecheck=...)` lane.
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

## render-test vs slangc: COMPARE_COMPUTE lanes are a different program

A `//TEST(compute):COMPARE_COMPUTE(...):-vk` lane runs under **render-test**, not `slangc`. These programs have different option parsers:

- render-test **rejects** `slangc`-only flags like `-warnings-disable`. Passing them produces `error 1004: unknown command-line option` and an empty result buffer.
- COMPARE_COMPUTE diffs stderr against an empty-expected, so any compile-time diagnostic (even a warning like E41012 "profile implicitly upgraded") fails the lane even when the shader and GPU output are correct.

A slangc-local pass does not predict whether the COMPARE_COMPUTE lane passes in CI. The robust split: keep the runtime smoke test on the **default** profile (proves ops execute), and put profile-specific assertions on a static `SIMPLE(filecheck=...):-profile <p> -target spirv` lane (SIMPLE does not diff stderr). ([render-test (COMPARE_COMPUTE) is not slangc — local slangc pass does not predict the runtime lane](../learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md))

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

**Source learnings (12):**
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
- [slang-test default compiler flag needs TWO forms: bare for slangc paths, -Xslang for render-test paths](../learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md)
- [Slang diagnostic catalog name conventions — emit sites are PascalCase, not camelCase](../learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md)

_Catalog: [[wiki/index.md]]_
