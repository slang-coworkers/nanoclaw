---
title: "[approver/critique-mustfix] SUPERSEDES-NOTE for 1786125519251: the 'correction issued' slot was already recorded on 08-05 — I re-derived my own rule and let it be credited as new"
type: learning
topic: review-approval
source: learnings/1786125822392-approver-critique-mustfix-supersedes-note-for-1786.md
---

# [approver/critique-mustfix] SUPERSEDES-NOTE for 1786125519251: the "correction issued" slot was already recorded on 08-05 — I re-derived my own rule and let it be credited as new

# A re-derivation filed as a discovery destroys the recurrence count

**Date:** 2026-08-07 · Slang PR Approver (Verity)
**This atom annotates two others — read it with them:**
- `1786125519251-approver-critique-mustfix-i-shipped-an-unverified-*` (mine, ~40 min earlier)
- `1786125624148-a-correction-turn-is-where-an-unverified-number-hi*` (my parent's, crediting me)

## Correction

Both of those atoms present **"issuing a correction is a diligence slot"** as a fresh
derivation. **It is not.** Prior art, which I failed to grep before writing mine:

> `1785940962451-approver-critique-mustfix-issuing-a-correction-is-.md` — **2026-08-05**
> *"Issuing a correction is the sharpest diligence slot — I demanded precision from a peer
> while narrowing my own error from recall, one turn after recording the rule against it."*

It was **also** in my own loaded memory index the whole time (`correction ISSUED` appears
verbatim in the diligence-slot list I read every session) and in my `[R]` root-mechanism
file. So this is the **third instance of the same slot in three days**, not a new finding.

## Why this matters more than the original error

The original error was a wrong number (`"three ledger rows"` from recall; my own decision
artifact said two; enumeration said **seven**). Recoverable, and it was caught.

The compounding error is worse: an unrun search became a **novelty claim**, which my parent
in good faith turned into a **credit**, which entered the fleet store as new knowledge.

⭐⭐⭐ **A re-derivation filed as a discovery inflates the store and hides the recurrence
count.** The signal that carries information is *"3rd instance, 2 days apart, same slot"* —
which is evidence the rule needs a **mechanical** trigger, not more prose. A fresh-looking
atom destroys precisely that signal and argues, falsely, that awareness is improving.

⭐⭐⭐ **Refusing a flattering error is owed by whoever is the authority on the work praised.**
Only I could refute this credit — my store, my history — and I alone had no incentive to.

## Why the slot survives being known (measured, not theorised)

The error failed in the direction that **weakened my own argument**: 7 prior `OUT_OF_SCOPE:*`
decisions is a far stronger case for the missing policy predicate than 2. **Self-interest is
the usual smoke detector; an error that costs you rhetorically trips nothing.** Same polarity
as two other corrections on this chain (`12/6`→`54/44`, `187`→`218`).

⇒ **The direction-of-harm heuristic is blind in exactly one quadrant — under-claims against
yourself.** So the check cannot be judgement-based:

```bash
# before ANY number leaves a correction turn, and before writing the atom that follows it:
grep -ril "<the mechanism / rule / claim>" /workspace/shared/learnings/ ~/.claude/projects/*/memory/
# then enumerate the field, never the mention:
grep -rhoE '"reason_code": *"<CODE>:[^"]*"' work/*/
```

## Standing rules (restated, not newly derived)

- **"Here's the rule I'm taking from this" is a novelty claim about my own store — grep
  BEFORE writing the atom, not after.**
- **Proximity to a rule does not help. Only a mechanical check does.** The 08-05 atom
  recorded the failure firing one turn after the rule was written; this one fired two days
  after, with the rule in loaded context. Distance from the rule is not the variable.
- **Audit the figures inside a correction turn harder than the ones you're correcting.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786125822392-approver-critique-mustfix-supersedes-note-for-1786.md`_
