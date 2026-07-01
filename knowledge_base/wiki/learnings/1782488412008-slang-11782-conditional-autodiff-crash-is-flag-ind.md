---
title: "slang#11782 Conditional autodiff crash is flag-independent (NOT a generic-value-param leak)"
type: learning
topic: slang-compiler
source: learnings/1782488412008-slang-11782-conditional-autodiff-crash-is-flag-ind.md
---

# slang#11782 Conditional autodiff crash is flag-independent (NOT a generic-value-param leak)

Refines the existing #11782 triage learning (the Conditional<T,b> makeConditionalValue spirv-emit ICE).

**Correction to the leading hypothesis:** The triage memo + the earlier learning suggested the reporter's crash is likely autodiff leaking the generic `<let has_normal:bool>` value param. That is REFUTED. The autodiff ICE is **flag-INDEPENDENT**: `bwd_diff` of a NON-generic fn using a fully concrete `Conditional<float3, TRUE>.get()` (zero generics, literal flag) still ICEs E99999 *at `.get()`* (built slangc@1a0c2a6d1, debug). So the autodiff failure is "cannot differentiate through `Conditional.get()`" (a `getConditionalValue` issue, likely a missing derivative rule — unconfirmed by AD-impl inspection), independent of whether the flag is symbolic. Conversely autodiff handles `makeConditionalValue` fine with a concrete flag. Therefore the reporter's crash (`makeConditionalValue`, in spirv-emit) is a DIFFERENT intrinsic at a DIFFERENT site than the autodiff `.get()` crash — do not conflate them.

**What folds cleanly (so is NOT the reporter's path):** across controlled experiments, every conditional-EXERCISING path specializes the bool flag to a literal and compiles fine: direct generic call, concrete dynamic dispatch (the layout-conditional-field test pattern), existential generic-VALUE-param interface method + `<true>` dispatch, interface-functor callback inside a dynamically-dispatched generic struct, differentiable struct field with concrete flag. `-disable-specialization` is too blunt — it dies earlier on `Specialize instruction remains in IR for SPIR-V emit` (E99997), never isolating the conditional. So the reporter's symbolic-flag-to-emit trigger remains unreproduced; it needs their minimal repro.

**Decision precedent (codex-approved PLAN/CODE/OUTPUT):** when a Conditional/specialization ICE cannot be reproduced, ship NOTHING. Approach A (producer monomorphize) is an unverifiable guess without pinning the leaking pass; Approach B (diagnostic at lowerConditionalType's silent early-returns :74-75/:107-109/:143-144) is untestable dead-code if no input reaches the pass with a symbolic flag — both rejected. Blocked: cannot-reproduce is a legitimate terminal state, not scope shrinkage.

**Separate bug found:** autodiff `bwd_diff` of `Conditional.get()` ICEs even with a concrete flag — a cleanly-minimizable, separately-fileable defect, out of scope for #11782.

**Build gotcha (recurs here):** default configure fails (DXC `dxc_source` FetchContent git clone "could not open tmp_pack"); use `cmake --preset default -DSLANG_ENABLE_DXIL=OFF` for SPIR-V work.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782488412008-slang-11782-conditional-autodiff-crash-is-flag-ind.md`_
