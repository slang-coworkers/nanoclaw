---
title: "Concurrency-group eviction hides starvation from queue polls (and job started_at is the working queue-wait instrument)"
type: learning
topic: misc
source: learnings/1786185398615-concurrency-group-eviction-hides-starvation-from-q.md
---

# Concurrency-group eviction hides starvation from queue polls (and job started_at is the working queue-wait instrument)

## The bug in the method

I published "the starvation test comes back empty ⇒ nothing is being denied" during a GitHub Actions saturation event, then had to **retract it**. The test polled repo-wide `status=queued` at the **run** level.

**A run evicted by a `concurrency:` group never reaches `queued`.** It goes straight to `cancelled`. So the victims were deleted from the exact list I was searching. Polling the queue for queue-eviction victims cannot work, no matter how carefully you page it.

This is a distinct failure family from the usual metric traps (page truncation, constants in the population, wrong corpus). There the instrument is miscalibrated; here it is *correct* and the harm removes the rows from its field of view.

**Rule:** before trusting a scan for victims of mechanism M, ask *"what does a victim look like AFTER M has acted on it?"* If M mutates the field you filter on, filter on something M doesn't touch.

## Concretely, for GitHub Actions

- Count `conclusion=cancelled` and compare against a **base rate** over a wide window. Measured on `shader-slang/slang`: cancels were **1/95** outside the saturation window vs **2 of 5** inside it.
- `GET /actions/runs/<id>/jobs` → **`total_count: 0`** proves the run never executed a single step (evicted before start), as opposed to a run cancelled mid-flight.
- Read the workflow's `concurrency:` block. `cancel-in-progress: false` keeps the *running* job but holds only **one pending slot** — so under slow cycles each new scheduled run evicts the previously-pending one. A `*/30` cron behind a 94-min queue wait silently loses cycles.

## Bonus: a dead instrument is not an unmeasurable quantity

I had earlier concluded "no queue-wait instrument exists here" because `run_started_at == created_at` on all 100 rows. Wrong generalization — the working instrument was one level down:

**queue wait = job `started_at` − run `created_at`**

Same workflow, same day: **0, 0, 0 min** before saturation → **94 min** during → **5 min** → **1 min** on recovery. Clean discriminator. Drop the *instrument*, not the *question*.

## And: report both halves

The 94-min starvation was real **and** its impact was zero — master hadn't landed a commit in 7.4 h, so all 8 sccache caches existed and the surviving run showed **8/8 build jobs `skipped`**; the lost cycles were no-ops regardless. Reporting only the 94 min is alarmist; reporting only "no impact" buries a latent defect that would bite the moment master is active during a weekly matrix. Say both.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786185398615-concurrency-group-eviction-hides-starvation-from-q.md`_
