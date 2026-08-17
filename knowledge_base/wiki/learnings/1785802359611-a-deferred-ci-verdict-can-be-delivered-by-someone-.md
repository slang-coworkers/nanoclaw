---
title: "A deferred CI verdict can be delivered by someone else — check triggering_actor before claiming credit or self-healing"
type: learning
topic: ci-tooling
source: learnings/1785802359611-a-deferred-ci-verdict-can-be-delivered-by-someone-.md
---

# A deferred CI verdict can be delivered by someone else — check triggering_actor before claiming credit or self-healing

## The situation

I classified a single macOS test failure as a flake, fired a `--failed` rerun, and that rerun's job came back **`cancelled`** — neither pass nor fail, so the classification stayed **untested**. I logged it as such and declined to re-fire.

Two sweeps later the PR was fully green. The tempting write-ups are "it self-healed" or "my rerun worked." **Both are wrong.** `gh api repos/O/R/actions/runs/<id>/attempts/3` showed `triggering_actor: pdeayton-nv` — a **human maintainer** pressed attempt 3. My attempt 2 was the one that got cancelled.

## The general rule

When a deferred/inconclusive action later appears resolved, **the resolution has an author, and it may not be you.** Before writing "self-healed" or implying your action worked:

1. Get the attempt/run that actually produced the green result (`/attempts/N`, not the rollup).
2. Read `triggering_actor` — who re-dispatched *that* attempt.
3. Confirm the head SHA is **unchanged** (else it's a new commit, not a retry, and proves nothing about the flake).

Point 3 is what makes the verdict real: a green retry at an *unchanged* head with zero code change is the only thing that converts "suspected flake" into "confirmed flake."

## The subtlety worth keeping

`triggering_actor` is a field I'd previously recorded as a **trap** — on a rerun it reports whoever pressed rerun, so reading it as "who *cancelled* this job?" produces a false smoking gun (it said `nv-slang-bot[bot]` = me). Same field, same correct value, and here it's exactly the right tool — because the question actually was "who re-dispatched this?"

So the lesson isn't "distrust the field." It's that a field answers **one** question, and whether it's a trap or a gold standard depends entirely on whether that's the question you're asking. Note which question you're asking before you read the value.

## Why it matters beyond bookkeeping

An agent that quietly absorbs a human's fix into its own success record produces a corrupted picture of what automation is actually doing — and if the humans stop pressing those buttons, nobody finds out until throughput drops. Attribution accuracy is a prerequisite for measuring your own usefulness.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785802359611-a-deferred-ci-verdict-can-be-delivered-by-someone-.md`_
