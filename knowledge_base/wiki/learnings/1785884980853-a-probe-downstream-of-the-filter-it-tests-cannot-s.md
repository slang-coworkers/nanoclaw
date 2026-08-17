---
title: "A probe downstream of the filter it tests cannot see the case it should catch"
type: learning
topic: verification
source: learnings/1785884980853-a-probe-downstream-of-the-filter-it-tests-cannot-s.md
---

# A probe downstream of the filter it tests cannot see the case it should catch

## The mistake

Fixing slang-rhi's Vulkan pipeline-layout builder (shader-slang/slang#12349), my first patch widened a
skip from "PushConstant-only descriptor sets" to "sets with no Vulkan-level bindings" — folding in
`ExistentialValue` and `InlineUniformData` — on the "one source of truth" principle.

To prove it safe I argued `_mapDescriptorType`'s `InlineUniformData` case is dead code, since its sole
call site sits behind a switch that already skips that type. I backed it empirically: replaced that
case body with `SLANG_RHI_ASSERT_FAILURE("PROBE: ...")`, rebuilt, ran all 437 tests → **0 hits**, with
a positive control (`strings <binary> | grep -c "PROBE"` → 1) proving the probe was compiled in and
the zero was real.

Both facts were true. The inference was still wrong, and an independent reviewer caught it.

## Why the probe was worthless

**The probe sat downstream of the very filter under test.** It could only fire for a range that had
already passed the skip list — so it was structurally incapable of detecting a shader that *reflects*
an `InlineUniformData`-only set. It answered "is this type reachable after filtering?" when the
question was "could such a set exist, and does removing it change anything?"

And the answer was yes: before the change, an `InlineUniformData`-only set still called
`findOrAddDescriptorSet`, so under an insertion-order index model it could act as **positional padding**
for a later set. Removing it would shift subsequent `pSetLayouts` entries — a real behaviour change, in
the opposite direction from the bug being fixed. My "no observable behaviour change" claim was false,
and the passing probe had made me confident in it.

## The transferable rule

Before trusting a zero from an instrument, ask **where it sits relative to the thing it measures.** If
the code path being questioned is *upstream* of your probe, a zero is uninformative rather than
reassuring. Concretely: put the probe at the **producer** (does anything ever reflect this shape?), not
at the **consumer** (does anything reach this line after I filtered it?).

A useful reframing: "unreachable at the consumer" and "never produced" are different claims, and only
the second licenses "removing this changes nothing." I had evidence for the first and asserted the
second.

Related: the positive control was genuine but validated the wrong thing — it proved the probe *ran*, not
that the probe *could discriminate*. A control that confirms your instrument is live still tells you
nothing about whether it's pointed at the right question.

## What I did instead

Narrowed the fix to exactly the shape reproduced and measured (PushConstant-only sets), leaving
`ExistentialValue`/`InlineUniformData` behaviour untouched, and said so in the PR body: no test exercises
those shapes, so their possible padding role is a separate question needing its own test. Smaller diff
(+20 lines, second pass untouched), and the claim matches the evidence.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785884980853-a-probe-downstream-of-the-filter-it-tests-cannot-s.md`_
