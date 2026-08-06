---
name: feedback_absence_of_an_effect_is_not_absence_of_the_actor
description: "I reported \"the retry bot has not fired in 76 min\" from an absence of new CI runs. It had fired 8× and was DECLINING by design — a decline and a no-show produce identical downstream silence. Query the actor's own runs"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 74bd0427-6442-4f24-8daf-b9fa0bb445f8
---

⛔ **MEASURED 2026-08-06, mine, on shader-slang/slang#12375.** I told a fixer:
*"`retry-yielded-bot-ci` has not fired in 76 minutes"* and escalated it as a stalled owner needing
human action. **False.** Under its real workflow name the bot had fired **8 times** in exactly that
window — 00:34, 00:41, 00:44, 00:47, 01:33, 01:36, 01:52, 01:57 — every one `success`. It was alive,
firing every ~3 min, and **deciding not to rerun** because the repo was busy:

```
CI is still active (5 run(s)); not rerunning bot CI.
```

## The error shape
I measured **"no new `CI` workflow run at this head"** and reported **"the retry bot has not fired."**
Those are different propositions, and ⭐⭐⭐ **an actor that runs and declines produces byte-identical
downstream silence to an actor that never ran.** The effect I could see could not distinguish them.
This is the *adjacent source* class — reading something near the answer instead of the thing that
states it — committed in the same message where I corrected someone else for it.

⇒ **To claim an actor did not act, query THE ACTOR'S OWN RUNS**
(`gh run list --workflow <file>`), never the absence of its effects. If the actor logs a decision,
read the decision.

## Companion trap — a wrong workflow name returns STALE DATA, not an error
The fixer first queried `retry-yielded-bot-ci.yml` (the **script** name); the workflow file is
`ci-retry-yielded-bot.yml`. Measured control:

```bash
gh run list --workflow retry-yielded-bot-ci.yml   # WRONG name → rc=0, newest run 2026-06-30
gh run list --workflow ci-retry-yielded-bot.yml   # RIGHT name → 8 runs tonight
```

⭐⭐ **rc=0 with a populated, plausible, five-weeks-stale list.** Same family as
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] — a wrong target yields data rather than
a complaint. Script name ≠ workflow filename; confirm against `.github/workflows/`.

## What the mechanism actually guarantees (and my second wrong conclusion)
I then framed it as a *race* against a candidate-aging window. Also wrong — **the aging IS the
escalation.** `extras/ci/retry-yielded-bot-ci.py` + `.github/workflows/ci-retry-yielded-bot.yml`:
`--lookback-hours 16` must stay above `wait-for-priority.py --max-yield-hours 12` so that
*"once a run is older than its `--max-yield-hours` it **escalates and succeeds**, so it stops being a
candidate."* So a yielded run either gets rerun when the repo goes quiet, or escalates to full
priority at ~12h. **Bounded, self-healing — no human action owed for the rerun.**

✅ **Gap closed in the implementation (fixer read it after I flagged the hop).**
`wait-for-priority.py:127-134` `--max-yield-hours` float default `12.0`; `:176-183`
`escalated = yielded and self_age_hours >= args.max_yield_hours`, then `if escalated: yielded = False`
— it proceeds despite higher-priority CI; `:65` age comes from `created_at` and "stays fixed across
reruns"; `ci.yml:109` passes `--max-yield-hours 12`, default not overridden. **Real executed code, real
ceiling.** ⭐ *I had labeled it comment-asserted rather than presenting it as verified — labeling the hop
is what got it closed.*

⚠️ **My figure was the wrong one of two.** I said "~12h post-00:31Z ⇒ ≈12:31Z". There are **two**
candidates at that head and the clock anchors on `created_at`, so the **first** escalation is
`31059303498` (created 00:18:55Z) at **12:18:55Z**; `31059962714` (00:31:14Z) at 12:31:14Z. I had both
runs in my own sweep and anchored on the newer without noticing the older was equally a candidate.
⇒ **With multiple candidates, the binding deadline is the EARLIEST horizon, not the one you happened to
be looking at.**

## The real defect underneath (fixer's find, quote-verified at `retry-yielded-bot-ci.py:3-11`)
*"Only the bot's workflow_dispatch (draft-testing) runs can yield; its ready-for-review PRs run at
full priority and never need a rerun."* That assumption fails when the **ready-flip postdates the last
dispatch** — jkwak flipped ready at 01:35Z, an hour after the 00:31Z dispatch, so **no `pull_request`
run ever fired at full priority** and the yielded-dispatch rerun is the *only* path to builds.
Consequence: an APPROVED, `mergeStateStatus: CLEAN` PR with **0 non-skipped build/test jobs** at head.

⇒ ⭐⭐ **A watcher's ceiling must match the mechanism's deadline.** A 60-min watcher on this reports
"nothing happened" as alarming when the designed horizon is ~12h — the ceiling manufactures a false
signal. Set the ceiling from the mechanism you measured, not from impatience.
