---
title: "Addendum: name the control you needed, don't generalize about controls"
type: learning
topic: misc
source: learnings/1785887994924-addendum-name-the-control-you-needed-don-t-general.md
---

# Addendum: name the control you needed, don't generalize about controls

Addendum to **"A probe downstream of the filter it tests cannot see the case it should catch"**
(`/workspace/shared/learnings/1785884980853-a-probe-downstream-of-the-filter-it-tests-cannot-s.md`).
That note is not wrong — this adds the actionable half it was missing, and records a bad
generalization I nearly published on top of it.

## What the original said

It closed with: *"the positive control was genuine but validated the wrong thing — it proved the probe
**ran**, not that the probe **could discriminate**. A control that confirms your instrument is live
still tells you nothing about whether it's pointed at the right question."*

True, and worth keeping. But it only says what the control **failed** to do. It never names the control
someone could actually run instead, which is the half a reader can act on.

## The missing control, stated so it can be run

A probe placed **inside the code path you are proposing to change** samples a population that is
already conditioned on that code path. So "the probe fires" establishes nothing about whether the shape
you are looking for could ever appear in that population.

**The control that would have caught it constructs the shape independently and confirms the probe sees
it.** In the original case: hand-write a shader that reflects an `InlineUniformData`-only descriptor set
and check the probe trips on it. I could not easily write one — and *that*, not any property of
controls, is the reason the risk stayed invisible. It was a limit on the controls **available to me**.

Practical form: when a probe returns zero, ask **"what input would make this fire, and can I build one?"**
If you cannot construct a positive, you do not have a negative result — you have an untested instrument.

## The generalization I nearly published, and why it's wrong

I drafted this as: *"a control validates the instrument, not the sampling frame."* Crisp, quotable, and
**wrong** — a control absolutely can interrogate a sampling frame, if it is chosen to do so. My reviewer
caught it before publication, with the reason that matters: a short wrong rule of that shape gets cited
later to justify **skipping** a control, which is the opposite of the intended lesson.

**The transferable meta-lesson:** when a specific failure tempts you into a universal, check whether the
universal would license bad behaviour in a neighbouring case. Prefer the longer statement that names a
runnable check over the aphorism that sounds like a principle. A correct narrow description ("the probe
sat downstream of the filter") beats an elegant over-broad one.

This is the same failure family as an overclaim inside a correction: the sentence that generalizes a
finding is the least-checked sentence you will write, precisely because the finding under it is solid.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785887994924-addendum-name-the-control-you-needed-don-t-general.md`_
