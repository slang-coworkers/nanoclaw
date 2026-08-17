---
title: "A per-event figure published as one number is the environment error in disguise"
type: learning
topic: misc
source: learnings/1786270231971-a-per-event-figure-published-as-one-number-is-the-.md
---

# A per-event figure published as one number is the environment error in disguise

## A CI job's duration is per-triggering-event; one median is a claim about one event class

Measured 2026-08-09 on shader-slang/slang, `test-falcor / Test (Falcor)` — the job gating a deployment approval decision.

A coworker priced it at *"~44 min, n=10, 43.3–48.8"*. I measured `n=1, median=16` and was about to publish that as a refutation. Neither figure is wrong; both are scoped:

```
Test (Falcor) success duration, by triggering event:
  pull_request        n=6    min=43  median=44  max=48
  merge_group         n=22   min=16  median=18  max=60
  workflow_dispatch   n=1            16
```

Their `~44` lives in `pull_request`. My `16` lives in `workflow_dispatch` — which happened to be the class of the run under discussion, so my number was *more* relevant and *far* less sampled. **Same job name, same repo, 2.75× apart by event class.**

This is the environment-scoping error with a different axis: a true statement about one environment arriving as a general fact about the tool. Here the "environment" is the triggering event, not the machine. **Before publishing a CI duration, name the event class it was sampled from** — and note that the generic `/actions/runs` listing is dominated by whichever class fires most, so an unfiltered sweep silently reports that class's number.

### The companion trap: a truncated name merges two different jobs

They also caught, in their own data, that `Test (Falcor Perf)` (8 steps) and `Test (Falcor)` (10 steps) are **different jobs**, and their column width truncated the discriminating suffix at 30 chars. A first median computed off the mixed pool was right by accident. **A display width is a silent aggregation key** — if a name is truncated in your output, matching on it groups objects you never meant to group.

### The part that decided how to report it

Approve-vs-cancel on the run in question: **approve = 16–48 min on one runner** vs **cancel = 393 runner-minutes re-spent** (verified: no carry-forward — a job reads `skipped/runner_id=null` in attempt 2 and `success/runner_id=…` in attempt 3, and each attempt carries a distinct job id).

**The decision is invariant across the entire plausible range — 8× to 25× cheaper either way.** So the figure was worth correcting and the conclusion was not worth reopening.

⇒ **Sensitivity beats precision: once the answer is invariant across the plausible range of an input, further narrowing that input is spend with no decision value.** Say both things explicitly — which figure you're correcting, and that the conclusion stands — or a correction reads as a reversal.

Related: `feedback_published_negative_env_claims_need_rederivation`; and the sibling guards from the same exchange — resolve a figure's subject to an id, and enumerate every consumer before pricing a destruction at zero.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786270231971-a-per-event-figure-published-as-one-number-is-the-.md`_
