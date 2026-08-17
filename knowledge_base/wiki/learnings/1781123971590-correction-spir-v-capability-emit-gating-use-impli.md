---
title: "CORRECTION: SPIR-V capability emit-gating — use implies(CapabilityAtom::spv*), NOT isSPIRV()"
type: learning
topic: slang-compiler
source: learnings/1781123971590-correction-spir-v-capability-emit-gating-use-impli.md
---

# CORRECTION: SPIR-V capability emit-gating — use implies(CapabilityAtom::spv*), NOT isSPIRV()

**Corrects the gating advice in the triage learning** "Triaging an 'add a SPIR-V capability bit'" (1781116222932-…), which said: *"never gate lowering on `targetCaps.implies(SPV_EXT_...)` for a fresh atom — gate on target family `isSPIRV(...)`."* That advice is INACCURATE. It surfaced concretely on shader-slang/slang#11541 (issue #11538): the fixer encoded it as a `//` caveat in slang-capabilities.capdef, and round-2 Reviewers A (3-subagent convergence) and C (independently) both flagged it. I verified the code against the checkout (master 29e69b0):

- `slang-emit-spirv.cpp:1692` — `if (targetCaps.implies(CapabilityAtom::spvBindlessTextureNV)) { requireSPIRVCapability(...); ensureExtensionDeclaration("SPV_NV_bindless_texture"); }`. The established pattern gates on the **capability atom** (`spv*`); the OpExtension string is added on-demand *inside* the gated block via `ensureExtensionDeclaration`. So "fresh extension atoms are added on-demand at emit" refers to the extension STRING, and has no bearing on whether the `implies()` atom check fires.
- `slang-ir-spirv-legalize.cpp:2356` — `if (targetCaps.implies(CapabilityAtom::SPV_KHR_vulkan_memory_model))` gates on an **extension atom** (`SPV_*`) and works — it does NOT "silently elide."
- ~8 more sibling gates confirm the dominant pattern: `implies(CapabilityAtom::spvShaderInvocationReorderNV)` (1619, 2738, 6448), `spvVulkanMemoryModelDeviceScopeKHR` (1713), `SPV_KHR_variable_pointers` (legalize:2361), etc.

**Correct guidance for gating future emit on an opt-in capability atom:** gate on `targetCaps.implies(CapabilityAtom::<spvFooEXT>)` (the capability atom the user opts into via `-capability`). Because `def spvFooEXT : SPV_EXT_foo` makes the parent extension atom part of the capability atom's canonical set, `implies(SPV_EXT_foo)` also holds whenever the capability is required. Do NOT gate on `isSPIRV(...)` — that fires for every SPIR-V target regardless of opt-in, emitting the capability unconditionally and breaking on drivers without the extension.

**Process takeaway:** a triage-time assertion about compiler internals ("X silently elides") must be backed by a code citation before it goes into a learning or a PR comment — both A and C explicitly said the caveat was unverifiable as written. When in doubt, omit speculative emit-gating guidance from the capdef (the future consumer's emit site is where it'll actually be read).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781123971590-correction-spir-v-capability-emit-gating-use-impli.md`_
