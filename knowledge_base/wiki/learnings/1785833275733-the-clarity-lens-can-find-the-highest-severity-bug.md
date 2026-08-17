---
title: "The clarity lens can find the highest-severity bug: an under-counting comment is a miscompile invitation"
type: learning
topic: misc
source: learnings/1785833275733-the-clarity-lens-can-find-the-highest-severity-bug.md
---

# The clarity lens can find the highest-severity bug: an under-counting comment is a miscompile invitation

On a three-reviewer Slang PR pass (correctness A / Devin B / clarity C), the **highest-value finding came from the clarity lens**, not the correctness one — and the correctness lens had died at its budget cap. Worth remembering before treating C as the optional third wheel.

**The case (shader-slang/slang#12336, #11917 pass-gating epic).** A PR gated backend passes on `RequiredLoweringPassSet` flags. A comment justified a three-flag implication by stating that `lowerTaggedUnionTypes` "synthesizes `UntaggedUnionType`, `GetTagOfElementInSet` and `SetTagType`" — three families. It actually synthesizes **five**: `TaggedUnionLoweringContext` (`slang-ir-lower-dynamic-dispatch-insts.cpp:1098-1535`) also emits `kIROp_GetTagFromSequentialID` (:1135) and `kIROp_GetSequentialIDFromTag` (:1180), whose sole consumer is `lowerSequentialIDTagCasts`.

The shipped code was **correct** — precisely because `lowerSequentialIDTagCasts` had been left *unconditional*. So the finding inverted an earlier, weaker question. "Why is this pass still unconditional (perf leftover?)" became "**leaving it unconditional is what keeps the two omitted families sound, and the comment actively invites a future maintainer to gate it and ship a stale-FALSE miscompile.**"

**Generalizable lessons:**
1. **A comment that under-counts what a pass produces is a documentation defect whose consequence is a miscompile.** Severity follows the consequence of acting on the comment, not the current behavior of the code. Current-behavior-correct + comment-wrong can outrank a live nit.
2. **When reviewing any "A implies B" gate justification, independently enumerate what the producer actually produces.** Don't verify the implication *as stated* — verify the *set* it quantifies over. Grep the producing context's full line range for every `emitIntrinsicInst`/`emit*` call, then compare to the comment's list.
3. **When a pass is deliberately left ungated between gated siblings, ask what that ungating is protecting.** "Left unconditional" can be load-bearing, not leftover. If so, say so in the comment, or the next person gates it.
4. **Don't discount the clarity lens on correctness-critical changes.** Its bar ("unclear / internally inconsistent / insufficiently explained") is exactly the bar that catches a comment whose claims don't match the code — which is where this class of latent miscompile lives.

Related: prefer "safe by pipeline position" over "safe by co-emission" when arguing a gate's soundness — position can't rot.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785833275733-the-clarity-lens-can-find-the-highest-severity-bug.md`_
