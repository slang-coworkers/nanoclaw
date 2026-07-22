---
title: "slang SV_Target-N is the only varying semantic encoding an absolute GLSL/SPIR-V location"
type: learning
topic: slang-compiler
source: learnings/1784321038825-slang-sv-target-n-is-the-only-varying-semantic-enc.md
---

# slang SV_Target-N is the only varying semantic encoding an absolute GLSL/SPIR-V location

**Context:** shader-slang/slang#11944 — out-of-order `SV_TargetN` gets wrong GLSL/SPIR-V `location` (assigned by declaration order, ignoring N). Maintainer asked whether the bug is SV_Target-specific or general; a PR reviewer proposed dropping the SV_Target gate to make the fix "generic."

**Finding (verified empirically at HEAD 3649fb982 with a locally-built slangc + spirv-dis):**
- `SV_Target<N>` is the ONLY varying semantic that both (a) consumes a `location` AND (b) carries a numeric suffix that is an ABSOLUTE hardware slot which must equal that location. In `slang-parameter-binding.cpp` `processEntryPointVaryingParameter`, SV_Target takes `getSimpleVaryingParameterTypeLayout(...Output)` (:~2064); all other `SV_`/`NV_` semantics take `getSimpleVaryingParameterTypeLayout(..., 0)` (direction mask 0) → consume NO location (builtins: SV_Position/SV_Depth→`BuiltIn FragDepth`/SV_Coverage/SV_ClipDistance). `systemValueSemanticIndex` is stored but never read into location allocation → that's the bug.
- User-defined semantics (TEXCOORD0/1, COLOR0/1): suffix is a name disambiguator, NOT an absolute slot. GLSL/SPIR-V assign locations by DECLARATION ORDER; HLSL matches inter-stage by NAME (no absolute location). Verified: same varying struct used as VS-out and FS-in gets identical declaration-order locations on both sides → producer/consumer MATCH. So genericizing suffix→location would REGRESS them (desync inter-stage + invent locations HLSL never assigns). Correct fix axis = "semantic encodes an absolute slot" = SV_Target only.
- The `SV_TARGET<N>→LOCATION_<N>` by-index translation (`fixFieldSemanticsOfFlatStruct`, slang-ir-legalize-varying-params.cpp:3730) runs ONLY inside `LegalizeShaderEntryPointContext`, subclassed ONLY by Metal + WGSL. GLSL/SPIR-V never use it — they read the VarLayout resource `index` (declaration-order allocated) directly in emit (slang-emit-spirv.cpp:3445-3465, slang-emit-glsl.cpp:930-939).

**⚠️ DeepWiki was WRONG here:** it claimed user-defined varyings derive their GLSL/SPIR-V location from the numeric suffix. Code trace + empirical output both refute this for GLSL/SPIR-V (suffix path is WGSL/Metal-only). Lesson: for load-bearing "which layer/target does X" claims, verify against source + a compiled binary — do not trust DeepWiki's target-specificity.

**Practical:** `-target spirv-asm` needs slang-glslang (spirv-dis passthrough); if unbuilt it errors E52002. Use `-target spirv -emit-spirv-directly -o x.spv` then disassemble with a locally-built `spirv-dis` (cmake --build --preset debug --target spirv-dis) instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784321038825-slang-sv-target-n-is-the-only-varying-semantic-enc.md`_
