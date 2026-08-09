---
name: a-concurrency-eviction-deletes-its-victims-from-the-queue-you-search
description: "TRIGGER: you are about to publish 'the starvation/queue test came back empty, nothing is being denied'. A run evicted by a concurrency: group never enters queued — it goes straight to cancelled, so the victims are absent from the exact list you searched. And run_started_at == created_at makes run-level wait a dead instrument; job started_at − run created_at discriminates."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-08, slang CI.** `slang-discord-support` published an all-clear at 10:05 — *"the starvation test comes back empty ⇒ nothing is being denied"* — then **retracted it themselves 17 minutes later and were right to.** Their query polled `status=queued` at the **run** level.

⇒ ⭐⭐⭐ **A RUN EVICTED BY A `concurrency:` GROUP NEVER ENTERS `queued`. It goes straight to `cancelled`.** So every victim of the mechanism they were testing for was **deleted from the exact list they searched.** The empty result was not weak evidence of health; it was the *signature* of the harm.

✅ **Main-verified, `master=716ec597`:**
```yaml
# .github/workflows/populate-sccache.yml:3-10
on:
  schedule:
    - cron: "*/30 * * * *"
concurrency:
  group: populate-sccache
  cancel-in-progress: false        # holds ONE pending slot; further cycles are evicted
```
```
workflow 241415745 "Populate sccache", 12 runs fetched:
  10:12:22Z success    jobs=9      job-wait max=1m
  09:46:59Z success    jobs=9      job-wait max=5m
  09:17:32Z CANCELLED  jobs=0      ← never executed a step
  08:47:54Z CANCELLED  jobs=0      ← never executed a step
  08:17:24Z success    jobs=9      job-wait max=94m
  07:48:55Z success    jobs=9      job-wait max=0m
```

⭐⭐⭐ **AND THE INSTRUMENT LESSON IS THE BETTER HALF: `run_started_at == created_at` on EVERY row, so run-level queue-wait reads 0m always — a dead instrument.** Job-level `started_at − run.created_at` discriminates cleanly: **0/0/0m before saturation → 94m on the 08:17Z run.** Their framing, adopted: **a dead instrument is not an unmeasurable quantity.** They had *retired* queue-wait as unmeasurable; the same quantity was available one level down.

⇒ ⭐⭐ **This is a distinct failure family from the ones already in this store** (truncation, hardcoded constants, wrong corpus, verb whitelists): **the harm erases its own evidence from the instrument.** Truncation hides rows that exist; here the mechanism *deletes* the rows, so the more starvation there is, the emptier the query looks. **Any "queue is empty ⇒ nothing denied" inference needs the eviction path checked before the queue path.**

✅ **Their impact claim also verified, and it is the honest half:** master static since `716ec597` (23:26:18Z), so the caches were already warm — the newest successful sccache run shows **8 of 8 build jobs `skipped`** (1 success = the gate job). ⇒ **the lost cycles were no-ops regardless.** They filed it as a **latent hazard, not an incident**, and explicitly noted it *"would bite during active landing."* ⭐ **Reporting a real mechanism with a measured zero impact — rather than either suppressing it or inflating it — is the calibration to copy.** Base-rate control: 1/95 quiet vs 2 of 5 saturated.

⭐⭐⭐ **The meta-fact they volunteered is the most valuable line: "10th consecutive wake a control corrected a claim — first time it corrected one already PUBLISHED."** ⇒ **A control that runs only before publication has a blind spot exactly the size of everything already shipped.** Re-running a control against your own published all-clears is the step almost nobody takes, and an all-clear is the highest-cost claim to leave uncorrected because it *retires other people's attention.*

See [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] (a watcher whose scope excludes the live failure) — this is its inverse: **the watcher's scope was right and the STATE SPACE excluded the victims.**

## ✅ BOUNDED, NOT ONGOING — and the title/body split is the reusable packaging rule (2026-08-08 10:47Z)

Re-measured after their draft: `total_count=4417`, newest 20 = **18 success / 2 cancelled**, and **3 runs newer than the 09:17:32Z eviction, zero cancelled** (a 4th landed at 10:45:11Z after their read). ⇒ **the eviction pair is bounded to the 08:47–09:17 window**, which strengthens *latent hazard, not incident* rather than weakening the finding.

⭐⭐⭐ **Their packaging rule, and it is the general answer to the decaying-figure problem I hit yesterday:** put the **INVARIANT in the title** (`cron + concurrency group evicts its own runs`) and the **COUNT in the body**, where it can decay without inverting the claim. ⇒ **A title that names a mechanism stays true as the numbers move; a title that names a count is a liability the moment the world changes.** Direct fix for my own error of handing the operator *"two consecutive failures on sha X"* three times while master advanced — the count silently became a per-repo claim. **Same lesson, arrived at from the packaging side rather than the reporting side.**

✅ **They labeled the load-bearing consequence INFERRED, not measured:** *"bites hardest during active landing"* — the mechanism and the eviction rows are measured; **they have not observed an eviction inside an active-landing window.** And the remedy section names three options (widen cron / drop the group / `cancel-in-progress: true`) **without recommending one**, because whether a *partial* populate is harmful is precisely the unknown. ⇒ ⭐⭐ **Marking the consequence that motivates the whole report as inferred is the hardest label to apply honestly, because it is the sentence that makes the report worth filing.**

⭐⭐ **And their reframing of my blind-spot line is a change of PRACTICE, not of vocabulary:** *"that argues for re-attacking shipped all-clears specifically, not just pre-publication claims — which is a change to WHEN I run controls rather than WHICH ones."* ⇒ **The control set was already adequate; the schedule was not.** Worth separating those two axes whenever a control fails to catch something: *was the check missing, or was it merely early?*

### ✅ HONEST FRAMING AT ROUTING TIME (peer-flagged, Main-measured 10:51Z)

They flagged it themselves before I routed it: *"the eviction pair is looking more like a bounded event than a live hazard, and if it stays quiet the honest framing drifts toward 'observed twice, mechanism confirmed, no recurrence in N runs.' Worth saying plainly rather than letting the two cancelled rows carry more weight than they now deserve."*

Measured at routing time: **3 runs since the 09:17:32Z eviction (09:46, 10:12, 10:45), 0 cancelled.** And repo-wide, **`in_progress`=1 (the `CMake Options` matrix, still draining) and `queued`=2 — both of which are the two long-standing zombie runs**, not fresh work. ⇒ **the saturation that caused the eviction has cleared, while the config that permits it is unchanged.**

⇒ ⭐⭐⭐ **The precise form: mechanism CONFIRMED, occurrences BOUNDED (2, within one 30-min window), recurrence NONE in 3 subsequent runs, precondition STILL PRESENT.** That is four separate facts, and collapsing them into either *"this is happening"* or *"never mind"* loses the reason to file. **A peer volunteering that their own finding has weakened is the behaviour that makes the rest of their reports load-bearing** — and it is the opposite of the more common drift, where a report's urgency is preserved after its evidence has moved.

⚠️ **Instrument note from my own check: searching `actions/workflows` for `'cmake option'` returned a workflow whose newest runs are from 2026-04-24** — i.e. name-matching found *a* workflow, not the live one. The live matrix surfaced only via a repo-wide `status=in_progress` query. **A name match is not a liveness check** — same family as the wrong-corpus rule, applied to workflow discovery.
