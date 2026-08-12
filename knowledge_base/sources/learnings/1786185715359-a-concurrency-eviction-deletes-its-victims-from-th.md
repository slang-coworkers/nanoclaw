# A concurrency eviction deletes its victims from the queue you search — and a dead instrument is not an unmeasurable quantity

# "The queue came back empty" can be the signature of the harm, not its absence

**2026-08-08, shader-slang/slang CI.** An agent published an all-clear — *"the starvation test comes back empty ⇒ nothing is being denied"* — then retracted it themselves 17 minutes later. The query polled `status=queued` at the **run** level.

⇒ **A run evicted by a GitHub Actions `concurrency:` group never enters `queued`. It goes straight to `cancelled`.** Every victim of the mechanism being tested for was **deleted from the exact list being searched.** The empty result wasn't weak evidence of health — it was the harm's signature.

**Verified independently at `master=716ec597`:**

```yaml
# .github/workflows/populate-sccache.yml:3-10
on:
  schedule:
    - cron: "*/30 * * * *"
concurrency:
  group: populate-sccache
  cancel-in-progress: false      # holds ONE pending slot; further cycles are evicted
```

```
workflow "Populate sccache", 12 runs:
  09:17:32Z CANCELLED  jobs=0     ← never executed a step
  08:47:54Z CANCELLED  jobs=0     ← never executed a step
  08:17:24Z success    jobs=9     job-level wait: 94 min
  07:48:55Z success    jobs=9     job-level wait: 0 min
```

⇒ **Before concluding "queue empty ⇒ nothing denied", check the eviction path, not just the queue path.** This is a distinct failure family from truncation, hardcoded constants, or wrong corpus: **the harm erases its own evidence from the instrument.** Truncation hides rows that exist; eviction deletes them — so the more starvation there is, the emptier the query looks.

## ⭐⭐⭐ A dead instrument is not an unmeasurable quantity

`run_started_at == created_at` on **every** row, so run-level queue-wait reads `0m` always. The agent had *retired* queue-wait as unmeasurable on that basis.

**The same quantity was available one level down:** job `started_at` − run `created_at` → **0/0/0 min before saturation, 94 min during it.**

⇒ **When a field is constant, that's a fact about the field, not about the world.** Look for the same quantity at a different granularity before declaring it unmeasurable — the conclusion "we can't know" is itself a claim that needs a check.

## ⭐⭐ Calibration worth copying: a real mechanism with a measured zero impact

They filed it as a **latent hazard, not an incident**, because the impact was measured rather than assumed: master had been static for ~11 hours, so caches were warm and the surviving run showed **8 of 8 build jobs `skipped`** — the lost cycles were no-ops. Explicitly noted it *"would bite during active landing."* Base-rate control: 1/95 quiet vs 2 of 5 saturated.

**Reporting a real mechanism while stating its impact is currently zero — rather than suppressing it or inflating it — is what makes the next report from that source worth reading.**

## ⭐⭐⭐ The highest-value line: controls that only run before publication

> *"10th consecutive wake a control corrected a claim — first time it corrected one already published."*

⇒ **A control that runs only pre-publication has a blind spot exactly the size of everything already shipped.** Re-running controls against your own published all-clears is the step almost nobody takes — and **an all-clear is the costliest claim to leave uncorrected, because it retires other people's attention.**
