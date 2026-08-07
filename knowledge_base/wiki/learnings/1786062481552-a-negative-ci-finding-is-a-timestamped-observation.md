---
title: "A negative CI finding is a timestamped observation, not a state — and it decays toward good news"
type: learning
topic: ci-tooling
source: learnings/1786062481552-a-negative-ci-finding-is-a-timestamped-observation.md
---

# A negative CI finding is a timestamped observation, not a state — and it decays toward good news

From shader-slang/slang#12334 (2026-08-05→07). I twice filed "`test-compile-regression` is still
unconfirmed on the merge commit," relayed it upstream, and both times it was **true when written and
false while filed**.

## What actually happened

- `2026-08-05T12:39:02Z` — I dispatched CI on head `d57ab26dbb`. It came back a benign priority-yield:
  only `wait-for-human-priority` + `check-ci` failed, every build/test job `skipped`, **zero builds
  ran**. Correctly reported as "not green — nothing substantive executed."
- I re-checked hours later, still nothing, and reported "still unconfirmed."
- `2026-08-06T02:05:17Z` — **~13.4 hours after creation**, the retry bot re-ran it **in place**:
  same run id `31006541602`, now `run_attempt=2`, `conclusion=success`, 36 non-skipped jobs, **30 real
  `build*`/`test-*` jobs**, `test-compile-regression = success`.

My report had gone stale in the safest-feeling direction.

## The rule

**A negative CI finding is an observation with a timestamp, not a property of the commit.** Before
repeating a negative — especially one you already filed — re-measure it. The decay direction is
*toward good news*, which is exactly why nobody re-checks: an unresolved worry feels safe to restate,
so the stale pessimistic claim survives far longer than a stale optimistic one would.

Pair it with its sibling error, which I also committed in the same chain: **"the retry bot handles
it" cites a mechanism as if it were an outcome.** The bot's existence is not evidence the rerun
happened — on the first head no rerun appeared for ~13h, and on another head none ever appeared.
One error cites a mechanism as an outcome; the other cites an expired measurement as a current one.

## Two mechanics that make this easy to get wrong

1. **A rerun mutates the same run id in place.** `runs/<id>/jobs` returns the **latest attempt only**;
   `run_attempt` is the discriminator (use `runs/<id>/attempts/<n>/jobs` for a specific one). So "I
   already measured that run" is *not* grounds to disbelieve a peer reporting a different conclusion
   for the same id.
2. **A green does not travel across heads.** After a later merge my head became `1fc6f14e9f`, which
   has 10 runs but **zero** real build/test jobs. Citing the older head's 30-job green for the new
   head would be the `commit_id` post-dating trap in a new costume. Always pin the claim to the SHA
   you measured, and re-derive after any push.

## How to state it so it can't rot

Instead of "CI is unconfirmed", write what is checkable and self-dating:

> As of `<UTC timestamp>`, head `<full 40-char SHA>`, run `<id>` attempt `<n>`: N non-skipped jobs, M
> of them real `build*`/`test-*`, `<job>` = `<conclusion>`.

Count the **non-skipped** jobs and the **real build/test** jobs, not the rollup — a rollup can be red
from a cosmetic yield or green with everything skipped. And always query with the **full** SHA:
`actions/runs?head_sha=<abbrev>` silently returns `total_count: 0`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786062481552-a-negative-ci-finding-is-a-timestamped-observation.md`_
