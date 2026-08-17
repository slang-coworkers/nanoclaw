---
title: "Slang bindless/descriptor-heap path is selected at specializeTargetSwitch, not the spirv-legalize gates"
type: learning
topic: slang-compiler
source: learnings/1784780629812-slang-bindless-descriptor-heap-path-is-selected-at.md
---

# Slang bindless/descriptor-heap path is selected at specializeTargetSwitch, not the spirv-legalize gates

**Context:** shader-slang/slang#11631 — honoring entry-point `[require(spvBindlessTextureNV)]` in codegen. csyonghe's design (comment 4928176359) says "scan all entrypoints in the SPIR-V backend IR passes and legalize the bindless operation accordingly." Reading that *wording*, it's tempting to prescribe generalizing the `targetCaps.implies(CapabilityAtom::spvBindlessTextureNV)` gates in `slang-ir-spirv-legalize.cpp` (~:1755) and `slang-emit-spirv.cpp` (:1692/:2717) to also OR in a per-entrypoint requirement. **That is the wrong layer.**

**Verified mechanism (@HEAD 56eb1aa08):** The bindless-vs-descriptor-heap accessor (`getDescriptorFromHandle`'s `__target_switch`) is resolved by `specializeTargetSwitch` in `source/slang/slang-ir-specialize-target-switch.cpp` (:41/:49/:52), which reads **global `target->getTargetCaps()` only** — `isIncompatibleWith`, `isBetterForTarget`, `atLeastOneSetImpliedInOther`. The downstream `targetCaps.implies(spvBindlessTextureNV)` gates in spirv-legalize/emit-spirv are *consumers* of the already-selected accessor, not the selection point.

**Consequence:** Touching those IR-pass gates does NOT move the selection — empirically it produced a cosmetic unused `OpCapability BindlessTextureNV` (a regression vs master) and a `slang-ir-vector-dce.cpp:306` crash (proven with SPIR-V diffs + op-counts). Honoring `[require]` in bindless codegen requires feeding it into the **specialization capability layer** (module-global `getTargetCaps()`), which carries jkwak's cross-entrypoint capability-leak problem in a multi-entrypoint compile. That makes it a genuine design call for the owners (csyonghe/tangent-vector), not a mechanical backend-IR-pass generalization — so "add conflict detection to the IR gates" cannot reach it.

**Method lesson (the reusable one):** When a maintainer's design comment names a mechanism loosely ("honor it in the backend IR passes"), verify the *actual* decision point with a trace/diff before prescribing where to edit. `__target_switch` accessor selection lives at `specializeTargetSwitch` reading global target caps — treat the `implies(...)` gates as downstream. Distinguish the version half (which genuinely IS honor-in-codegen: `determineSpirvVersion` at spirv-legalize:2482/2538 reads per-entrypoint `RequireCapabilityAtomDecoration`s stamped on the codegen module) from the bindless half (specialization-layer, global-only). They look like "the same fix" from the issue text but sit at different layers.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784780629812-slang-bindless-descriptor-heap-path-is-selected-at.md`_
