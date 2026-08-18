---
title: "A repo-wide count from YOUR action log cannot prove 'nobody ever did X'"
type: learning
topic: misc
source: learnings/1785980000299-a-repo-wide-count-from-your-action-log-cannot-prov.md
---

# A repo-wide count from YOUR action log cannot prove "nobody ever did X"

## The near-miss

2026-08-06, #12145. I needed to know whether re-running a flaky CI job actually goes green — load-bearing, because if retries usually fail again then "add retry logic" is theatre and quarantine is the honest fix. I measured it directly: 4 of 5 failed→next-attempt transitions recovered.

Meanwhile my parent concluded the sample **probably didn't exist** and was drafting advice that the question was unresolvable. Their basis: their store said "only 5 reruns fired in that window." That figure came from **my `rerun-log.jsonl`** — i.e. reruns *I issued* — and was used to claim *nothing had ever been rerun by anyone*. The recoveries were `event=pull_request` reruns on PR branches, a population their merge-queue-eviction analysis never indexed. They had the run IDs the whole time and never made the one API call that settles it.

Had that advice arrived minutes earlier it would have talked me out of a correct, completed measurement.

## The rules

1. **An agent's own action log is a record of its decisions, never a census of the world.** `rerun-log.jsonl` answers "what did I do?" It cannot answer "what happened?" Other actors write to the same repo — humans, `ci-retry-yielded-bot.yml`, `retry-on-gpu-failure`. Related: `run_attempt-1` is not a proxy for my own rerun count, same root cause.
2. **Before declaring a sample nonexistent, make the one call that would find it.** "The data probably isn't there" is an [inquiry-closing phrase](feedback_inquiry_closing_phrases_need_a_measurement.md) and needs a measurement, not a plausibility argument — especially when you are already holding the identifiers.
3. **Name the population your figure was computed over, then check the question is asking about that same population.** Here: eviction analysis indexes `merge_group`; the recoveries were `pull_request`. Both real, different populations, and the mismatch is invisible if you only carry the number forward.
4. **A "probably unmeasurable" verdict aimed at someone mid-measurement is high-cost.** It doesn't just fail to help — it can retract work that already succeeded. Ask "are they already measuring this?" before sending a discouraging analysis.

## Also worth keeping

Two independent verifications the parent ran that I'd have accepted on weaker evidence:
- **Membership in `needs` proves ordering, not gating.** For "does job X block merge?" you need the consumer's failure behavior too — `ci.yml:708`'s `exit 1` over the generic `needs` JSON is the half that proves it.
- **A run-level "recovered" needs the signature, not just `conclusion=success`.** They log-confirmed `GBufferRTTexGrads` / `3221225477` on two of the four so the recovery couldn't be a *different* Falcor red that happened to pass.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785980000299-a-repo-wide-count-from-your-action-log-cannot-prov.md`_
