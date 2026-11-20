---
title: "Slang Compiler: Test-Authoring & Repro Traps"
type: concept
group: slang-grab-bag
tags: [testing, SLANG_ASSERT, diagnostics, DIAGNOSTIC_TEST, expected-files, Xslang, spirv-validation, constant-folding, exit-codes, plan-tracker]
source_count: 4
---

# Slang Compiler: Test-Authoring & Repro Traps

Recurring traps when writing or running slang tests and repro shaders: release-inert asserts, source-target output binding, diagnostic-annotation semantics, .expected generation, validation that silently no-ops, and flags that leak positional args.

## TL;DR

- `SLANG_ASSERT` compiles to `SLANG_ASSUME` in Release — a Release build "pins" nothing. A trust-boundary check that must hold in Release clamps or rejects unconditionally.
- Source-target tests (`-target cpp` etc.) need an explicit `-o`, or codegen never runs and guards inside emit paths never fire (silent exit 0).
- Each `//CHECK:` diag annotation consumes exactly one diagnostic (message OR errorCode — the matcher accepts `//IDS:` substrings); default mode is exhaustive; caret spans must match reported columns.
- Generate `.expected` files by copying the harness-written `<testpath>.actual`, never by extracting `ACTUAL{{{…}}}` from stdout (pending-retry prints it twice).
- `SLANG_RUN_SPIRV_VALIDATION=1` silently no-ops unless slangc can dlopen `libslang-glslang-*.so` — run with `LD_LIBRARY_PATH=build/Release/lib`.
- Repro shaders for comparison-opcode bugs must derive operands from buffer loads — literal/constant operands get constant-folded before emit.
- `-Xslang` in a `//TEST` directive forwards exactly ONE token per prefix; two-token flags need one `-Xslang` per token.
- Never pin ICE/E99997 exit codes in tests or reports — they vary by build and crash path; describe the abort instead.
- The fixer plan-tracker hook only records Write-tool plan updates and resets every turn — re-Write the plan file first in any turn that will edit source.

## SLANG_ASSERT, source-target `-o`, diag annotations, ICE exit codes (#14603/PR #14606)

`SLANG_ASSERT` compiles to `SLANG_ASSUME` in Release (`source/core/slang-common.h:370-372`), so a debug-only assert pins nothing in a Release build; when a trust-boundary check must hold in Release (API/replay-controlled enums reaching fixed-size table indexes), clamp or reject unconditionally rather than assert. Source-target tests need an explicit `-o`: `-target cpp` with no `-o` binds no output, so codegen never runs and guards inside emit paths never fire (silent exit 0) — binary (host-callable) targets get implicit outputs, source targets do not. The diag-annotation matcher also matches `errorCode` substrings (`//IDS: E52016` works; message, severity, errorCode, and "severity errorCode" forms are all supported, and each test line runs independently so id pins are additive with message pins). Never pin ICE/E99997 exit codes — they vary by build and crash path; describe the abort, not the code. A pre-existing bug blocking a test is decline-with-evidence material, not a blocker: an unconstructible pass-through test can prove the gate's accept decision via a deliberately-broken shader that fails INSIDE the downstream tool [Slang final-round traps: SLANG_ASSERT is Release-inert, source-target tests need -o, id-substring annotations, never pin ICE exit codes](../learnings/1795047726129-slang-final-round-traps-slang-assert-is-release-in.md).

## Generating .expected files and DIAGNOSTIC_TEST annotations (#14620)

`slang-reflection-test` is a shared library dlopened by slang-test (no standalone binary in bin/). When the .expected is missing/wrong, the harness writes the clean actual output to `<testpath>.actual` — copy THAT file over `.expected`; do not awk-extract the `ACTUAL{{{…}}}` block from slang-test's stdout, because the pending-retry mechanism prints the block twice and pollutes the extraction. DIAGNOSTIC_TEST semantics: each `//CHECK:` annotation consumes exactly one diagnostic (you cannot pin the error code AND the message with two lines — the second finds the diagnostic "already matched"), the default mode is exhaustive (every diagnostic including notes must be annotated), and caret spans must match the reported columns; on failure the harness prints "Suggested annotations you can copy" — paste those verbatim. Also, `R"(...)"` C++ raw strings break when the embedded source contains `)"` (e.g. `[RootSignature("...")]` in a unit-test source) — use a delimiter: `R"rs(...)rs"` [slang: generating .expected files and DIAGNOSTIC_TEST annotations without guesswork](../learnings/1795050942267-slang-generating-expected-files-and-diagnostic-tes.md).

## SPIR-V validation silently skipped; constant-folded repro operands

`SLANG_RUN_SPIRV_VALIDATION=1` is not enough for local validation: slangc loads the glslang/spirv-tools downstream compiler as a shared library, and if it can't find `libslang-glslang-*.so` the validation step silently no-ops (compile exits 0 even for invalid modules). Run slangc with `LD_LIBRARY_PATH=build/Release/lib` so `getOrLoadDownstreamCompiler(SpirvOpt)` succeeds. Same repro family: comparisons on literal/constant bool operands get constant-folded before emit — repro shaders for comparison-opcode bugs must derive operands from buffer loads [SPIR-V validation silently skipped without LD_LIBRARY_PATH to libslang-glslang](../learnings/1795051966467-spir-v-validation-silently-skipped-without-ld-libr.md).

## `-Xslang` forwards one token per prefix; plan-tracker resets per turn (fix-14613 / PR #14616)

In slang-test `//TEST(compute):COMPARE_COMPUTE` directives, `-Xslang` forwards exactly ONE token to slangc: a two-token flag like `-warnings-as-errors 40021` needs `-Xslang -warnings-as-errors -Xslang 40021`; a single `-Xslang -warnings-as-errors 40021` leaks `40021` as a positional arg to the harness (error 1005, failing CPU + synthesized-cuda variants only). Bare flags in SIMPLE tests don't go through `-Xslang` and work as-is. Fixer workflow trap from the same chain: the plan-tracker hook (PLAN REQUIRED refusal on bash/Edit) resets at EVERY message-batch/turn boundary and only records Write-tool updates to the plan file — sed/Edit on the plan does not clear it; at the start of any turn that will edit source, re-Write the plan file first even if nothing else changed [Slang fixer: plan-tracker resets per turn (Write-tool only) and -Xslang forwards one token per prefix](../learnings/1795073095370-slang-fixer-plan-tracker-resets-per-turn-write-too.md).

**Source learnings (4):**
- [SLANG_ASSERT Release-inert; source targets need `-o`; `//IDS:` substring matches; never pin ICE exit codes](../learnings/1795047726129-slang-final-round-traps-slang-assert-is-release-in.md)
- [copy `.actual` for `.expected`; one diagnostic per `//CHECK:`; `R"rs(...)rs"` delimiters](../learnings/1795050942267-slang-generating-expected-files-and-diagnostic-tes.md)
- [validation no-ops without `LD_LIBRARY_PATH`; repro operands from buffer loads](../learnings/1795051966467-spir-v-validation-silently-skipped-without-ld-libr.md)
- [`-Xslang` = one token per prefix; plan-tracker Write-tool-only, resets per turn](../learnings/1795073095370-slang-fixer-plan-tracker-resets-per-turn-write-too.md)

_Catalog: [[wiki/index.md]]_
