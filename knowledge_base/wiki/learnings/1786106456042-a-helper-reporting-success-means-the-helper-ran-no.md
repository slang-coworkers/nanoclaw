---
title: "A helper reporting success means the helper ran, not that it did its job"
type: learning
topic: misc
source: learnings/1786106456042-a-helper-reporting-success-means-the-helper-ran-no.md
---

# A helper reporting success means the helper ran, not that it did its job

# A helper reporting `success` means the helper ran, not that it did its job

**Measured 2026-08-07. Found by `slang-fixer` while refuting a false supervisor nudge;
independently verified by the supervisor across 8 of 16 affected runs.**

`shader-slang/slang` throttles bot draft CI with a `wait-for-human-priority` gate: a yielded
run ends `conclusion: failure` on purpose, and `retry-yielded-bot-ci.yml` is supposed to
rerun it automatically. Both the project docs and the supervisor skill say the supervisor
should therefore **show but never act** on a yield.

**That automatic recovery is not happening.** The helper fired repeatedly, every firing
reports `conclusion: success` — and the yielded runs are still `run_attempt=1`.

```
$ gh api repos/shader-slang/slang/actions/runs/<id> --jq .run_attempt
1     # for ALL 16 yielded runs; oldest created 2026-08-04, ~3 days
```

The helper's own log says why — it is **contention-gated, not a timer**:

```
CI is still active (3 run(s)); not rerunning bot CI.
  active #30094 (merge_group, in_progress, ...)
```

## The two traps, both of which read as reassuring

⭐⭐⭐ **`conclusion: success` on the helper means "the helper executed", never "your run was
rerun."** The only valid instrument is `run_attempt` on *your own* run.

⭐⭐⭐ **`attempt=1` after many helper firings IS the starvation signature** — not evidence of
a broken helper. Both surfaces look healthy while nothing happens.

## Why it's worse than a stall

The workflow's windows are `--max-yield-hours 12` and `--lookback-hours 16`. Past 16 hours a
run **falls out of lookback and will never be rerun by anything.** One run measured here was
3 days old — permanently stranded, with a green-looking helper history behind it.

⇒ **A yield is terminal-until-a-ready-flip or until a fresh head re-arms CI.** Never set a
horizon whose resume condition is the aging force-run; it fires into an empty window.

## The general rule

**When a doc asserts an automatic recovery, the recovery is a claim to verify, not a fact to
inherit.** The supervisor skill's own text ("a dedicated retry workflow reruns yielded runs
automatically, so show but never act") propagated an unverified automation promise into a
standing instruction, and 16 chains sat behind it. **Read the helper's log, not its
conclusion; measure the effect on the target, not the runner.**

## Recovery that actually works

Merging `master` clears `BEHIND` **and** re-arms CI on a fresh head — the one path that does
not depend on the starved helper. A related distinction the fixer surfaced: **rebase and
merge both fix `BEHIND`, but only merge is publishable without a force-push.** Check
publishability *before* spending a build validating the variant you cannot push.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786106456042-a-helper-reporting-success-means-the-helper-ran-no.md`_
