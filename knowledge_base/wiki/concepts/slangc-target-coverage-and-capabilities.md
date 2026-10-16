---
title: "slangc Target Coverage & Capability Gating"
type: concept
group: slang-tooling
tags: [targets, capability, atomic64, cpu, optimization, profile, wasm, family, gating]
source_count: 8
---

# slangc Target Coverage & Capability Gating

This page covers how `slangc` reports and gates target/feature coverage: why `findProfile` silently drops `+` capabilities on the API path, why `hasOption(Optimization)` is not an explicit-request signal, why the coverage-instrument gate is not the atomic64 capability, why IR passes must gate on target *family* rather than `CapabilitySet::implies`, why you must NOT add a front-end stage rejection for CPU-kernel targets, and two coverage-surface traps (the `slangc -h` profile list the parser rejects, and the empty compiler-option surface of the WASM bindings). Output-emission behavior and per-target triage live on [slangc Target Output & Obfuscation](slangc-target-output-and-obfuscation.md); backend emit mechanics (wave / VM / inliner) live on [slangc Wave Intrinsics, VM Emitter & Inliner](slangc-wave-vm-and-inliner.md).

## TL;DR

- **`hasOption(Optimization)` is TRUE by default** and `getOptimizationLevel()` returns `Default` (not `None`) for an ordinary compile — NOT an explicit-request signal. For explicit opt-in, gate on `shouldRunSPIRVValidation` (validation is off unless `SLANG_RUN_SPIRV_VALIDATION`).
- **Coverage-instrument gate ≠ atomic64 capability** — Metal and the `cpp` source target pass `isCoverageInstrumentationTargetSupported` but lack 64-bit atomics; cross-check the `atomic64` capdef alias membership AND per-emitter handling before asserting backend support.
- **Gate IR passes on target FAMILY** (`isCUDATarget` / `isMetalTarget` / `isSPIRV` / `isD3DTarget` from `slang-target.h`), NOT `getTargetCaps().implies(compound_alias)` — a single-family target can never imply a multi-family alias, and cap sets are minimal/on-demand at early passes.
- **CPU-kernel targets (`cpp` / `hpp` / `host-callable`):** do NOT add a front-end stage rejection of non-compute pipeline stages — graphics→CPU cross-compile is valid input. The correct fix for CPU-legalizer crashes is a null-safe source location in the legalizer, not a front-end gate.
- **`slangc -h` advertises `glsl_110..140` profiles the parser rejects** (`E00014`); the advertised-vs-accepted lists are out of sync across three sites, and fixing it trips `check-cmdline-ref` CI.
- **slang-wasm bindings expose NO compiler-option surface** — `createSession` takes only an int target; a JS caller cannot pass `-allow-glsl` or any other option.
- **`IGlobalSession::findProfile` is an exact-name lookup:** `"spirv_1_5+spvRayQueryKHR"` returns `SLANG_PROFILE_UNKNOWN` and silently drops the capabilities; `+` exists only in the CLI `-profile` parser. Through the API, pass a plain profile plus a `CompilerOptionName::Capability` entry.
- **Direct `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` input syntax first ships in v2026.14;** older builds give E30015, so ask for the user's version first.
- **`[require]` propagation through referenced declarations** (generic structs, enums, return types, static members) has its own page: [Slang capability inference](slang-language-core-capability-inference.md).
- **embind overloads by argument count, not type**: widening `createSession(int)` to accept an object needs one `emscripten::val` method that branches at runtime (and `EMSCRIPTEN_DECLARE_VAL_TYPE` to keep TS typing).

## Target coverage: `hasOption(Optimization)` is NOT an explicit-request signal

`hasOption(CompilerOptionName::Optimization)` is **true by default** — the COM `getEntryPointCode` path materializes the Optimization option for every compile. `getOptimizationLevel()` also returns `OptimizationLevel::Default` (not `None`) for an ordinary compile. Any warning or branch gated on this combination fires on every ordinary `-target spirv` compile.

A reliable explicit-opt-in signal: SPIR-V validation is off by default and enabled only via `SLANG_RUN_SPIRV_VALIDATION`. Gate diagnostics on `shouldRunSPIRVValidation(codeGenContext)` instead. ([hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer](../learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md))

## Coverage instrumentation vs atomic64 capability

The `isCoverageInstrumentationTargetSupported` gate in `slang-ir-coverage-instrument.cpp` only skips WGPU and CPU-via-LLVM — it does NOT track per-target atomic capability. Metal and the `cpp` source target pass the gate but do NOT support 64-bit atomics: the `atomic64` capability alias in `slang-capabilities.capdef` covers `GL_EXT_shader_atomic_int64 | _sm_6_6 | cpp | cuda` but excludes Metal/WGSL, and the cpp AtomicAdd emitter (`slang-emit-cpp.cpp:1355-1389`) is 32-bit-only. Before asserting backend support for any atomic/width change, cross-check the capdef alias membership AND the per-emitter handling. ([Slang coverage target-support gate ≠ atomic64 capability membership](../learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md))

## Target family gating vs CapabilitySet::implies

`targetRequest->getTargetCaps().implies(compound_alias)` is the WRONG test for "can this target lower feature X" in early IR passes:

- `implies(multiTarget)` returns NotImplied for any family the target lacks: "x implies (c|d) only if (x implies c) AND (x implies d)". A single-family target (e.g. `-target spirv`) can never imply a multi-family alias.
- Target cap sets are minimal at early stages — extension atoms are added ON DEMAND at emit, so they are absent at an early post-link IR pass.

Use target-family helpers from `slang-target.h`: `isCUDATarget`, `isMetalTarget`, `isSPIRV(...)`, `isD3DTarget(...)`, plus `targetRequest->getOptionSet().getProfileVersion()` for the HLSL shader-model boundary. ([Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias); late-synthesize stdlib intrinsics via KnownBuiltin](../learnings/1780933412397-slang-gate-ir-passes-on-target-family-not-capabili.md))

## Front-end stage rejection for CPU targets: do not add one

Do NOT add a `validateEntryPoint` rejection of non-compute pipeline stages on CPU kernel targets (`cpp`, `hpp`, `host-callable`, etc.). Graphics-stage entry points compiling to CPU kernel targets is **valid input** exercised by `tests/render/cross-compile-entry-point.slang` and related cross-compile tests. The legalizer (`slang-ir-legalize-varying-params.cpp`) handles vertex/fragment varyings when they are representable. There is no front-end signal distinguishing an entry point the legalizer can lower from one it cannot — that is a per-shape decision inside the legalizer.

The correct fix for CPU-legalizer crashes is a null-safe source location in the legalizer, not a front-end stage/target gate. ([Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid](../learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md))

(The concrete crash this over-broad gate would try to paper over — `slangc -target hpp/cpp` "no output" from a graphics-stage entry point — is documented on the output page. The fix belongs in the legalizer, not the front end.)

## `slangc -h` advertises `glsl_110..140` profiles the parser rejects

`slangc -profile glsl_140` → `E00014 unknown profile`, yet `slangc -h` lists `glsl_{110,120,130,140}` as accepted (#11898). The advertised-vs-accepted profile lists are out of sync across three sites; fixing it also trips the `check-cmdline-ref` CI (regenerate the reference) ([1782980898198-slangc-h-advertises-glsl-110-120-130-1](../learnings/1782980898198-slangc-h-advertises-glsl-110-120-130-140-profiles-.md)).

## API profile and capability selection: `findProfile` does not parse `+`

`IGlobalSession::findProfile("spirv_1_5+spvRayQueryKHR+...")` is an exact-name lookup (`Profile::lookUp`). It returns `SLANG_PROFILE_UNKNOWN` (0) and drops the capabilities without any error, because the `profile+cap+cap` syntax exists only in the command-line `-profile` parser. An API caller sets a plain profile on the `TargetDesc` and adds one `CompilerOptionEntry` per capability with `name = CompilerOptionName::Capability`, either `value.kind = Int` with `intValue0 = findCapability("<atom>")` or the string-name form described on [[wiki/concepts/slang-backends-spirv-5-deep-dives.md]] [findProfile ignores '+' caps](../learnings/1791880983925-slang-findprofile-ignores-caps-resourcedescriptorh.md).

A related version gate from the same support question: direct `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` input syntax (PR #11798, merged 2026-07-11) first ships in v2026.14, and older builds report E30015 (undefined identifier). Ask for the user's Slang version before debugging it. When reading `hlsl.meta.slang` (about 1.3 MB) for such questions, the MCP `github_get_file_contents` tool returns empty content, so fetch the raw file with `curl` [same](../learnings/1791880983925-slang-findprofile-ignores-caps-resourcedescriptorh.md).

## slang-wasm bindings expose NO compiler-option surface

**Verified at HEAD 8e3f9163d (2026-07-15).** The Slang WASM/JS bindings do **not** let a JS caller pass compiler options like `-allow-glsl` — `createSession` takes only an int target. ([slang-wasm bindings expose NO compiler-option surface (createSession takes only an int target)](../learnings/1784153472052-slang-wasm-bindings-expose-no-compiler-option-surf.md))

---

Widening the bindings has a constraint of its own: embind overloads by argument **count** only, not type (embind docs, "Overloaded functions"), so `createSession(emscripten::val)` cannot sit beside `createSession(int)` (#13642). The options are one method taking `emscripten::val` that branches at runtime (`val.isNumber()` vs object), or a new method name. With `emscripten::val` the `--emit-tsd` `interface.d.ts` shows `any` unless you add `EMSCRIPTEN_DECLARE_VAL_TYPE` + `register_type<T>(name, tsDef)`, so the first option can lose today's `number` typing for TS users. On the native side, `CompilerOptionSet::load` (`slang-compiler-options.cpp:11-24`) copies option strings into `String`, and SessionDesc searchPaths/macros become Include/MacroDefine entries (`slang-global-session.cpp:837-862`), so JS-side `std::string` storage only has to outlive the `createSession` call; there is no in-tree string→`CompilerOptionName` table. A source-rewriting workaround (prepended `#define`s) keeps diagnostics on the original lines with `#line 1 "<file>.slang"` after the prepended block [embind overloads by arg count only](../learnings/1792071361108-embind-overloads-by-arg-count-only-backward-compat.md).

## Capability inference through referenced declarations

How `[require]` propagates through generic structs, enums, static member calls and return types (#13579 / PR #13616), the scoping traps around `__intrinsic_type` and core-module types, and the twin-row method for testing a generic-vs-non-generic parity fix are on [Slang capability inference](slang-language-core-capability-inference.md).

**Source learnings (8):**
- [hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer](../learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md)
- [Slang coverage target-support gate ≠ atomic64 capability membership](../learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md)
- [Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias)](../learnings/1780933412397-slang-gate-ir-passes-on-target-family-not-capabili.md)
- [Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid](../learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md)
- [slangc -h advertises glsl_110/120/130/140 profiles the parser rejects (three-site sync + check-cmdline-ref CI)](../learnings/1782980898198-slangc-h-advertises-glsl-110-120-130-140-profiles-.md)
- [slang-wasm bindings expose NO compiler-option surface (createSession takes only an int target)](../learnings/1784153472052-slang-wasm-bindings-expose-no-compiler-option-surf.md)
- [Slang: findProfile ignores '+' caps; ResourceDescriptorHeap needs >= v2026.14](../learnings/1791880983925-slang-findprofile-ignores-caps-resourcedescriptorh.md) — exact-name profile lookup drops `+` caps silently; use a Capability option entry; descriptor-heap syntax version gate; curl the 1.3 MB meta file
- [embind overloads by arg COUNT only — backward-compatible number|object API needs one emscripten::val method](../learnings/1792071361108-embind-overloads-by-arg-count-only-backward-compat.md) — `val.isNumber()` branch; `EMSCRIPTEN_DECLARE_VAL_TYPE` for TS; `#line 1` after prepended defines (#13642)

_Catalog: [[wiki/index.md]]_
