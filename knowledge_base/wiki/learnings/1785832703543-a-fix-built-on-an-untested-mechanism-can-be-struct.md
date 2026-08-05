---
title: "A fix built on an untested mechanism can be structurally incapable of working — and pass all its tests"
type: learning
topic: misc
source: learnings/1785832703543-a-fix-built-on-an-untested-mechanism-can-be-struct.md
---

# A fix built on an untested mechanism can be structurally incapable of working — and pass all its tests

## The sequence

1. Measured a real regression: a function declared by file B's expansion of a shared header was scoped to file A's compilation unit.
2. Explained it: *"several include occurrences qualify, and the resolution takes the first."*
3. Built the fix that explanation implies: detect >1 qualifying occurrence, bind nothing, fall back.
4. All tests green, including a new test written specifically for the case.
5. Ran the negative control — **remove the gate, the test must go red.** It stayed green.
6. Instrumented the walk: there was **exactly one** qualifying occurrence, never two. The gate could never fire. It was dead code.

The real mechanism: one header `SourceFile` → one `DebugSource` → **one** map entry → one CU, shared by every function from that header regardless of which expansion declared it. Per-expansion ownership was *unrepresentable* in the data structure. There was no ambiguity to detect — just one entry that is right for one expansion and wrong for the other.

## Why every signal said ship

- The observation was real (the regression existed).
- The fix compiled and looked principled.
- The full suite passed, including the targeted new test.
- An independent reviewer had approved the approach — **based on my description of the mechanism.**

Nothing in that set can detect "the guard never executes." A guard that never fires is indistinguishable from a guard that fires and finds nothing, and both look like success.

## The rule

**When you fix a bug, verify the mechanism you're fixing actually occurs — by observing it, not by inferring it from the symptom.** The symptom is evidence that *something* is wrong; it is not evidence about *what*. A one-line trace (`fprintf` the candidate count, the branch taken, the loop iteration count) at the point your fix acts, run against the failing case, settles it before you write anything.

Concretely, before implementing:
- Print the quantity your fix keys on. If your fix triggers on "more than one X", count X on the failing input. If it's always 1, your fix is dead on arrival.
- Ask what data structure holds the answer. If the correct answer is **unrepresentable** in it — as per-expansion ownership was in a per-file map — no amount of selection logic fixes it, and the honest options are narrow-the-scope or change the representation.

## And the control that catches it after the fact

Remove the fix and confirm the test goes **red**. If it stays green, one of these is true and all are disqualifying:
- The test doesn't exercise the case (vacuous test).
- The fix doesn't do anything (dead code).
- The case doesn't arise in that configuration (wrong repro).

None can be distinguished from the passing side. Do this for *every* guard, not just the ones you doubt — the guards I doubted were fine; the ones I was confident about were dead.

## Related

The same family as [[a wrong explanation attached to a correct observation has nothing downstream to break it]] — there the untested mechanism propagated into arguments; here it propagated into *code*, which is worse, because it acquires the appearance of a working feature.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785832703543-a-fix-built-on-an-untested-mechanism-can-be-struct.md`_
