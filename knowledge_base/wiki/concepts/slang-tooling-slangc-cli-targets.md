---
title: "slangc CLI, Targets & Emit Verification"
type: concept
group: slang-tooling
tags: [slangc, cli, targets, emit, filecheck, ir, diagnostics, version, slangi, vm, bytecode]
source_count: 26
---

# slangc CLI, Targets & Emit Verification

This page covers how to invoke `slangc` correctly for local verification work, understand its target coverage and limitations, diagnose silent failures, confirm binary freshness, and interpret diagnostic catalogs and IR dumps.

## Building slangc-only to avoid slang-rhi / X11 failures

On Linux containers without X11 headers, a full `cmake --build --preset debug` fails because `external/slang-rhi` pulls in `vulkan.h` → `X11/Xlib.h`. `slangc` itself does not depend on `slang-rhi`, so building only that target avoids the failure entirely:

```
git submodule update --init --recursive
cmake --preset default
cmake --build --preset debug --target slangc
```

This is sufficient for all text-target emit verification: HLSL, CUDA, Metal, GLSL, SPIR-V-asm. GPU test *execution* is unavailable but is not needed for FileCheck-style emit checks. The first debug build from a fresh clone takes only a few minutes once submodules and configure complete. ([Verify Slang diagnostics with slangc-only build (slang-test won't link: X11 missing)](wiki/learnings/1780352276660-verify-slang-diagnostics-with-slangc-only-build-sl.md), [Verifying Slang PR emit locally: build slangc-only to dodge the slang-rhi/X11 build break](wiki/learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md))

## Confirming the binary reflects HEAD (the version-string trap)

`slangc -v` reports a version string baked from `git describe` at **cmake configure time**, not at build time. An incremental `cmake --build` does not regenerate `slang-tag-version.h`, so the version string can show a commit weeks behind HEAD even though the object files were just recompiled. A stale-looking version string does NOT prove the binary is stale — but a matching-looking one does NOT prove it is fresh.

Reliable freshness checks (in ~2 min):
1. **Object mtime:** `find build -name 'slang-emit-spirv.cpp.o' -printf '%t %p\n'` — the `.o` mtime should be newer than the source mtime after `git reset --hard origin/master`.
2. **Feature probe:** compile a tiny shader exercising a feature that landed AFTER the suspect-stale commit. If the binary emits the new diagnostic / accepts the new attribute, it is provably newer than that commit.
3. **Diff identity:** `git diff --stat <baked-sha>..HEAD -- source/` — if none of the files under investigation changed since the baked commit, the binary's behavior for that code path is correct regardless.

The version header can be refreshed by deleting the generated `slang-tag-version.h` and reconfiguring, but for repro work the cosmetic staleness is harmless once the binary is confirmed by behavior. ([slangc -v version string is baked at CONFIGURE time, not build time](wiki/learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md), [Confirm a build is really ToT with a feature-probe, not the slangc -v string (extends the #11483 stale-binary trap)](wiki/learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md), [Verify-at-HEAD can be silently wrong: cached slangc binary may be weeks-stale — check freshness before trusting any repro](wiki/learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md))

An incremental `cmake --build --target slangc` can exit 0 while doing essentially nothing (only copying the version header), leaving a genuinely stale binary. Always watch the ninja output for `.cpp.o` recompile lines. If a concurrent provisioning process is writing to `build/Debug/`, wait for mtime quiescence (~30s) before launching your own build to avoid ELF corruption. ([slangc -v version string is baked at CONFIGURE time, not build time](wiki/learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md))

## Adding CLI options: check-cmdline-ref CI

Adding any `-fxxx` option to `initCommandOptions` (`slang-options.cpp`) changes the output of `slangc -help-style markdown -h` and causes the `check-cmdline-ref` CI job to hard-exit with a diff against the committed `docs/command-line-slangc-reference.md`. Every CLI-option PR must regenerate that doc.

The canonical fix is the `/regenerate-cmdline-ref` slash command (`.github/workflows/regenerate-cmdline-ref.yml`). Posting it as `nv-slang-bot[bot]` does NOT dispatch — the bot does not meet the write-permission level required by slash-command-dispatch. Verify with `gh run list -R shader-slang/slang --workflow=regenerate-cmdline-ref.yml -L 5`.

Do not hand-edit `docs/command-line-slangc-reference.md` without a working build to diff-verify — the auto-generated format is fragile (exact trailing whitespace, registration order). When build or dispatch is unavailable, post a PR note documenting the sole remaining red is doc-staleness and hand off to a maintainer with build+dispatch rights. ([Adding a slangc CLI option trips check-cmdline-ref CI; the bot can't self-fix it via /regenerate-cmdline-ref](wiki/learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md))

## slangc -dump-ir: codegen pipeline only (not validation pipeline)

`slangc ... -dump-ir` prints the IR as seen by the **codegen** pass sequence. Diagnostics that fire from `shouldRunNonEssentialValidation()` — including the uninitialized-use checker (`checkForUsingUninitializedValues`) — run against a SEPARATE IR view not captured in the dump. A dump showing "inst X never appears / body is empty" is NOT evidence about what the validation checker sees.

For any diagnostic living in the validation block (uninit-use, missing-returns, recursive-types), use `insttrace.py` on the actual inst or add an ad-hoc `dumpIRToString()` at the checker's call site. Use an empirical "does the fix make the repro warn?" gate rather than a dump-derived mechanism story. ([slangc -dump-ir shows the codegen pipeline, NOT the validation-only pipeline (uninit-use checker)](wiki/learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md))

## render-test vs slangc: COMPARE_COMPUTE lanes are a different program

A `//TEST(compute):COMPARE_COMPUTE(...):-vk` lane runs under **render-test**, not `slangc`. These programs have different option parsers:

- render-test **rejects** `slangc`-only flags like `-warnings-disable`. Passing them produces `error 1004: unknown command-line option` and an empty result buffer.
- COMPARE_COMPUTE diffs stderr against an empty-expected, so any compile-time diagnostic (even a warning like E41012 "profile implicitly upgraded") fails the lane even when the shader and GPU output are correct.

A slangc-local pass does not predict whether the COMPARE_COMPUTE lane passes in CI. The robust split: keep the runtime smoke test on the **default** profile (proves ops execute), and put profile-specific assertions on a static `SIMPLE(filecheck=...):-profile <p> -target spirv` lane (SIMPLE does not diff stderr). ([render-test (COMPARE_COMPUTE) is not slangc — local slangc pass does not predict the runtime lane](wiki/learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md))

## slang-test default compiler flag: two injection forms required

When injecting a default Slang compiler flag (e.g. `-O0`) into `slang-test` invocations, two distinct argument-assembly classes exist in `tools/slang-test/slang-test-main.cpp`:

1. **Compiler-backed tests** (runSimpleTest, runReflectionTest, etc.) build a `slangc` command line — append the flag bare: `-O0`.
2. **Render-test-backed tests** (runCompileTarget, runComputeComparisonImpl, etc.) build a `render-test` command line — forward via `-Xslang -O0`.

There is a single `_gatherTestOptions` parse chokepoint, but injecting there is wrong because it cannot distinguish the two consumers. Inject per-run-function (~15 sites) or via two helpers. Preserve explicit test `-O*` by scanning directive tokens. ([slang-test default compiler flag needs TWO forms: bare for slangc paths, -Xslang for render-test paths](wiki/learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md))

## Diagnostic catalog naming: PascalCase vs camelCase

Slang has two diagnostic catalogs with different naming conventions:

- **`source/slang/slang-diagnostics.lua`** — lua uses kebab-case names (`multi-dimensional-array-not-supported`), which are converted to **PascalCase** C++ symbols (`Diagnostics::MultiDimensionalArrayNotSupported`). Grep with the PascalCase form.
- **`source/compiler-core/slang-misc-diagnostic-defs.h`** — the X-macro `DIAGNOSTIC(code, severity, name, ...)` uses `name` verbatim in camelCase (`MiscDiagnostics::invalidArgumentForOption`). Grep with the camelCase form.

A single-case grep (camel OR pascal) will silently miss alive entries in the other catalog. Before claiming a diagnostic is dead: run both forms and get zero hits. A "I tried a repro and it didn't fire" test is not a substitute — diagnostics are gated on specific syntactic shapes that a naive repro may not exercise. ([Slang diagnostic catalog name conventions — emit sites are PascalCase, not camelCase](wiki/learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md))

## Target coverage: `hasOption(Optimization)` is NOT an explicit-request signal

`hasOption(CompilerOptionName::Optimization)` is **true by default** — the COM `getEntryPointCode` path materializes the Optimization option for every compile. `getOptimizationLevel()` also returns `OptimizationLevel::Default` (not `None`) for an ordinary compile. Any warning or branch gated on this combination fires on every ordinary `-target spirv` compile.

A reliable explicit-opt-in signal: SPIR-V validation is off by default and enabled only via `SLANG_RUN_SPIRV_VALIDATION`. Gate diagnostics on `shouldRunSPIRVValidation(codeGenContext)` instead. ([hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer](wiki/learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md))

## Target coverage: coverage instrumentation vs atomic64 capability

The `isCoverageInstrumentationTargetSupported` gate in `slang-ir-coverage-instrument.cpp` only skips WGPU and CPU-via-LLVM — it does NOT track per-target atomic capability. Metal and the `cpp` source target pass the gate but do NOT support 64-bit atomics: the `atomic64` capability alias in `slang-capabilities.capdef` covers `GL_EXT_shader_atomic_int64 | _sm_6_6 | cpp | cuda` but excludes Metal/WGSL, and the cpp AtomicAdd emitter (`slang-emit-cpp.cpp:1355-1389`) is 32-bit-only. Before asserting backend support for any atomic/width change, cross-check the capdef alias membership AND the per-emitter handling. ([Slang coverage target-support gate ≠ atomic64 capability membership](wiki/learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md))

## Target family gating vs CapabilitySet::implies

`targetRequest->getTargetCaps().implies(compound_alias)` is the WRONG test for "can this target lower feature X" in early IR passes:

- `implies(multiTarget)` returns NotImplied for any family the target lacks: "x implies (c|d) only if (x implies c) AND (x implies d)". A single-family target (e.g. `-target spirv`) can never imply a multi-family alias.
- Target cap sets are minimal at early stages — extension atoms are added ON DEMAND at emit, so they are absent at an early post-link IR pass.

Use target-family helpers from `slang-target.h`: `isCUDATarget`, `isMetalTarget`, `isSPIRV(...)`, `isD3DTarget(...)`, plus `targetRequest->getOptionSet().getProfileVersion()` for the HLSL shader-model boundary. ([Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias); late-synthesize stdlib intrinsics via KnownBuiltin](wiki/learnings/1780933412397-slang-gate-ir-passes-on-target-family-not-capabili.md))

## Front-end stage rejection for CPU targets: do not add one

Do NOT add a `validateEntryPoint` rejection of non-compute pipeline stages on CPU kernel targets (`cpp`, `hpp`, `host-callable`, etc.). Graphics-stage entry points compiling to CPU kernel targets is **valid input** exercised by `tests/render/cross-compile-entry-point.slang` and related cross-compile tests. The legalizer (`slang-ir-legalize-varying-params.cpp`) handles vertex/fragment varyings when they are representable. There is no front-end signal distinguishing an entry point the legalizer can lower from one it cannot — that is a per-shape decision inside the legalizer.

The correct fix for CPU-legalizer crashes is a null-safe source location in the legalizer, not a front-end stage/target gate. ([Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid](wiki/learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md))

## -target hpp/cpp no-output: suspect a crash from graphics-stage entry points

When a user reports `slangc -target hpp` or `-target cpp` produces no output file, the likely cause is a SIGSEGV from a **graphics-stage** (vertex/fragment) entry point — not a silent no-op. `-o` writes nothing on crash and on Windows the crash dialog is easy to miss.

`hpp`/`cpp` are CPU/host-C++ targets. The varying-param legalizer (`slang-ir-legalize-varying-params.cpp:1048`) dereferences `m_param->sourceLoc` where `m_param` defaults to null and is only set in `processParam` — a graphics-result SV hits `diagnoseUnsupportedSystemVal` before the param loop runs. Compute entries have a `void` result and only compute SVs, so they never reach this path.

Triage shortcut: bisect by entry-point STAGE (compute vs vertex/fragment) before investigating other constructs. Fix layers: front-end diagnostic rejecting non-compute stages for CPU host-C++ targets + legalizer null-guard. ([slang -target hpp/cpp 'no output file' is usually a crash from a graphics-stage entry point](wiki/learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md))

## Wave intrinsics: no IR opcode, stdlib ForceInline only

`WaveActiveSum`, `WaveActiveCountBits`, `WaveIsFirstLane` have **no `kIROp_*` opcode and no IRBuilder emit helper**. They are stdlib `[ForceInline]` functions in `source/slang/hlsl.meta.slang` with `__target_switch` bodies that expand to per-target source/asm.

The only wave-ish IR opcodes that exist: `kIROp_WaveGetActiveMask`, `kIROp_WaveMaskBallot`, `kIROp_WaveMaskMatch`, `kIROp_WaveSizeDecoration`.

An IR pass that wants to inject a wave reduction must either: (A) synthesize `IRCall`s to the linked stdlib wave funcs by mangled name (uses `KnownBuiltin` registry, requires force-keep conditional on target capability), or (B) add new IR ops + per-target emit in every `slang-emit-*.cpp`. Option A is lighter but untested late — spike with `-target spirv` + `-target cuda` and confirm wave ops + caps appear. ([Slang wave intrinsics have no IR opcode — an IR pass can't just emit WaveActiveSum/WaveIsFirstLane](wiki/learnings/1780925183948-slang-wave-intrinsics-have-no-ir-opcode-an-ir-pass.md), [Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias); late-synthesize stdlib intrinsics via KnownBuiltin](wiki/learnings/1780933412397-slang-gate-ir-passes-on-target-family-not-capabili.md))

## slangi VM emitter: missing IRConstant cases, constant-section contract

`ByteCodeEmitter::addConstantValue(IRConstant*)` in `source/slang/slang-emit-vm.cpp` dispatches on `inst->getOp()` with no `default:` arm. A missing case (e.g. `kIROp_BoolLit` was absent) reserves the operand's `offset`/`size` before the switch writes the actual bytes — then appends zero bytes. The next constant overlaps, and `validateOperandAccess` (slang-vm.cpp) trips OOB at runtime.

Contract: each switch arm must append exactly `sizeAlignment.size` bytes (from `getNaturalSizeAndAlignment`) to `constantSection`. For `IRBoolLit`, `bool`'s natural size is 4 bytes on common targets; writing one byte reproduces the OOB. The correct pattern mirrors `IntLit`: cast to `int64_t`, `addRange` using `sizeAlignment.size`.

Add a `default: SLANG_UNEXPECTED("unhandled IRConstant op in VM emitter");` defensive arm so the next missing op fails at emit time rather than as a VM crash. Current op coverage: `StringLit`, `IntLit`, `FloatLit`, `PtrLit`, `BoolLit`, `VoidLit`. ([slangi VM emitter: missing IRConstant cases produce silent malformed operands](wiki/learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md), [Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions](wiki/learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md), [slangi VM emitter constant section: write sizeAlignment.size bytes, not natural type size](wiki/learnings/1780330259667-slangi-vm-emitter-constant-section-write-sizealign.md))

## Inliner: DebugNoScope after ForceInline callee (entry scope not in IR)

With `-O0 -g3 -target spirv-asm`, returning from a `[ForceInline]` callee to caller code emits `DebugNoScope` instead of restoring the caller fn's `DebugScope`. Root cause: `emitCalleeDebugInlinedAt()` (`source/slang/slang-ir-inline.cpp:336-428`) restores the caller scope by scanning backward for an enclosing `IRDebugScope` — if none found, it emits `DebugNoScope`. A top-level caller's own entry `DebugScope` is **not materialized in the IR**; it is synthesized at emit time in `slang-emit-spirv.cpp:4139-4190`. So the backward scan finds nothing and produces spurious `DebugNoScope`. ([slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR](wiki/learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md))

## Empty-struct field emit-skip: must be an IR transform, not emit-layer skip

Skipping empty-struct field *declarations* in `CLikeSourceEmitter::emitStructDeclarationsBlock` fixes the crash but introduces a regression: `MakeStruct` construction and `FieldExtract`/`FieldAddress` accesses still reference the omitted member → downstream compile failure `no member named 'e_1'`. The emit-only fix appears to work at default-opt (optimizer folds empty-field reads) but fails under `-cpu` COMPARE_COMPUTE which compiles with LLVM at `-g3`.

The correct fix is a guaranteed IR transform (opt-level-independent): remove empty struct fields in IR AND rewrite all their uses — `FieldExtract` → `emitDefaultConstruct`, `FieldAddress` → address of a fresh local, `trimMakeStructOperands` + `removeStoresIntoField`. Gate the transform by `shouldLegalizeExistentialAndResourceTypes`, not a literal target check. ([Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit](wiki/learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md))

## CUDA WMMA/coopmat: prelude namespace is CUDA 12.5-guarded, emit is not

`prelude/slang-cuda-prelude.h:6633-6634` guards the entire `Slang_CUDA_WMMA` namespace behind `#if CUDA 12.5+`. But `source/slang/slang-emit-cuda.cpp:1672-1718` emits `Slang_CUDA_WMMA::WmmaFragment<...>` unconditionally — no target-version gate. Under NVRTC < 12.5 the namespace body is empty, producing the cryptic NVRTC error "name followed by :: must be a class or namespace name." The principled fix: gate `emitWMMAFragmentType` on the target NVRTC version (queryable via `nvrtcVersion` in `slang-nvrtc-compiler.cpp:42`) and emit a clean diagnostic "cooperative-matrix requires NVRTC ≥ 12.5". General lesson: when a prelude feature is `#if`-version-guarded, the emitter that references it MUST gate on the same version or diagnose. ([Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded (NVRTC <12.5 fails cryptically) — #10689](wiki/learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md))

## slangpy functional-API textures: no [format] decoration → CUDA UNORM writes corrupt

slangpy's generated RW accessor structs declare `RWTexture2D<T> value;` with no `[format(...)]` decoration. The CUDA compiler keys float→normalized-int conversion off `IRFormatDecoration`; without it, `inferImageFormatFromTextureType` infers float backing format → `_isConvertRequired=false` → no conversion emitted. UNORM/SNORM writes silently corrupt on CUDA. This persists even after upstream PR #11090 merges — #11090 improves the conversion lowering but still needs the format communicated via the decoration, which slangpy never emits. The companion slangpy change (threading `self.format` → `[format("…")]` onto the `RWTexture*Type<T>` `value` field) is genuinely required. ([slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix](wiki/learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md))

## Follow-up refactor issues may target code not yet on master

When triaging a "follow-up from PR #X" refactor issue, verify where the target code lives before dispatching a fixer. The code to refactor may exist only on PR #X's still-open branch. Check: `git ls-files <paths>` on master + `gh api repos/<r>/pulls/<X> --jq '.merged,.state'`. If files are absent and the originating PR is open, the refactor is blocked on that merge — park it, don't dispatch. ([Follow-up refactor issues may target code not yet on master](wiki/learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md))

## Falcor CI regression triage: bisect by merged_at, use emit diff as arbiter

Falcor CI runs against a pre-built Falcor with fresh Slang binaries copied on top. Falcor is fixed; only Slang changes between runs. A numeric regression LOOKS like Slang codegen, but:

- **Bisect by `merged_at` (not commit date).** shader-slang/slang merges via merge queue, so `author/commit date ≠ when it landed on master`. Use `gh pr view <n> --json mergedAt`. Confirm order with `git log --first-parent` + `git merge-base --is-ancestor A B`.
- **The decisive arbiter is a GPU-free emit diff.** Build slangc at the suspect's merge commit + parent, compile a minimal kernel to `-target hlsl` (fp16/`float16_t` needs `-profile sm_6_2`), diff. Byte-identical emit at a boundary EXONERATES that commit regardless of timing confusion.
- **Compute ULP magnitude first.** A few-ULP shift of an otherwise-correct value indicates too-tight tolerance, NOT a codegen bug.
- **Falcor test assertions and tolerances live in Falcor proper** — grep the slang tree → zero hits. D3D12-only + tiny-ULP + Vulkan-OK + externally-owned tolerance → environmental/driver cause stays live.

([CONSOLIDATED: Falcor CI regression triage (topology, ULP fingerprint, merge-queue bisect, emit-diff arbiter)](wiki/learnings/1781405911100-CONSOLIDATED-falcor-ci-regression-triage.md))

## vcpkg can silently pin a stale 2024 build

When a reporter's symptom reproduces on NO current version, suspect a stale/mismatched build early — before deep root-cause spelunking. Ask for `slangc -version` (actual runtime, not the package manifest version) in the first clarification. vcpkg/conan can pin or downgrade to an old build silently; a reporter's stated "2026.7.1" may be their actual 2024 binary. ([Slang triage: vcpkg can silently pin a stale (2024) build — ask `slangc -version` early when a symptom won't reproduce on any current version](wiki/learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md))

---
**Source learnings (26):**
- [Slang diagnostic catalog name conventions — emit sites are PascalCase, not camelCase](wiki/learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md)
- [slangi VM emitter: missing IRConstant cases produce silent malformed operands](wiki/learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md)
- [Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions](wiki/learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md)
- [slangi VM emitter constant section: write sizeAlignment.size bytes, not natural type size](wiki/learnings/1780330259667-slangi-vm-emitter-constant-section-write-sizealign.md)
- [Verify Slang diagnostics with slangc-only build (slang-test won't link: X11 missing)](wiki/learnings/1780352276660-verify-slang-diagnostics-with-slangc-only-build-sl.md)
- [Slang coverage target-support gate ≠ atomic64 capability membership](wiki/learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md)
- [Slang wave intrinsics have no IR opcode — an IR pass can't just emit WaveActiveSum/WaveIsFirstLane](wiki/learnings/1780925183948-slang-wave-intrinsics-have-no-ir-opcode-an-ir-pass.md)
- [Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias)](wiki/learnings/1780933412397-slang-gate-ir-passes-on-target-family-not-capabili.md)
- [Verifying Slang PR emit locally: build slangc-only to dodge the slang-rhi/X11 build break](wiki/learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md)
- [slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix](wiki/learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md)
- [CONSOLIDATED: Falcor CI regression triage (topology, ULP fingerprint, merge-queue bisect, emit-diff arbiter)](wiki/learnings/1781405911100-CONSOLIDATED-falcor-ci-regression-triage.md)
- [slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR](wiki/learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md)
- [Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded](wiki/learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md)
- [Follow-up refactor issues may target code not yet on master](wiki/learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md)
- [Confirm a build is really ToT with a feature-probe, not the slangc -v string](wiki/learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md)
- [Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit](wiki/learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md)
- [slang -target hpp/cpp "no output file" is usually a crash from a graphics-stage entry point](wiki/learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md)
- [Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid](wiki/learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md)
- [hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer](wiki/learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md)
- [slangc -v version string is baked at CONFIGURE time, not build time](wiki/learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md)
- [render-test (COMPARE_COMPUTE) is not slangc — local slangc pass does not predict the runtime lane](wiki/learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md)
- [slangc -dump-ir shows the codegen pipeline, NOT the validation-only pipeline](wiki/learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md)
- [Verify-at-HEAD can be silently wrong: cached slangc binary may be weeks-stale](wiki/learnings/1782470684664-verify-at-head-can-be-silently-wrong-cached-slangc.md)
- [Adding a slangc CLI option trips check-cmdline-ref CI; the bot can't self-fix it via /regenerate-cmdline-ref](wiki/learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md)
- [Slang triage: vcpkg can silently pin a stale (2024) build](wiki/learnings/1782521104183-slang-triage-vcpkg-can-silently-pin-a-stale-2024-b.md)
- [slang-test default compiler flag needs TWO forms: bare for slangc paths, -Xslang for render-test paths](wiki/learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md)
_Catalog: [[wiki/index.md]]_
