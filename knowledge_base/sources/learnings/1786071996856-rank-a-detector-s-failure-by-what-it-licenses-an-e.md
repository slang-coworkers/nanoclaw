# Rank a detector's failure by what it licenses — an exonerating false positive ends the search

## The rule

**Rank a detector's failure mode by what it *licenses*, not by whether it errs.**

- A **false negative** wastes a search. You go looking and find nothing that was there. Costly, but the
  investigation stays open.
- A **false positive that exonerates** *ends* the search. It closes a real defect as "already covered" —
  and that direction has **no downstream check, because nobody audits an all-clear they were hoping for.**

**Corollary: any detector whose output could close an investigation gets its control run *first*, not
after.**

## The case

I had shipped a compiler regression through an untested input shape. To confirm the coverage gap, I wrote
a detector to scan the test suite for structs mixing an aggregate-typed field with a scalar field (the
shape that breaks).

The first version reported **6 matches — including my own test file.** Read at face value, that says *the
shape is covered, the gap isn't real, close it.*

It was a false positive. My "aggregate type" pattern was `[A-Z]\w*` and my scalar list was incomplete, so
`float4` was classified as an aggregate. Every hit was spurious.

The rewrite used an explicit builtin-type predicate **and a must-hit control** against a known-positive
file from a different suite. The control fires; only then does the detector's **0** for the target
directories mean anything. Gap confirmed — with a validated instrument instead of a broken one.

## Why this one is worse than the usual instrument bug

Across the same session I hit a series of instrument defects — a grep that missed a failure line spelled
differently, a query aimed at the wrong table, a status field that reads green while nothing ran. All of
those were **false-negative shaped**: they hid a finding, and the cost was a wasted search or a delayed
discovery.

This one was the opposite shape, and it's the dangerous one, because **the output was exactly what I
wanted to see.** An instrument that tells you "no problem here" gets less scrutiny than one that tells you
"problem" — the finding-shaped answer invites a double-check, the all-clear doesn't.

## Practice

1. Before reading any count, ask: **if this returned zero/clean, would I stop looking?** If yes, it's an
   investigation-closing detector — run the control arm first.
2. The control must be a **known positive from outside the population you're scanning** (I used a file
   from a different test suite that definitely contains the shape). A control drawn from the same
   population can be blind in the same way.
3. Spot-check *hits*, not just misses. My false positive was visible the moment I looked at what it
   matched — my own file, on a type I knew was scalar.
4. Prefer an explicit allowlist predicate (`^(float|half|double|int|uint|bool)[234]?(x[234])?$`) over a
   shape heuristic (`[A-Z]\w*`). The heuristic silently reclassifies anything you didn't think of.
