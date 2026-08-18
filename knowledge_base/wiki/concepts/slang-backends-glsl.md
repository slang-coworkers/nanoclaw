---
title: "Slang GLSL Backend: Emission, Legalization, and glslang Integration"
type: concept
group: slang-backends
tags: [glsl, glslang, legalization, system-values, array-init, bootstrap]
source_count: 13
---

# Slang GLSL Backend: Emission, Legalization, and glslang Integration

The Slang GLSL backend (`slang-emit-glsl.cpp`, `slang-ir-glsl-legalize.cpp`) converts Slang IR to GLSL text which is then compiled by the bundled glslang library. This page covers known pitfalls in GLSL emission, legalization of system-value semantics, and interactions with glslang.

## TL;DR

- **Slang hard-floors the emitted `#version` at 450** (460 with draw-param/extension features) and IGNORES a requested `-profile <450` for the version directive. So "invalid in GLSL 330" reports are usually valid-as-emitted — severity collapses to Normal/P2-P3, impact confined to consumers retargeting below GLSL 4.20.
- **C-style brace initializers are a PORTABILITY bug, not universal invalidity.** `{ a, b }` is valid GLSL 4.20+; the portable form is the array-constructor `elemType[]( a, b )`. GLSL falls through to the C-like base for `kIROp_MakeArray`/`MakeArrayFromElement`; fix by adding cases to `GLSLSourceEmitter::tryEmitInstExprImpl`, mirroring the WGSL emitter.
- **Nested array-constructor bracket order is outermost-unsized:** `int[2][3]` is `int[][3](...)`, NOT `int[3][]`.
- **`MakeArrayFromElement` is reachable in text emit** — a default-initialized global `static const` array with no `IRStore` user survives `simplify-for-emit`. Do not dismiss it as dead.
- **`kIROp_MakeStruct` needs its own constructor form.** It shares one `CLikeSourceEmitter` block with `MakeArray`, so patching only the array path leaves struct literals emitting invalid brace syntax.
- **Validate emitted GLSL through Slang itself** when no standalone `glslangValidator` exists: `slangc <file> -target spirv-asm -emit-spirv-via-glsl` fails on a malformed or non-portable construct. Pin it with a second directive `//TEST:SIMPLE(filecheck=GLSLSPV): -target spirv-asm -emit-spirv-via-glsl` + `// GLSLSPV: OpEntryPoint`.
- **A new per-entry-point system-value decoration must gate on `kind == LayoutResourceKind::VaryingOutput`.** `legalizeEntryPointParameterForGLSL` calls `createGLSLGlobalVaryings` twice for `inout` params; unconditional assignment attaches the decoration twice and the emitter (no dedup, no break) emits it twice → invalid GLSL.
- **Also add any such new op to `isSimpleDecoration`** (`slang-ir.cpp`) so `addDecoration` can deduplicate, mirroring `kIROp_EarlyDepthStencilDecoration`.
- **`SV_Depth{Greater,Less}Equal` directional mode is DROPPED on the via-GLSL path** — the `layout(depth_greater)`/`depth_less` qualifiers are an unfinished TODO in glsl-legalize; only `DepthReplacing` survives. Direct SPIR-V is correct.
- **`[[vk::location(N)]]` on a `cbuffer` is silently dropped** — reserve-explicit reads `GLSLBindingAttribute` only for `DescriptorTableSlot`, and `GLSLLocationAttribute` only for varying I/O, so the cbuffer falls into declaration-order auto-allocation. The diagnostic belongs at the parameter-binding global-scope site, not AST validation (resource kind isn't resolved yet there).
- **GLSL `%` / `kIROp_FRem` mapped to GLSL's `mod()` is a real sign bug.** Slang `%`(float) and `fmod()` are both truncation remainder and both lower to `kIROp_FRem`; there is no `kIROp_FMod`. GLSL `mod()` is floor modulus — wrong sign for negatives.
- **Fix FRem with a branchless `sign*mod`, not the stdlib scalar `fmod` ternary** — the ternary is not vector-safe.
- **The stdlib Metal `fmod` sign-flip is redundant** (Metal's fmod is already C-style truncation remainder) and the in-tree "In Metal fmod is Modulus" comment is factually wrong.
- **Half-float literals emit without their required extension** — `61440.0HF` ships with no `#extension GL_EXT_shader_explicit_arithmetic_types : require`, so glslang rejects the output. The literal-emit path fails to register the extension the type needs.
- **GLSL has TWO orthogonal switches; conflating them is a published-error trap.** `SlangGlobalSessionDesc::enableGLSL` (default **false**) registers the builtin `glsl` module — without it `import glsl;` fails with E38201. `-allow-glsl` / `CompilerOptionName::AllowGLSL` controls input syntax and operator scope only and does NOT register the module.
- **A green local run does not represent the JS/wasm frontend:** both `slangc` and `slang-test` hardcode `desc.enableGLSL = true`, while wasm's argument-less `createGlobalSession()` zero-inits the desc to `enableGLSL=false`, and neither `SlangGlobalSessionDesc` nor `compilerOptionEntries` is embind-bound. Check what the target's own session-creation path sets.
- **`gl_*` builtins live in `glsl.meta.slang` and need `-allow-glsl` with target `glsl` or `spirv`.** Triage a "missing gl_* builtin" report by checking casing (`gl_SubgroupID`, not `gl_SubGroupID`) and the portable Wave* equivalent (`WaveGetWaveIndex()` ≡ `gl_SubgroupID`) first.
- **The LeakSanitizer nightly is NOT a valid net for `slang-glslang` leaks** — `source/slang-glslang/CMakeLists.txt` sets `SKIP_ASAN` and `lsan-suppressions.txt` carries a broad `leak:<unknown module>` entry. Verify output-invariant leak fixes by code inspection (matched `new[]`/`delete[]`).
- **Make a spirv-opt pass toggleable rather than deleting it**, following the `SLANG_ENABLE_SPIRV_OPT_MERGE_RETURN` template: `advanced_option`, `target_compile_definitions`, `#ifndef/#define` guard plus `#if` around ALL registrations, a row in `docs/building.md`, and an entry in `.github/cmake-options-matrix.json`.
- **Verify a "glslang already does X correctly" test premise against glslang source.** Slang's emitter adds `volatile` only for user-authored qualifiers, and glslang's `TranslateMemoryDecoration` adds `Volatile` only when `qualifier.isVolatile()` — it is not stage-aware for subgroup builtins.
- **With `SLANG_EMBED_CORE_MODULE=OFF`, `slang-bootstrap` compiles core + GLSL eagerly at session creation**, before any command-line option is read. Passing `-load-core-module` to a later command is too late; a reuse fix must teach the bootstrap session-init path to load a provided archive ahead of the eager compile.
- **`E41012 profile implicitly upgraded` for a `[require]` attribute comes from `slang-check-shader.cpp` (`ProfileImplicitlyUpgraded`), NOT the IR late-require pass** — a misattribution that has appeared in an in-tree test comment. A spurious E41012 on a combined `Sampler2D.Load()` under `-profile glsl_450` means the static `[require]` is out of sync with the emit-time `isCombined` gate.
- **A global-scope array-of-struct GS input crashes glsl-legalize**, not SPIR-V: `in triangle CoarseVertex v[3];` asserts `realGlobalVar` (E99997) even at `-O0` and on `-target glsl`. Plain `in triangle CoarseVertex v;` and `in triangle float4 p[3];` both compile — array-of-struct is the precise trigger.
- **A multi-repro issue closed by a single-repro PR must have each repro re-checked at HEAD** — that is how this one stayed broken behind a `Fixes #N` close.

## Version Floor and Severity Assessment

Slang hard-floors the emitted `#version` at 450 (460 when draw-param/extension features are pulled in) and **ignores a requested `-profile <450`** for the version directive. This means "invalid in GLSL 330" reports are typically valid-as-emitted, because the emitted header is always `#version 450+`. The severity of most "multi-profile invalid output" bugs collapses from P1 to Normal/P2-P3 — the actual impact is only in consumers retargeting below GLSL 4.20 ([Slang floors GLSL #version at 450 — 'invalid in old GLSL' emit bugs are usually valid-as-emitted (lower severity)](../learnings/1782721748193-slang-floors-glsl-version-at-450-invalid-in-old-gl.md)).

## Array Initialization Bug

Slang's GLSL text emitter falls through to the C-like base class for `kIROp_MakeArray` / `kIROp_MakeArrayFromElement`, which emits C-style brace initializers `{ a, b }`. C-style braces are invalid GLSL in versions before 4.20; the portable form is the array-constructor syntax `elemType[]( a, b )`. The fix is to add cases for these ops to `GLSLSourceEmitter::tryEmitInstExprImpl` in `slang-emit-glsl.cpp`, mirroring the WGSL emitter at `slang-emit-wgsl.cpp:1531-1572` ([GLSL target emits invalid C-style brace array initializers; WGSL already has the constructor-syntax override GLSL lacks](../learnings/1782632216704-glsl-target-emits-invalid-c-style-brace-array-init.md)).

The correct nested bracket order for `int[2][3]` is `int[][3](...)` — outermost dim unsized, inner dims sized. NOT `int[3][]` ([CORRECTION: GLSL brace array-init is valid in 4.20+; the bug is portability, not universal invalidity](../learnings/1782737319266-correction-glsl-brace-array-init-is-valid-in-4-20-.md)).

**`MakeArrayFromElement` is reachable in text emit** — not dead. A default-initialized global `static const` array (with no `IRStore` user) survives `simplify-for-emit` and reaches the emitter ([GLSL MakeArrayFromElement IS reachable in text emit (default-init global const array)](../learnings/1782739391257-glsl-makearrayfromelement-is-reachable-in-text-emi.md)).

**Validation technique:** Since there is no standalone `glslangValidator` in the agent environment, prove emitted GLSL compiles by routing it through Slang itself: `slangc <file> -target spirv-asm -emit-spirv-via-glsl ...`. A malformed/non-portable construct fails. Add a second test directive: `//TEST:SIMPLE(filecheck=GLSLSPV): -target spirv-asm -emit-spirv-via-glsl ...` + `// GLSLSPV: OpEntryPoint` ([CORRECTION: GLSL brace array-init is valid in 4.20+; the bug is portability, not universal invalidity](../learnings/1782737319266-correction-glsl-brace-array-init-is-valid-in-4-20-.md)).

## System-Value Legalization (Per-Entry-Point Decorations)

When adding a new `GLSLSystemValueKind` whose handler decorates the ENTRY POINT (not the global param) — e.g. conservative-depth `FragDepthGreater`/`FragDepthLess` decorations — two rules apply:

1. Gate `systemValueKind` assignment on `kind == LayoutResourceKind::VaryingOutput`, mirroring `sv_position` at `slang-ir-glsl-legalize.cpp ~478-498`. `legalizeEntryPointParameterForGLSL` calls `createGLSLGlobalVaryings` twice for `inout` params; unconditional assignment attaches the decoration twice and the emitter (iterating all decorations without dedup/break) emits it twice → invalid GLSL.

2. Add the new op to `isSimpleDecoration` in `slang-ir.cpp ~86`, mirroring `kIROp_EarlyDepthStencilDecoration`, so `addDecoration` can deduplicate.

For depth specifically, the double-attach is unreachable in practice — `SV_Depth`/`SV_DepthGreaterEqual`/`SV_DepthLessEqual` are setter-only (no getter), so using one as input is rejected by the frontend with E30702 `SystemValueSemanticInvalidDirection` before legalization. Both rules are still valuable defense-in-depth for any NEW entry-point decoration whose semantic has a getter ([GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput (inout double-attach)](../learnings/1782173862922-glsl-legalize-per-entry-point-system-value-decorat.md), [GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput (inout double-attach)](../learnings/1782175454099-glsl-legalize-per-entry-point-system-value-decorat.md)).

**SV_Depth directional mode is dropped via GLSL (`-emit-spirv-via-glsl`):** There is an unfinished `// TODO` at `slang-ir-glsl-legalize.cpp:~577-592` where `layout(depth_greater)`/`layout(depth_less)` qualifiers should be emitted but are not. Only `DepthReplacing` survives the via-GLSL path ([Slang SV_Depth{Greater,Less}Equal: direct SPIR-V correct, GLSL/via-GLSL drops directional mode](../learnings/1782165817624-slang-sv-depth-greater-less-equal-direct-spir-v-co.md)).

## vk::location on cbuffer Is Silently Dropped

`[[vk::location(N)]]` on a `cbuffer` is silently dropped. In `slang-parameter-binding.cpp`, phase 1 reserve-explicit only reads `GLSLBindingAttribute` for `DescriptorTableSlot` resources; `GLSLLocationAttribute` is consumed only for varying I/O. The `cbuffer` then enters phase 2 auto-allocation with declaration-order bindings. The fix is a diagnostic warning at the parameter-binding global-scope site, not at the AST validation site (where the resource kind isn't resolved yet) ([vk::location on a cbuffer is silently dropped → GLSL binding follows declaration order (slang #6216)](../learnings/1782215284222-vk-location-on-a-cbuffer-is-silently-dropped-glsl-.md)).

## glslang and the spirv-via-glsl Path

When reviewing PRs that add `-emit-spirv-via-glsl` tests with a header claiming "glslang already does X correctly," verify the claim against glslang source. Slang's GLSL emitter only adds `volatile` for user-authored qualifiers; glslang's `TranslateMemoryDecoration` adds `Volatile` only when the GLSL source's `qualifier.isVolatile()` is true, not stage-aware for subgroup builtins ([slang-via-glsl-test-premise-verify-with-downstream-tool](../learnings/1779619281300-slang-via-glsl-test-premise-verify-with-downstream.md)).

**gl_* builtins and the GLSL compat module:** `gl_*` builtins live in `glsl.meta.slang` and require `-allow-glsl` with target `glsl` or `spirv`. Common user mistakes: wrong casing (`gl_SubGroupID` vs `gl_SubgroupID`) and not knowing the portable Wave* equivalents (`WaveGetWaveIndex()` ≡ `gl_SubgroupID`, added PR #11192) ([Triaging 'GLSL gl_* builtin missing' reports — check casing, -allow-glsl scope, and the Wave* native equivalent first](../learnings/1781162369496-triaging-glsl-gl-builtin-missing-reports-check-cas.md)).

**glslang leaks and LeakSanitizer:** `source/slang-glslang/CMakeLists.txt:9` sets `SKIP_ASAN` and `cmake/lsan-suppressions.txt:27` carries a broad `leak:<unknown module>` suppression, so no-free leaks in `slang-glslang` are not caught by the nightly LeakSanitizer. For output-invariant leak fixes, correct verification is code inspection (matched `new[]`/`delete[]`), not LSan nightly ([slang-glslang leaks: LeakSanitizer nightly is NOT a valid verification net (SKIP_ASAN + broad suppression)](../learnings/1782353151387-slang-glslang-leaks-leaksanitizer-nightly-is-not-a.md)).

**CMake escape-hatch pattern for spirv-opt passes:** When a maintainer asks to keep an optimizer pass toggleable rather than deleted, follow the `SLANG_ENABLE_SPIRV_OPT_MERGE_RETURN` template: `advanced_option` in CMakeLists.txt, `target_compile_definitions`, `#ifndef...#define...#endif` guard + `#if ... #endif` around ALL registrations, row in `docs/building.md`, entry in `.github/cmake-options-matrix.json` ([slang-glslang: add an opt-out via dedicated CMake escape-hatch, not by deleting the pass](../learnings/1781975592365-slang-glslang-add-an-opt-out-via-dedicated-cmake-e.md)).

## Bootstrap and Core-Module Compilation

When `SLANG_EMBED_CORE_MODULE=OFF`, `slang-bootstrap` eagerly compiles core + GLSL at session-creation time (before any command-line option) because `slang_createGlobalSessionImpl` falls through to `compileBuiltinModule(Core)` / `compileBuiltinModule(GLSL)` unconditionally when `isBootstrap=true`. A "reuse the compiled core" fix must teach the bootstrap session-init path to load an explicitly-provided archive ahead of the eager compile; passing `-load-core-module` to later commands is insufficient since the eager compile already ran ([slang bootstrap eagerly recompiles core+GLSL at session creation (EMBED_CORE_MODULE=OFF)](../learnings/1782261706992-slang-bootstrap-eagerly-recompiles-core-glsl-at-se.md)).

## GLSL half-float literal path misses extension registration

The GLSL backend (`-target glsl` / `-emit-spirv-via-glsl`) emits a half-float literal like `61440.0HF` **without** the required `#extension GL_EXT_shader_explicit_arithmetic_types : require` directive, so glslang rejects the output. The literal-emit path fails to register the extension the type needs — the same class of gap the Metal FP-suffix bug had on a different backend ([GLSL emitter half-float literal path misses extension registration (slang #11836)](../learnings/1782814479057-glsl-emitter-half-float-literal-path-misses-extens.md)).

## MakeStruct needs its own constructor form (sibling of the array fix)

#11899 is the struct sibling of #11802 (GLSL brace-vs-constructor): `kIROp_MakeStruct` and `kIROp_MakeArray` share one block in `CLikeSourceEmitter`, but GLSL struct literals need a **separate** constructor form from the array fix — patching only the array path leaves struct literals emitting invalid brace syntax ([GLSL struct literal (MakeStruct) needs a SEPARATE constructor form from the array fix](../learnings/1782981552695-glsl-struct-literal-makestruct-needs-a-separate-co.md)).

## [require] E41012 profile-upgrade warnings originate in the checker, not IR late-require

Two entangled GLSL-profile findings. A spurious `E41012 profile implicitly upgraded` on a **combined** `Sampler2D.Load()` under `-profile glsl_450` comes from a static `[require]` being out of sync with the emit-time `isCombined` gate ([Spurious E41012 profile-upgrade warning: static [require] out of sync with emit-time isCombined gate (samplerless)](../learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md)). Crucially, that E41012 is emitted by `slang-check-shader.cpp` (`ProfileImplicitlyUpgraded`), **not** the IR late-require pass — a misattribution seen in PR #11876's own test comment and a prior learning ([E41012 from a [require] attribute comes from slang-check-shader.cpp (ProfileImplicitlyUpgraded), NOT IRLateRequireCapability](../learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md)).


## Recent operational learnings (incremental fold 2026-07-17)

**GLSL FRem fix: use branchless sign*mod, not the scalar fmod ternary (vector-safe)** — Fixing slang#12046 F1 (GLSL `%`/`kIROp_FRem` emitted floor-modulus `mod()` instead of truncated remainder), the triage-suggested fix was to mirror the stdlib GLSL `fmod` intrinsic's scalar ternary `((x<0.0)?-mod(-x,abs(y)):mod(x,abs(y)))` (hlsl.meta.slang). [GLSL FRem fix: use branchless sign*mod, not the scalar fmod ternary (vector-safe)](../learnings/1784161580195-glsl-frem-fix-use-branchless-sign-mod-not-the-scal.md)

---

## FRem->mod() Sign Bug; Metal fmod Sign-Flip Is Redundant (#12046)

Slang `%`(float) and `fmod()` are both truncation remainder (sign follows dividend) and both lower to `kIROp_FRem`; there is no `kIROp_FMod` (GLSL floor-`mod()` is synthesized arithmetically). The real bug (F1): the GLSL *text* emitter maps `kIROp_FRem` -> GLSL `mod()` builtin (`slang-emit-glsl.cpp:2601`), which is floor modulus -- wrong sign for negatives, making `a % b` disagree with `fmod(a,b)` on GLSL though the language defines them identically. The stdlib GLSL `fmod()` case already uses the correct sign-flip workaround, so the fix mirrors it in the emitter FRem case. Non-obvious cleanup (F3): the stdlib Metal `fmod()` sign-flip is bit-identical to plain `fmod` in all four sign quadrants -- Metal's fmod is already C-style truncation remainder, and the in-tree "In Metal fmod is Modulus" comment is factually wrong ([slang mod/rem emission: FRem-to-GLSL-mod is a real bug; Metal fmod sign-flip is redundant](../learnings/1783694537132-slang-mod-rem-emission-frem-to-glsl-mod-is-a-real-.md)).

<!-- fold-20260711 -->

## Two GLSL Switches (enableGLSL vs AllowGLSL) and Their WASM/JS Unreachability (2026-07-21 fold)

Enabling "GLSL" in Slang is gated by **two orthogonal switches** that are easy to conflate — and conflating them produced a public bot error on #11877. (1) `SlangGlobalSessionDesc::enableGLSL` (`include/slang.h:5720`, default **false**) controls whether the builtin **`glsl` module is registered** at global-session creation; when false, `import glsl;` fails with `error[E38201]: 'glsl' module not available` (`slang-session.cpp:1547`). (2) `CompilerOptionName::AllowGLSL` / the `-allow-glsl` CLI flag (`include/slang.h:1089`) controls GLSL **input syntax + operator scope** only, per-session, and does NOT register the module. `AllowGLSL` alone is therefore insufficient for `import glsl;`. A subtle false-positive trap: both `slangc` (`source/slangc/main.cpp:94`) and `slang-test` (`tools/slang-test/test-context.cpp:119`) hardcode `desc.enableGLSL = true`, so every local test/`slangc` run silently has the module available — a green local result does NOT represent the JS/wasm frontend, where `createGlobalSession()` is argument-less → zero-inits the desc → `enableGLSL=false`, and neither `SlangGlobalSessionDesc` nor `compilerOptionEntries` is embind-bound, so a JS caller can enable GLSL by neither route (confirmed capability gap flagged to jkwak-work; closing it needs a slang-wasm embind change). The transferable lesson: when verifying a behavior for a *specific* frontend/environment, check what that target's session-creation path actually sets — `slangc`/`slang-test` enable conveniences the target may not ([GLSL in Slang has TWO separate switches: global-session enableGLSL (module) vs per-session AllowGLSL (syntax)](../learnings/1784551355408-glsl-in-slang-has-two-separate-switches-global-ses.md), correction of the earlier "flag-free from JS" claim: [CORRECTION: import glsl; does NOT work flag-free from JS/wasm — slangc/slang-test mask it via enableGLSL=true](../learnings/1784551884345-correction-import-glsl-does-not-work-flag-free-fro.md)).

## #12169: Global-Scope Array-of-Struct GS Input Crashes glsl-legalize (2026-07-21 fold)

slang#12169 — a global-scope GLSL-style geometry-shader input `in triangle CoarseVertex coarseVertices[3];` crashes `slangc … -target spirv` at `slang-ir-glsl-legalize.cpp:4401 SLANG_ASSERT(realGlobalVar)` (E99997). It reproduces even at `-O0` (before spirv-opt) and on `-target glsl` too — so it is INSIDE the IR legalize pass, not SPIR-V-specific or downstream. Empirically the trigger is precisely **array-of-struct at global scope**: plain `in triangle CoarseVertex v;` compiles, array-of-vector `in triangle float4 p[3];` compiles, but `in triangle CoarseVertex v[3];` crashes. Root-cause hypothesis (needs IR-dump confirmation): the `in` branch's `if (as<IRStructType>(globalVarType))` check (`:4358`) routes plain structs through `tryReplaceUsesOfStageInput`; `array<struct>` fails the struct check and falls to the else branch that matches the `GlobalVariableShadowingGlobalParameterDecoration` key against scalarized tuple element keys — no element matches → `realGlobalVar` stays null → assert. Crucially, this is a **prematurely-closed issue**: PR #11678 (`Fixes #9058`) fixed only the reordered-entry-point-param repro (`failure1.slang`) but closed all of #9058, leaving `failure2.slang` (this exact global-scope form) unfixed — the sibling triage lesson being that a multi-repro issue closed by a single-repro PR must have each repro re-checked at HEAD ([slang #12169 — #9058 closed prematurely; global-scope array-of-struct GS input still asserts realGlobalVar](../learnings/1784603960285-slang-12169-9058-closed-prematurely-global-scope-a.md)).

**Source learnings (21):**
- [`-emit-spirv-via-glsl` tests that rely on glslang to "already do the right thing" need verification](../learnings/1779619281300-slang-via-glsl-test-premise-verify-with-downstream.md)
- [Triaging "GLSL gl_* builtin missing" reports](../learnings/1781162369496-triaging-glsl-gl-builtin-missing-reports-check-cas.md)
- [slang-glslang: add an opt-out via dedicated CMake escape-hatch](../learnings/1781975592365-slang-glslang-add-an-opt-out-via-dedicated-cmake-e.md)
- [GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput](../learnings/1782173862922-glsl-legalize-per-entry-point-system-value-decorat.md)
- [GLSL legalize: per-entry-point system-value decorations (correction — depth is unreachable)](../learnings/1782175454099-glsl-legalize-per-entry-point-system-value-decorat.md)
- [vk::location on a cbuffer is silently dropped → GLSL binding follows declaration order](../learnings/1782215284222-vk-location-on-a-cbuffer-is-silently-dropped-glsl-.md)
- [slang bootstrap eagerly recompiles core+GLSL at session creation (EMBED_CORE_MODULE=OFF)](../learnings/1782261706992-slang-bootstrap-eagerly-recompiles-core-glsl-at-se.md)
- [slang-glslang leaks: LeakSanitizer nightly is NOT a valid verification net](../learnings/1782353151387-slang-glslang-leaks-leaksanitizer-nightly-is-not-a.md)
- [GLSL target emits invalid C-style brace array initializers; WGSL already has the constructor-syntax override](../learnings/1782632216704-glsl-target-emits-invalid-c-style-brace-array-init.md)
- [Slang floors GLSL #version at 450 — "invalid in old GLSL" bugs are usually valid-as-emitted](../learnings/1782721748193-slang-floors-glsl-version-at-450-invalid-in-old-gl.md)
- [CORRECTION: GLSL brace array-init is valid in 4.20+; the bug is portability, not universal invalidity](../learnings/1782737319266-correction-glsl-brace-array-init-is-valid-in-4-20-.md)
- [GLSL MakeArrayFromElement IS reachable in text emit (default-init global const array)](../learnings/1782739391257-glsl-makearrayfromelement-is-reachable-in-text-emi.md)
- [GLSL emitter half-float literal path misses extension registration (#11836)](../learnings/1782814479057-glsl-emitter-half-float-literal-path-misses-extens.md)
- [GLSL struct literal (MakeStruct) needs a SEPARATE constructor form from the array fix (#11899)](../learnings/1782981552695-glsl-struct-literal-makestruct-needs-a-separate-co.md)
- [Spurious E41012 profile-upgrade: static [require] out of sync with emit-time isCombined gate (#11874)](../learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md)
- [E41012 from a [require] attribute comes from slang-check-shader.cpp (ProfileImplicitlyUpgraded), NOT IR late-require](../learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md)
- [slang mod/rem emission: FRem-to-GLSL-mod is a real bug; Metal fmod sign-flip is redundant (#12046)](../learnings/1783694537132-slang-mod-rem-emission-frem-to-glsl-mod-is-a-real-.md)
- [GLSL FRem fix: use branchless sign*mod, not the scalar fmod ternary (vector-safe)](../learnings/1784161580195-glsl-frem-fix-use-branchless-sign-mod-not-the-scal.md)
- [GLSL has TWO switches: global-session `enableGLSL` (registers module) vs per-session `AllowGLSL` (syntax); neither reachable from WASM/JS](../learnings/1784551355408-glsl-in-slang-has-two-separate-switches-global-ses.md)
- [CORRECTION: `import glsl;` is NOT flag-free from JS/wasm; slangc/slang-test mask it via hardcoded `enableGLSL=true`](../learnings/1784551884345-correction-import-glsl-does-not-work-flag-free-fro.md)
- [#12169: global-scope array-of-struct GS input asserts `realGlobalVar` in glsl-legalize; #9058 closed prematurely by #11678](../learnings/1784603960285-slang-12169-9058-closed-prematurely-global-scope-a.md)
_Catalog: [[wiki/index.md]]_
