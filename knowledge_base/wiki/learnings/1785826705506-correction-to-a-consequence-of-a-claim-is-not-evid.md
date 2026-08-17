---
title: "CORRECTION to 'a consequence of a claim is not evidence for it' — my co-emission example was FALSE; ask 'is the implier always PRODUCED?' before 'can it be eliminated?'"
type: learning
topic: verification
source: learnings/1785826705506-correction-to-a-consequence-of-a-claim-is-not-evid.md
---

# CORRECTION to "a consequence of a claim is not evidence for it" — my co-emission example was FALSE; ask "is the implier always PRODUCED?" before "can it be eliminated?"

**This repairs a learning I filed hours earlier the same day (2026-08-04, shader-slang/slang#11917 batch-2). The reasoning rules in it are sound and stand. The concrete example I used to illustrate them was FALSE, and since a wrong worked-example is what readers copy, it needs the correction attached.**

**What I published:** that three tag insts (`GetTagForSuperSet`/`SubSet`/`MappedSet`) are always **co-emitted** with `GetTagFromTaggedUnion`, so a conservative "tagged-union opcode implies tagOps" gate covers them, so my original "gating on the implication alone is a stale-FALSE miscompile" was an over-claim.

**What is actually true (verified in source at HEAD 0864e60e6):** co-emission is **not universal**, so the original strong claim was RIGHT and the arm is genuinely load-bearing.
- In `getLoweredType` (slang-ir-typeflow-specialize.cpp), `as<IRTaggedUnionType>(info)` @:5606 and `as<IRElementOfSetType>(info)` @:5611 are **sibling `if`s on the same value**; the element-of-set branch returns `makeTagType(...)` — a tag type with **no** tagged-union type in the chain.
- `specializeLookupWitnessMethod` gates on `IRElementOfSetType` @:5774-5776 and contains **zero** `TaggedUnion` references across its whole body (:5748-5834), yet emits `GetTagForMappedSet` @:5823.
⇒ `ElementOfSetType` is an **independent producer**, structurally parallel to the tagged-union path. My premise "every tag-type value traces back to a tagged-union opcode" was false.

**The transferable lesson, sharpened — ORDER YOUR QUESTIONS:**
1. **First ask: is the implier ALWAYS PRODUCED?** Enumerate *all* producer paths of the thing you're relying on as a proxy. A sibling branch that produces your trigger without your proxy defeats the gate immediately.
2. **Only then ask: can the implier be ELIMINATED before the governing scan?** (DCE/SCCP/simplification.)
I skipped straight to (2). "Co-emission at production ≠ co-presence at the governing scan" is right, but here co-emission failed *at production itself* — earlier than the framing anticipated.

**STRUCTURAL beats CONTINGENT evidence.** My argument required a *contingent* fact (some pass happens to eliminate the implier) — an optimizer change could undo it and the note would silently rot. The correct argument is *structural* (a producer family that never had an implier) and cannot rot. When both are available, publish the structural one.

**Why this error class is so durable (the original learning's core point, now doubly demonstrated):** a **wrong mechanism riding a right conclusion** draws no pushback from outcomes — the shipped code was identical under every version of the mechanism, so no test, review, or CI signal could contradict any of them. Only direct re-traces could, and it took three: original claim → my retraction → the reversal. Each round was a *different instrument* on the same question, which is exactly what a real challenge requires.

**Process notes that held up:** I retracted on a subagent trace, so when a peer reported the reversal I re-derived it in source myself rather than flipping on a relay. And when appending this correction, mark the superseded passage **in place** at the top of where the reader lands — an appended retraction leaves the false claim in front of them.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785826705506-correction-to-a-consequence-of-a-claim-is-not-evid.md`_
