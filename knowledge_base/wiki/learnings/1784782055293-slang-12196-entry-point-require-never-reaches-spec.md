---
title: "slang-12196 entry-point [require] never reaches specializeTargetSwitch (bindless half of #11631)"
type: learning
topic: slang-compiler
source: learnings/1784782055293-slang-12196-entry-point-require-never-reaches-spec.md
---

# slang-12196 entry-point [require] never reaches specializeTargetSwitch (bindless half of #11631)

**Issue:** shader-slang/slang#12196 — entry-point `[require(spvBindlessTextureNV)]` does not select the bindless DescriptorHandle accessor in SPIR-V; only global `-capability spvBindlessTextureNV` does. Design-gated tracking issue (bot-authored) for the deferred *bindless half* of #11631; #11633 is the *version half* (draft PR).

**Root mechanism (verified @HEAD 56eb1aa08):**
- `getDescriptorFromHandle`'s accessor choice is a `__target_switch` (in `hlsl.meta.slang`, actually in `defaultGetDescriptorFromHandle` ~line 27699; `case spvBindlessTextureNV:` ~27784; extern wrapper `getDescriptorFromHandle` ~27801).
- `specializeTargetSwitch` (`source/slang/slang-ir-specialize-target-switch.cpp:41`, `:49`, `:52`) resolves that switch using the **global** `target->getTargetCaps()` ONLY, and is invoked at module-link scope (`source/slang/slang-ir-link.cpp:2425`) **before** any SPIR-V-specific emit/legalize pass.
- Entry-point `[require(...)]` is lowered to an `IRRequireCapabilityAtomDecoration` on the entry-point IR func (`source/slang/slang-lower-to-ir.cpp:15257`), scoped to that entry point, and is **never unioned** into `getTargetCaps()`. So the switch always takes the non-bindless (heap) branch for a source-only requirement.

**Why the naive fix is harmful (issue's key warning, worth remembering):** honoring `[require]` only in a later SPIR-V IR/emit pass (like the *version-scan* `determineSpirvVersion()` in `slang-ir-spirv-legalize.cpp:2538–2557`, which is how the version half works) changes the handle's *type/capability* without changing the *accessor* → incoherent SPIR-V: superfluous `OpCapability BindlessTextureNV`, or a `uint64` field with a `((uint2)handle).x` access → `OpCompositeExtract` on a scalar → assert in spirv-tools `VectorDCE`. A coherence guard test (`tests/spirv/entrypoint-require-bindless-texture-in-buffer.slang`) guards this — but note it is only on the #11633 draft branch, NOT master.

**The hard part = cross-entry-point scoping.** SPIR-V emits ONE linked module; one `IRTargetSwitch` can only be replaced by ONE branch. So you cannot fold an entry point's cap into the module-global set (it leaks into sibling entry points that share the callee). The principled fix (csyonghe's direction) is per-entry-point reachability specialization of the shared callee — Slang already has `specializeIRForEntryPoint` in `linkIR` that could clone the callee per entry point — plus making an entry-point↔entry-point (or source-`[require]` ↔ `-capability`) conflict an error. tangent-vector cautioned AGAINST a `[require]`-conditional warning diagnostic ("promotes a bad mental model").

**Triage takeaway:** this class of issue (capability path-selection via `__target_switch`) is a capability/specialization-LAYER problem, not a back-end emit problem — root-cause fixes belong at link/specialization, and a build is disproportionate to *confirm* (code trace suffices; skip `reproduced`). DeepWiki also flags `slang-ir-peephole.cpp` consults `spvBindlessTextureNV` to pick `DescriptorHandleType`'s underlying type — the type-vs-accessor split that makes a type-only fix incoherent.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784782055293-slang-12196-entry-point-require-never-reaches-spec.md`_
