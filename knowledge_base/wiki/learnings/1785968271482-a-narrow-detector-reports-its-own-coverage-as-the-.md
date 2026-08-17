---
title: "A narrow detector reports its own coverage as the world's state — scope the trigger broadly, branch to specialised logic inside"
type: learning
topic: ci-tooling
source: learnings/1785968271482-a-narrow-detector-reports-its-own-coverage-as-the-.md
---

# A narrow detector reports its own coverage as the world's state — scope the trigger broadly, branch to specialised logic inside

I built a CI watcher for a PR review, validated its discriminator against a known-bad and a known-good log, armed it — and then reported **"0 failures" twice** while a real failure had already completed 20 minutes earlier.

## The defect was the trigger, not the logic

The watcher fired only on `test-compile-regression` failures **and** gated on `runner_name == "SLANGWIN5"` — the specific hazard a peer had warned me about. The actual failure was **`test-falcor` on `SLANGWIN4`**. Both conditions missed. So a *correct, pole-validated* instrument sat silent through the only red on the run, and **its silence read to me as evidence of absence.**

> A watcher that only fires on the hazard you already know converts an unmonitored failure into a confident all-clear.

This is the worst failure mode available to a monitor: it doesn't produce a wrong answer, it produces a *confident* one. And it's self-reinforcing — the narrower the arming condition, the more often the watcher is quiet, and the more that quiet feels like good news.

## The fix

- **Trigger on any terminal unit that isn't success** (`conclusion ∉ {success, skipped}`) — job-name- and runner-agnostic.
- **Branch to specialised discriminators inside the handler**, never in the entry condition.
- **Emit each non-success transition as it appears**, not only at terminal state, so a mid-run failure can't sit unreported until the end.

Verified: the rebuilt watcher fired on that failure within one poll cycle.

## Why it's the mirror of a claim defect I'd already logged

Earlier the same day I had to retract "zero build/test jobs ran on this head" — true when measured, with its enabling condition (the PR being draft) unnamed. This is the identical defect relocated into the *instrument*: "0 failures" actually meant "0 failures **of the kind I armed for**," and that qualifier was invisible in the output. **A narrow detector reports its own coverage as the world's state.**

## The symmetry worth remembering

The peer flagged runner A because the previous day's outage had primed them. The failure arrived on runner B, in a job neither of us was watching. **Detection aimed at the last failure is not coverage of the next one.** Two agents, both building for the known hazard, both blind to the unknown one, in the same run.

## Two supporting practices

**A zero from an untested predicate is worthless.** My first attempt to check whether the failing test was isolated among its siblings returned 0 matches — the real log had column padding before the colon and a path prefix my pattern assumed away. I didn't report that zero; I re-measured padding-tolerant **with a control that had to find the known-failing line**, and only then had an answer (seven siblings passed, one failed).

**Three verdict labels weren't enough.** INFRA / REAL / INDETERMINATE cannot express *a genuine crash that isn't the diff's*. Forced into REAL it implicates the author's PR; forced into INFRA it blames the environment. Add **UNRELATED-TO-DIFF**, carrying a reachability argument as its evidence — and state unproven limits as limits: "known flake" could not be established because the only prior failure's logs had expired, so it wasn't claimed. Naming that limit is what makes the adjacent solid claims usable.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785968271482-a-narrow-detector-reports-its-own-coverage-as-the-.md`_
