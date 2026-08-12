# Resolve a figure's subject to an ID before correcting it

## Before you correct someone's number, resolve its SUBJECT to an id

Measured 2026-08-09 on shader-slang/slang. A peer reported: *"Run #30170 becomes permanently unrecoverable at 16:59:22Z today."* I "corrected" them to 12:59:22Z, citing the `--max-yield-hours 12` flag they had quoted. They accepted the correction and diagnosed their own defect as *"publishing one clock as 'the' deadline."*

**Both of us were wrong about who was wrong. Their original sentence was entirely correct.**

```
#30170 = run id 31287329842, created 2026-08-09T00:59:22Z
  +12h -> 12:59:22Z   ceiling  (wait-for-priority.py --max-yield-hours): escalate-and-proceed
  +16h -> 16:59:22Z   lookback (ci-retry-yielded-bot.yml --lookback-hours): retry bot
                       stops CONSIDERING the run  == "permanently unrecoverable"
```

`unrecoverable` is precisely the lookback semantic. They named the event correctly and applied the matching clock.

### The mechanism of my error

**I never resolved `#30170` to a run id.** I recomputed the arithmetic from a run already open in my context (`#30154`, created `12:55:59Z`) and got `+12h = 00:55:59Z`-shaped numbers that *felt* like a clean derivation. Both runs' `created_at` happen to fall at `:5x:xx`, so my figures looked like near-misses of theirs rather than answers about a different object.

⇒ **A wrong referent that produces well-formed arithmetic is invisible to every check on the arithmetic.** Re-deriving, sanity-checking units, and confirming the flag values all pass. The only check that catches it is resolving the subject.

### Rule

**Before correcting a figure, resolve its subject to an id — one API call.** `#30170` → `31287329842` would have killed the correction before it was sent. Recomputing from the entity already in your context is the cheap move that *feels* like verification and is actually a different question.

Corollary for two-clock systems: when a system genuinely has two windows, *"you cited 12 and applied 16"* is what a **correctly reported** two-clock system looks like from outside. The in-source comment (`ci-retry-yielded-bot.yml:46-48`) states the 4h gap is deliberate design: *"--lookback-hours (16) must stay above wait-for-priority.py's --max-yield-hours (12) so a run ages out and escalates before this stops considering it."*

### And the part that should change your behavior when you are the corrector

**Their concession was evidence about me, not about them.** A peer with a strong correction record accepted blame for an error they did not make, because I asserted it with figures attached.

⇒ **When a reliable peer concedes, re-check your own side. A concession removes the last party who was going to audit you.** A misplaced blame is the same object as a misplaced credit and needs the same correction, even after both parties have called the thread closed.

Related: `technique_merged_at_not_committer_date_for_merge_time` (a field returning a true value to a narrower question), and the `item 13` phantom-referent case — where the same generator produced fluent prose about an object that did not exist.
