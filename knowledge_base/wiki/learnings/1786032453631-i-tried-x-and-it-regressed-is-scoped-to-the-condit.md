---
title: "'I tried X and it regressed' is scoped to the conditions X ran under — state them, or it defends a weaker design for you later"
type: learning
topic: misc
source: learnings/1786032453631-i-tried-x-and-it-regressed-is-scoped-to-the-condit.md
---

# "I tried X and it regressed" is scoped to the conditions X ran under — state them, or it defends a weaker design for you later

On slang#12155 (2026-08-06) a peer reviewer's recall surfaced a fix-direction verdict **contrary** to my
central design choice. I had a note in my own store that looked like it refuted them. Checking the source
showed my note was true but **overclaimed by omission** — and the reviewer was probably right.

**The shape.** My record said: *"Key-based lookup FAILS here — regressed `tests/metal/stage-in.slang` when
I tried it. Positional works because ORDER is preserved."* Written after real, measured evidence. But it
omitted the *condition*: I had tried key-based lookup **against a stale, pre-flatten layout**, whose
field-attr key instances genuinely don't correspond to the flattened struct's keys. The correct scope is:

> key lookup cannot **substitute for** rebuilding the layout.

What the note implied, and what I nearly defended in review:

> key lookup is the wrong mechanism here, full stop.

Those differ exactly where it mattered. My fix *does* rebuild the layout — keyed on the flattened struct's
own field keys — so **after** the rebuild the keys match by construction and key lookup becomes not just
viable but better than the positional walk I kept. My own note, taken at face value, argued for the weaker
design. The reviewer's "rebuild at the producer + key lookup + assert" was the stronger shape, and my
evidence never contradicted it.

**Why this is insidious.** A note recording a *negative* result feels like the most solid kind — you ran
it, it failed, you wrote it down. But a negative result is a measurement of `X` **under conditions C**, and
the conditions are exactly what gets compressed away when you summarize. Later, `C` no longer holds
(because your own fix changed it!), and the note now asserts something you never tested. Worse: it arrives
with the authority of "I measured this," so it resists the challenge that would correct it.

**The habit.** When recording "I tried X and it didn't work," write the conditions into the claim, not the
prose around it:
- ✗ "Key-based lookup fails here."
- ✓ "Key-based lookup fails **against the stale pre-flatten layout** (keys don't correspond). Says nothing
  about key lookup after a rebuild."

Then, when a peer proposes X, the note tells you whether their conditions match yours — instead of handing
you a false refutation.

**Corollaries worth the same care:**
- **Check whether your own fix invalidated the condition.** Mine did: the rebuild is precisely what makes
  the keys correspond. The change that makes a negative result obsolete is often *your own diff*.
- **When a peer contradicts a measured note of yours, audit the note's scope before the peer's claim.**
  Same instinct as auditing your own preconditions when a peer disagrees with your *number*.
- **Verify the mechanism they name actually exists** before conceding *or* refuting — I confirmed the
  helper's file:line, signature, matching logic and miss-behavior first. Concession should be as evidenced
  as refusal.
- A negative result that is *never re-scoped* quietly becomes a design constraint nobody chose.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786032453631-i-tried-x-and-it-regressed-is-scoped-to-the-condit.md`_
