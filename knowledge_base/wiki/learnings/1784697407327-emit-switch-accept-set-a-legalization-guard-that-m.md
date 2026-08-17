---
title: "Emit-switch accept-set + a legalization guard that mirrors it must share ONE predicate (comparison-sampler drift)"
type: learning
topic: misc
source: learnings/1784697407327-emit-switch-accept-set-a-legalization-guard-that-m.md
---

# Emit-switch accept-set + a legalization guard that mirrors it must share ONE predicate (comparison-sampler drift)

**Context:** slang#12185 / PR #12186. I added a SPIR-V legalization guard that diagnoses `CastDescriptorHandleToResource` result types the emitter's conversion `switch` can't encode, converting an old `SLANG_UNEXPECTED` abort into a clean E55215. Both the guard and the emit switch independently enumerated the "encodable" set as `kIROp_TextureType || kIROp_SamplerStateType`.

**The bug reviewers caught (correctness, not style):** that accept-set was WRONG — it omitted `kIROp_SamplerComparisonStateType`. `SamplerComparisonState` registers as `DescriptorKind.Sampler` (hlsl.meta.slang:27401, same as `SamplerState`), generates a `.Handle`, and is genuinely encodable via `OpConvertUToSamplerNV` — the SPIR-V TYPE emitter already treats both sampler ops identically (`emitOpTypeSampler`). So my guard turned an abort into a *wrong diagnostic* for a supported kind. Confirmed empirically: `uniform SamplerComparisonState.Handle` → E55215 before fix.

**Two-site drift is the root cause, and it had already diverged TWO ways:**
1. Sampler hierarchy: matching leaf op `kIROp_SamplerStateType` instead of `as<IRSamplerStateTypeBase>(type)` (the base covers both `SamplerState` + `SamplerComparisonState` — see slang-ir-insts.lua `SamplerStateTypeBase`).
2. Unwrap asymmetry (latent re-abort): the guard did `unwrapAttributedType(...)` but the emit switch read `inst->getDataType()->getOp()` raw — an AttributedType-wrapped texture/sampler could pass the guard then hit the emit `SLANG_UNEXPECTED`.

**Rule / fix pattern:** when a guard/diagnostic in pass X exists to keep a `default: SLANG_UNEXPECTED` (or abort) in pass Y unreachable, the "accepted set" MUST be a single shared predicate both call sites use — never two hand-maintained copies. Here: extracted `bool isBindlessTextureNVEncodableResourceType(IRType*)` into slang-ir-util.h/.cpp (unwraps attributed types, matches `kIROp_TextureType || as<IRSamplerStateTypeBase>`), used by the legalization guard; added `case kIROp_SamplerComparisonStateType` to the emit switch (fixing the guard alone just moves the failure to the backstop — you need BOTH sites). Matches CLAUDE.md "one source of truth / assert the invariant."

**Process lesson:** widening a guard is insufficient without widening the consumer it protects — trace the full producer→guard→consumer chain and fix the accept-set at all points, ideally via one predicate. Also: to enumerate a "family" of IR ops, check for the `*TypeBase` class (`as<IRSamplerStateTypeBase>`) rather than listing leaf ops — the latter silently omits siblings.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784697407327-emit-switch-accept-set-a-legalization-guard-that-m.md`_
