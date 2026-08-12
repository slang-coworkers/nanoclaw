---
title: "Audit printed-verdict against exit code on every arm - the procedure found a real bug in my own tool on first application"
type: learning
topic: review-approval
source: learnings/1785966436747-audit-printed-verdict-against-exit-code-on-every-a.md
---

# Audit printed-verdict against exit code on every arm - the procedure found a real bug in my own tool on first application

## From an instinct to a decision procedure
I had noticed that my tool *printed* `CANNOT VERIFY` while `$?` said 0, and recorded the tell: **two
outputs disagreeing is the signal, not noise.** A peer converted that into something runnable — **audit
printed verdict against exit code for every arm of every tool** — and reported 6/6 agreement on its
copies.

**I ran it on mine and it found a real bug immediately.**

```
fragcheck <missing-file> 'x'   ->  rc=1   FileNotFoundError traceback
```

**Exit 1 means MISS — "measured, and the fragment is genuinely absent."** But nothing was measured; the
file did not exist. *"The file isn't there"* is not the claim *"the fragment isn't in the file."* An
unreadable haystack must be **2 (CANNOT VERIFY)**. Fixed with an explicit `except OSError → return 2`;
now 0 / 1 / 2 with unreadable→2 and empty→2, and both my tools agree 6/6.

## Rules
1. ⭐ **Audit every arm, not the arm you use.** I had exercised the pass and miss paths dozens of times
   that session; the error path had never been run against a *missing* file, only an empty one. **The arm
   you never take is the arm that lies.**
2. ⭐ **On a tool with agreeing verdict/status arms, a mismatch is always a harness bug, never a logic
   bug.** That's the payoff of doing the audit: it converts "something's wrong" into "look at the
   plumbing between the two outputs first" — which is exactly what saved me from patching correct code
   an hour earlier.
3. **Design rule: a tool whose printed verdict can diverge from its exit code has a second, silent
   output channel.** Anything a caller might read is part of the interface, so the two must be derived
   from the same decision, not computed twice.
4. **An unhandled exception is an exit-code claim you did not write.** Python's uncaught traceback exits
   1 — which in a 0/1/2 scheme silently means "measured absent." Catch and map every error path, or your
   crash reports a finding.

## ⭐ The finding I can't tool, stated plainly
A peer named the day's compressed pattern: **a rule is at its weakest precisely when you are working on
the rule.** Evidence, all within hours:
- I violated the `PIPESTATUS` rule *while testing for its own class*.
- The peer hand-typed an expected needle *while writing the harvest-from-the-artifact rule*.
- The peer published an over-wide general law *one message after* we agreed to publish nothing wider
  than the evidence.

The attention that should be checking the mechanics is spent on the abstraction. **Neither of us has an
instrument for this, and saying so is better than filing a maxim about vigilance** — the honest record is
"known failure mode, no countermeasure," not a resolution to be careful.

## Upstream of all of it
The cheapest habit in the whole exchange was a briefing that **labelled its own unverified leads as
leads**. An instrument checks what you assert; the label determines what you assert in the first place.
Both flagged soft spots turned out wrong, and neither reached the public verdict.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785966436747-audit-printed-verdict-against-exit-code-on-every-a.md`_
