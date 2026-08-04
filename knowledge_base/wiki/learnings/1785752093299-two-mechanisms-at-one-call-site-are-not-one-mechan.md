---
title: "Two mechanisms at one call site are not one mechanism — corroboration needs a causal path, not an overlapping target set"
type: learning
topic: misc
source: learnings/1785752093299-two-mechanisms-at-one-call-site-are-not-one-mechan.md
---

# Two mechanisms at one call site are not one mechanism — corroboration needs a causal path, not an overlapping target set

When you want to confirm that mechanism X changes observable Y, it is not enough to find nearby code that *mentions the same targets* as X. Corroboration requires a **causal path**: the branch producing Y must actually read the state X mutates. Check what the code reads, not which configurations it happens to name.

**Concrete miss** (slangpy#1087, `slang-type-layout.cpp` at `v2026.12`). A capability auto-promotion (`maybePromoteDescriptorHandleCapability`) fires here:

```cpp
else if (auto resPtrType = as<DescriptorHandleType>(type))
{
    maybePromoteDescriptorHandleCapability(context.targetReq);   // mutates target CAP SET

    if (... implies(CapabilityAtom::spvBindlessTextureNV))       // -> uint64
        ...
    if (areResourceTypesBindlessOnTarget(context.targetReq))     // -> layout of T
        ...
    // else                                                     -> uint2
}
```

I cited `areResourceTypesBindlessOnTarget` (`isCPUTarget || isCUDATarget || isMetalTarget`) as corroborating the promotion's exposed target set. Two errors:

1. **The sets merely overlap.** `wgpu` is absent from that predicate while present in the exposed set. Overlapping ≠ identical.
2. **Decisively: none of the three layout branches reads the promoted capability.** They read `spvBindlessTextureNV`, a target-kind predicate, and a fallback. Two adjacent mechanisms sharing one call site read as a single mechanism — but the promotion mutates the **target capability set** (`addUnexpandedCapabilites` + `setTargetCaps`), while the layout selection is decided by unrelated predicates.

**Why this was expensive, not academic.** I had already asked a colleague to A/B the change by compiling a `DescriptorHandle`-using shader with and without the fix. Had they compared **layout, size, or struct offsets**, they'd have found no difference *either way* — because the promotion doesn't affect layout at all — and would reasonably have reported "no flip." A result that could not have come out differently, presented as evidence of safety. The correct measurement is **accept/reject behaviour and diagnostic output**, since a capability-set change is observable in capability *checking*.

**Controls:**

- Before citing code B as corroboration for mechanism A, name the state A mutates and confirm B reads it. If B reads something else, it corroborates nothing, however adjacent it sits.
- **Derive the measurement from what the mechanism mutates.** Capability-set change ⇒ measure accept/reject + diagnostics. Layout/sizing change ⇒ measure offsets and sizes. Picking the wrong observable produces a confident null result.
- Get a **positive control that the two arms differ observably at all** before trusting any "no change" verdict from an A/B.
- Multiple calls in one lexical block are not one subsystem. `foo(ctx); if (bar(ctx)) ...` invites reading `bar` as consuming `foo`'s effect; verify rather than assume.

This is the same family as the vacuous grep and the over-wide line range: **a signal that cannot distinguish the states you care about.** Here the failure was one level further out — not a bad probe, but a *correct probe pointed at the wrong observable*.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785752093299-two-mechanisms-at-one-call-site-are-not-one-mechan.md`_
