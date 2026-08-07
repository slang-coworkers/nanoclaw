---
title: "A guard that stops a segfault can be a REGRESSION in honesty — measure the OUTPUT, not just the exit code"
type: learning
topic: misc
source: learnings/1786033636107-a-guard-that-stops-a-segfault-can-be-a-regression-.md
---

# A guard that stops a segfault can be a REGRESSION in honesty — measure the OUTPUT, not just the exit code

On slang#12155 (2026-08-06) I shipped a bounds guard that turned a compiler segfault into `EXIT=0`. A peer
reviewer asked the one question I hadn't: *does it produce correct output, or silently wrong output?*
Measured answer: **silently wrong**, and the guard was the masking pattern the repo's own methodology
forbids.

**The setup.** A positional walk indexed past a layout array → null deref → SIGSEGV. My guard: if the index
outruns the layout's field count, skip the field. Crash gone, tests green, and I wrote a comment saying such
a field "correctly gets no varying attribute."

**The measurement that broke it.** A shape reaching the guard, compiled with the fix:

```cpp
// unsemanticed out param (EXIT=0 with my guard)   // semanticed control
float4 extra_0;              // ← NO ATTRIBUTE     float4 extra_0 [[color(1)]];
```

Every member of an MSL fragment return struct requires an attribute. A bare member is **invalid Metal** —
emitted with exit 0 and empty stderr, no diagnostic. So the guard converted *segfault* into
*silently-invalid output that a downstream compiler rejects, or worse, mis-binds.* My comment wasn't merely
unproven; it was **false**.

**Segfault → invalid-output is an improvement in crash terms and a REGRESSION in honesty terms.** A crash is
loud, reproducible, and lands on the right layer. Silent wrong output ships.

**The generalizable checks:**

1. **`EXIT=0` is not a pass — diff the artifact against a known-good control.** The single most valuable
   probe was compiling the *same shape with the semantic present* and diffing the emitted code. One line of
   difference told me more than a green suite. Always construct the control that *should* produce the right
   answer.
2. **When you add a guard, ask what the guarded-out path now produces**, not just that it no longer crashes.
   If you can't name the output and show it's correct, you have a masking guard.
3. **A test that pins current behavior can be worse than no test.** My coverage gap was real, but writing a
   regression test for this shape would have committed an **invalid-output golden** — locking the silent
   wrongness in as "expected." When behavior is unresolved, the test must wait for the *correct* answer, not
   ratify the current one. This is the case where "ship a test with every fix" and "don't entrench a bug"
   conflict, and the second wins.
4. **Asymmetry between input and output paths is a producer-bug smell.** The input side pre-stamped a
   synthesized attribute *before* flattening (which is why input-path immunity survived 5 adversarial
   probes); the output side appended a field with neither layout entry nor semantic. When one direction
   handles a case cleanly and the other crashes, fix the producer to be symmetric — don't guard the
   consumer.
5. **Prefer `SLANG_ASSERT` + producer fix over skip-and-continue** — the methodology's "assert impossible
   shapes; handle a shape only when you can explain why it is valid input." A skip says *this is valid, I'm
   ignoring it*; an assert says *this shouldn't reach me*.

**Process note worth as much as the finding:** the reviewer was spinning up a ~10-minute isolated worktree
build to answer this. I already had a binary built from the same branch and answered it in ~2 minutes, then
told them to stop. **Before accepting a peer's build cost, check whether your own tree already answers the
question** — and if it does, interrupt them.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786033636107-a-guard-that-stops-a-segfault-can-be-a-regression-.md`_
