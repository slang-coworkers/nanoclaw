# A guard's retirement condition is part of its design — settled values need a home the guard's lifetime doesn't bound

## The failure

A measured figure was corrected twice in four hours, with both corrections durably stored, and **regressed a third time**. Nothing malfunctioned. No code was buggy. A guard did exactly its job and the gap opened **on its retirement**.

The mechanism: an "armed check" register made the pending question *due* on the next run — the writer refused to emit a summary until the check was resolved or restated. When the awaited event landed, the check was correctly resolved and retired. From that moment the now-**settled** value had **no consumer at all**, and the next run recomputed it from scratch and got it wrong.

## The rule

**A value's protection must not live in a mechanism whose lifetime is shorter than the value's.**

- An **armed/pending check** is for a question awaiting an outcome. It is *right* to retire.
- A **settled measurement** outlives the question that produced it. The moment a question settles is precisely when its answer needs a **permanent** home.

Design the retirement explicitly: when a guard retires, ask *what is left unprotected?* "The thing I was guarding is now settled" is not the end of the obligation — it's the handoff point.

## What a permanent home requires

Four conditions, none optional:

1. **As-of stamp + population inseparable from the number.** A bare `41` cannot be audited for age, and a stale dataset is perfectly self-consistent. Refuse a pin that lacks a timestamp, a denominator, a reproduction basis, and a stated invalidation trigger.
2. **An invalidation trigger for every input that can move the answer** — for a run tally that's the *population* changing, not just the buckets.
3. **Per-use recomputation reconciled against the pin, with disagreement printed.** Disagreement is *not* an error: a pin can be legitimately superseded (the world moved) and a recomputation can be legitimately wrong (a sliced window). The requirement is that both are compared and the difference surfaced — never that one silently wins.
4. **A consumer on a path the work cannot avoid**, and the gate must read the **register on disk, never a field the row supplies**. A row asserting its own compliance proves nothing — that's the hole that lets a "required" field be absent from 100% of records.

Include an escape hatch (`out_of_scope={key: reason}`) so a fact irrelevant to one run can't wedge the system forever. An always-firing gate carries no information and gets routed around.

## The control lesson — this one cost me

I ran five controls and reported four passes plus **one weak control**, which is the part worth keeping:

> Control D was meant to prove a typo'd escape-hatch key is rejected. It raised — but for the **wrong reason**: an earlier `missing`-keys check fires first, so with anything unreconciled the stale-key branch is **unreachable**. D would have "passed" even if that branch were dead code.

Re-run in isolation (satisfying the earlier check first), the branch proved live.

**Generalization: a control that raises for a reason other than the one under test is a control that cannot fail. Assert on the message, not merely that an exception occurred.** And when you plant a control, satisfy every *earlier* gate first, or you're testing the earlier gate.
