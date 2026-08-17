---
title: "The vacuous-assertion family: four shapes of a test that ran, passed, and asserted nothing about the thing at issue"
type: learning
topic: misc
source: learnings/1786211916639-the-vacuous-assertion-family-four-shapes-of-a-test.md
---

# The vacuous-assertion family: four shapes of a test that ran, passed, and asserted nothing about the thing at issue

One Slang compiler fix produced **four** distinct instances of the same failure. Carrying them as a family, because the individual incidents look unrelated and the signature is identical: **the test ran, reported success, and asserted nothing about the thing at issue.**

## The four shapes

1. **A negative check that accepts anything.** I asserted a folded comparison *disappeared* from emitted code (`CHECK-NOT`), which would have passed equally if the compiler folded it to the **wrong constant**. I had verified the values by hand and never encoded them. A `-NOT` pins absence, never correctness.

2. **A control that never ran the code path.** Probing whether a branch was failure-specific, I compared against a "working" case that printed nothing — and nearly read that as *the branch didn't fire*. Actual cause: the whole pass early-outs when the module has no relevant work, so my control never reached the code. **An absence caused by the instrument not running is indistinguishable from an absence caused by the condition not holding.** It took three fixtures to build a control that measured what I claimed.

3. **A halting diagnostic silently truncating a multi-case file.** My test listed four operator shapes; the diagnostic is `fatal`, so compilation stops at the first, and only one case was ever checked. The file *looked* like four assertions. It passed.

4. **A false harness limitation, stated as an honest caveat.** I wrote in the PR body that per-operator coverage was "verified by hand and stated as such, not tested," because "a fatal diagnostic halts compilation so one file can't assert several." **That limitation does not exist** — each test directive is a separate compiler invocation, and an in-tree test has eight, `-D`-selected. The message interpolated the operation name, so three of four operators' user-facing text was entirely unexercised.

## Why #4 is the most expensive

**A stated limitation retires the reviewer's question.** Candour is load-bearing, so a wrong claim about your own coverage protects the gap *better than silence would have* — a disclosure attracts less scrutiny, not more. Same shape as any diligence signal that gets taken as a substitute for the diligence.

So: **before writing "this can't be tested," find an in-tree test that does it.** The claim needs the same verification as code, because it's load-bearing in exactly the place a reviewer stops looking.

## The generalizable check

For any passing test, ask: **what would have to break for this to fail?** If you can't name a concrete mutation, it asserts nothing.

- **Mutation-test with an instrument control.** Break the thing under test, confirm the break is *actually in the rebuilt binary* (grep the sentinel), and only then conclude from the failure. Otherwise a 0/N is indistinguishable from a build no-op. I had been mutating without that confirmation step.
- **Prove the instrument fires before reading its silence as data.** Point it at a case you know responds.
- **Observe both poles.** For a "this used to fail, now it works" claim, run the *old* binary on the same input. A one-pole reading asserts the upgrade rather than demonstrating it.
- **Pin values, not just shapes.** If the correct answer is a specific constant, assert the constant.
- **Count what actually executed.** A green rollup with N skipped and zero relevant jobs is not a pass. My CI reported red five times from a yield gate while zero build jobs ran — the mirror image, and equally unreadable from the badge.

## The connective tissue

All five bullets are one rule: **an artifact that looks identical whether or not it did its job carries no information.** Test annotations, controls, CI badges, coverage caveats, and mutation runs all fail this way, which is why the four incidents above didn't recognize each other at the time.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786211916639-the-vacuous-assertion-family-four-shapes-of-a-test.md`_
