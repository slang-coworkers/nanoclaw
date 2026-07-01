---
title: "Slang [require] capabilities never reach codegen cap set; version path has a partial compensation, bindless has none"
type: learning
topic: slang-compiler
source: learnings/1781638061693-slang-require-capabilities-never-reach-codegen-cap.md
---

# Slang [require] capabilities never reach codegen cap set; version path has a partial compensation, bindless has none

**Issue #11631 root-cause (commit 890f8bef5).** Entry-point `[require(...)]` capability atoms do NOT update the SPIR-V codegen capability set, so source-level `[require]` diverges from command-line `-capability`. Both repro on top-of-tree (compile-only `-target spirv-asm`, no GPU).

**The gap:** `TargetRequest::getTargetCaps()` (`slang-target.cpp:66`, cached `cookedCapabilities`) is composed ONLY from target-format + `-profile` + command-line `-capability` atoms (`slang-target.cpp:214-231`). In `validateEntryPoint` (`slang-check-shader.cpp:1926-2010`) the `[require]` atoms are `nonDestructiveJoin`ed into a **throwaway local copy** purely to emit `EntryPointUsesUnavailableCapability` diagnostics, then discarded — never merged into the set lowering/emit read. `[require]` does lower to `IRRequireCapabilityAtomDecoration` on the entry func (`slang-lower-to-ir.cpp:16107`), but few consumers honor it.

**Asymmetry between the two symptoms:**
- SPIR-V *version* (`[require(spirv_1_5)]`): there IS a partial per-entry-point compensation — `determineSpirvVersion()` (`slang-ir-spirv-legalize.cpp:2431-2533`) scans `IRRequireCapabilityAtomDecoration` but only at GLOBAL scope and only for internal atoms `_spirv_1_3..1_6`; it misses the per-entry-func decoration and the public alias `spirv_1_5` (which expands to internal `_spirv_1_5` + extensions). So version stays at the profile default.
- *Bindless / general capability* (`[require(spvBindlessTextureNV)]`): the gates read `getTargetCaps().implies(CapabilityAtom::spvBindlessTextureNV)` (`slang-ir-spirv-legalize.cpp:1704`, `slang-emit-spirv.cpp:1689`, also `slang-ir-byte-address-legalize.cpp:292+`, `slang-type-layout.cpp:481/5669`) with NO `[require]`-aware path at all → always the resource-heap path.

**Load-bearing design tension for any fix:** `getTargetCaps()` is **target-scoped, shared across all entry points** (cached, mutex-guarded), whereas `[require]` is **per-entry-point**. A naive global merge leaks one entry point's `[require]` into another's codegen in multi-entry-point compiles. The principled fix is per-entry-point scoping; alternatively, keep validate-only semantics and DIAGNOSE when a `[require]` atom isn't target-available (the issue lists this as acceptable). Public-alias-vs-internal-atom (`spirv_1_X` vs `_spirv_1_X`) is a recurring trap in this area.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781638061693-slang-require-capabilities-never-reach-codegen-cap.md`_
