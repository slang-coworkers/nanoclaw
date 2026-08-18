---
title: "slang#11631 severity: [require]-drop is a SILENT runtime-divergence (SS-class), and only hits codegen-DECISION caps"
type: learning
topic: slang-compiler
source: learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md
---

# slang#11631 severity: [require]-drop is a SILENT runtime-divergence (SS-class), and only hits codegen-DECISION caps

Refines the existing #11631 learnings (which framed the bindless symptom as "silent missed-emit, not wrong/invalid SPIR-V"). Two severity-relevant additions, verified by repro at ToT `da319e61a` (compile-only, `-target spirv-asm`, no GPU):

**1. The "missed-emit" is runtime-divergent → SS-class by the silent-divergence test, even though SPIR-V is valid.** For `[require(spvBindlessTextureNV)]` on `Texture2D.Handle(uint2(5,0)).Load(...)`:
- `[require]`-only → descriptor-heap path: `OpAccessChain %__slang_resource_heap %uint_5` (indexes heap slot 5, needs a heap bound at set=1/binding=2).
- `-capability spvBindlessTextureNV` → bindless path: `OpConvertUToSampledImageNV` treating `uint2(5,0)` as a raw 64-bit device handle (+ `OpCapability BindlessTextureNV`/`Int64`, `OpExtension SPV_NV_bindless_texture`, `OpSamplerImageAddressingModeNV 64`).
Both pass `spirv-val`. So it is NOT invalid SPIR-V and NOT a `spirv-val` failure — but the SAME handle value is interpreted two incompatible ways (heap index vs raw handle), so a user who set up bindless gets silent wrong texture reads. That is a silent miscompile-OF-INTENT (clean compile, no diagnostic) → SS by the "clean compile, nothing to react to" test. Caveat for severity calls: it's "valid-but-divergent-from-declared-intent," a hair softer than a guaranteed-wrong-on-all-setups data-corruption miscompile.

**2. Blast radius = capability-gated codegen DECISIONS, not every capability.** Confirmed affected on two independent mechanisms: `spvBindlessTextureNV` (path selection) and `spirv_1_5` (SPIR-V version: `[require]`→1.0 vs `-capability`→1.5). Confirmed NOT affected: `spvImageQuery` — `OpCapability ImageQuery` is auto-emitted from the instruction (`OpImageQuerySizeLod`) regardless of the declared cap set. Rule of thumb: caps that GATE a codegen decision via `getTargetCaps().implies(<atom>)` (path/version/addressing) are dropped when only declared via `[require]`; caps that are USAGE-driven (emitted as a consequence of the instruction) are fine. So the bug is broad within "codegen-decision caps," which raises severity, but it is not literally all capabilities.

**Routing note:** draft PR #11633 fixes the version half and DEFERS the bindless/general half (real design problem: gates read target-scoped `getTargetCaps()` shared across entry points, but `[require]` is per-entry-point — a naive global merge leaks one entry point's cap into another's codegen). The still-open, higher-severity portion is the bindless/path-selection half.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md`_
