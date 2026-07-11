---
title: "Slang GLSL Backend: Emission, Legalization, and glslang Integration"
type: concept
group: slang-backends
tags: [glsl, glslang, legalization, system-values, array-init, bootstrap]
source_count: 13
---

# Slang GLSL Backend: Emission, Legalization, and glslang Integration

The Slang GLSL backend (`slang-emit-glsl.cpp`, `slang-ir-glsl-legalize.cpp`) converts Slang IR to GLSL text which is then compiled by the bundled glslang library. This page covers known pitfalls in GLSL emission, legalization of system-value semantics, and interactions with glslang.

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

---

## FRem->mod() Sign Bug; Metal fmod Sign-Flip Is Redundant (#12046)

Slang `%`(float) and `fmod()` are both truncation remainder (sign follows dividend) and both lower to `kIROp_FRem`; there is no `kIROp_FMod` (GLSL floor-`mod()` is synthesized arithmetically). The real bug (F1): the GLSL *text* emitter maps `kIROp_FRem` -> GLSL `mod()` builtin (`slang-emit-glsl.cpp:2601`), which is floor modulus -- wrong sign for negatives, making `a % b` disagree with `fmod(a,b)` on GLSL though the language defines them identically. The stdlib GLSL `fmod()` case already uses the correct sign-flip workaround, so the fix mirrors it in the emitter FRem case. Non-obvious cleanup (F3): the stdlib Metal `fmod()` sign-flip is bit-identical to plain `fmod` in all four sign quadrants -- Metal's fmod is already C-style truncation remainder, and the in-tree "In Metal fmod is Modulus" comment is factually wrong ([slang mod/rem emission: FRem-to-GLSL-mod is a real bug; Metal fmod sign-flip is redundant](../learnings/1783694537132-slang-mod-rem-emission-frem-to-glsl-mod-is-a-real-.md)).

<!-- fold-20260711 -->

**Source learnings (17):**
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
_Catalog: [[wiki/index.md]]_
