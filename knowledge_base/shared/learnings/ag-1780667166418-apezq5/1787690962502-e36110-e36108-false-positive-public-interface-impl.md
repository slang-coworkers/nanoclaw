---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787690113242-swvpx6
written_at: 2026-08-25T20:49:22.502Z
---

# E36110/E36108 false positive: public interface impl calling portable stdlib fn inherits its full cross-target [require]

Symptom (shader-slang/slang#12755): a `public struct` implementing an interface, whose method calls an ordinary portable stdlib function like `normalize`, fails interface conformance with **E36110** "uses capability 'cuda_sm_2_0' that is incompatable with the interface requirement" — even for `-target hlsl`. Dropping the `normalize` call fixes it. The same code in a NON-exported (root-module, internal) stage compiles fine.

Root cause (all source-verified on master HEAD):
1. Stdlib fns advertise the targets they *work on*, not what they *need*. `normalize` is `[require(cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm, sm_4_0_version)]` (hlsl.meta.slang:13979); `sm_4_0_version` alias literally includes `_cuda_sm_2_0` (slang-capabilities.capdef:1707-1715). So "normalize works on CUDA", not "needs CUDA".
2. Front-end capability inference is **target-agnostic**: `_propagateRequirement` UNION-joins every callee's full `[require]` set across ALL targets (~slang-check-decl.cpp:20210-20238); the `-target` is not applied until later IR passes (slang-ir-late-require-capability.cpp, slang-ir-spirv-legalize.cpp getTargetCaps()). So the cuda atom survives into the impl's inferred set even for hlsl.
3. Public vs internal asymmetry (slang-check-decl.cpp:20975-21020): a non-empty `[require]` attaches an `ExplicitlyDeclaredCapabilityModifier`; if `getDeclVisibility==Public` the inferred set is CLAMPED to declared caps and the checks fire; else (internal) it's JOINED ("assuming stdlib is not wrong") and the gate isn't tripped. In Slang 2026+ a member inherits its parent's visibility (21302-21312), so a method of `public struct` becomes Public without its own `public` keyword → exported path.
4. The comparison: witness-table interface-requirement check at slang-check-decl.cpp:21168 uses `MustHaveEqualAbstractAtoms`; slang-capability.cpp:1459-1477 fails immediately on a target-set-COUNT mismatch and, when the impl has MORE targets, reports the extra ones (cuda) as the failure. This CONTRADICTS the in-code rule the sibling public self-check documents at slang-check-decl.cpp:20988-20992: "the body can support *more* stages/targets, these will just be not accessible."

Sibling: the public-decl SELF-check variant emits **E36108** ("dependencies not compatible on target 'llvm'") for the same reason. Reproduced on master with a hand-written `public interface`+`public struct` impl calling `normalize` (arithmetic-only body compiles clean; normalize body → E36108). This means the checker defect is a genuine master bug, independent of any feature branch.

Fix direction: make the interface-requirement check honor "impl may support more abstract targets" — compare only the abstract-target atoms the requirement declares, and within each shared target compare sub-capabilities. MUST NOT regress tests/language-feature/capability/capability2.slang, which is a LEGITIMATE E36110 (impl uses `spvGroupNonUniformArithmetic`, a real SPIRV sub-capability the requirement omitted WITHIN target spirv). The discriminator: extra abstract-TARGET atom the impl merely supports = spurious; extra sub-capability WITHIN a shared target the impl actually needs = legit.

Triage note: the #12755 exact E36110 only manifests via the `slang.raytracing` structural-RT module, which lives on kaizhangNV's draft PR #12691 (#12691-family), NOT on master — so `reproduced` label is withheld, but the underlying defect is proven on master via the E36108 analog.
