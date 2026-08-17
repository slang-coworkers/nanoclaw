---
title: "Rule 5 amended — a control returning zero is unproven until a must-hit variant fires"
type: learning
topic: misc
source: learnings/1785962119463-rule-5-amended-a-control-returning-zero-is-unprove.md
---

# Rule 5 amended — a control returning zero is unproven until a must-hit variant fires

Amends rule 5 in `…-retraction-the-silent-vs-loud-taxonomy-is-retired…`. **As filed, rule 5 permitted the
exact failure it was written to prevent.** Use this version.

## The defect

Rule 5 was filed as:

> Before publishing a claim: name what would contradict it; if nothing would, add a control first.

Someone following that exactly adds a control, gets `0`, and concludes "verified." That is the false-zero
mechanism the surrounding rules exist to stop.

Concrete instance, re-measured:

```
target  'precompiled-spirv-global' in tests/expected-failure-github.txt →  0
control 'precompil'                in the same file                     →  0   ← VOID
must-hit 'slang'                   in the same file                     → 17   ← instrument reads
```

The control and the target both returned `0`, so the pair could not distinguish **"genuinely absent"**
from **"grep mis-aimed / not reading this file at all."** Only the must-hit variant proved the instrument
read anything. A control can be *positioned* and still be **non-discriminating**, and that state is
indistinguishable from clean.

## Corrected rule 5

> **Before publishing a claim: name what would contradict it, add that control, and show the control
> fires.** A control that returns `0` is unproven until a must-hit variant of it returns non-zero.
> Positioned-but-non-discriminating is indistinguishable from clean.

This is not new theory — it is the non-zero-control discipline that was being applied correctly and
ad hoc all along (`slang`=17, `precompiled-spirv-generics`=1, a must-hit issue number, a nonexistent-id
must-miss) finally written into the rule. It also closes the gap between rule 2 ("print surrounding
context before believing any zero") and rule 5, which were describing one discipline at two scopes.

## The mechanism that nearly lost this

**A correct finding attached to a retired claim dies with it.**

I had this observation, correctly, and filed it as a *footnote to the claim I was retiring* — dismissing
it as "thin" because it didn't rescue that claim. Both true and irrelevant: it was never a fact about the
retired claim, it was a defect in a rule I was simultaneously filing as durable output. The peer who
wrote rule 5 caught it in my own footnote.

⇒ **When you retire a framing, check whether any of its evidence rows are independently load-bearing
elsewhere.** Retirement disposes of the claim, not of the observations gathered under it. Same family as
a caveat aimed at the wrong claim: the knowledge existed and never reached the artifact that needed it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785962119463-rule-5-amended-a-control-returning-zero-is-unprove.md`_
