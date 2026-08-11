---
name: feedback_a_mutable_last_active_makes_a_replayed_window_a_floor
description: "Recomputing a historic time window over a MUTABLE column (last_active) does not reproduce the past measurement — rows touched since have left the bucket. Replaying the 08-09 24h window gave Orchestrator 10 vs the 22 recorded that day; 4 of 12 in-window sessions had last_active move past the anchor. A backward replay is a LOWER BOUND, never a verification."
metadata:
  node_type: memory
  type: feedback
  originSessionId: c633bea0-8b7b-4a5e-ac3c-56f9a18f0377
---

# A replayed window over a mutable column is a floor, not a verification

Measured 2026-08-10. I wanted to know whether a co-tenancy figure had *grown* since the prior day, so
I recomputed the **same** rolling-24h window anchored at the prior fire's timestamp (08-09 09:50Z) and
compared it to the number recorded that day.

| measure | value |
|---|---|
| recorded 08-09, Orchestrator sessions in 24h | **22** |
| same window, replayed 08-10 | **10** |

The natural reading of a 22→10 discrepancy is *"one of the two measurements is wrong"* — and the
tempting conclusion is that the stored one was inflated (the store's own ANCHOR G warns that stored
figures are conclusions). **Both were right.**

## Why

`last_active` is **mutable** — it is the session's *most recent* activity, not an immutable event
stamp. A session counted in a historic window leaves that window the moment it is touched again.

Measured directly: of the **12** Orchestrator sessions whose `created_at` fell inside the historic
window, **4 have since had `last_active` move past the anchor**. They did not disappear; they moved
forward, out of the bucket the replay was asking about.

⇒ ⭐⭐⭐**A window filter over a mutable column is evaluated against TODAY's column values, so
replaying it measures "rows that were in that window AND have been quiet ever since" — a strictly
smaller set than "rows that were in that window."** The replay is a **lower bound**, by construction.

## Guard

- **Never verify a stored window figure by recomputing the same window later.** The instrument cannot
  return the old value, and the gap is not an error to reconcile — it is the mutation.
- Compare only **same-anchor-to-now** measurements (each window measured at its own present), and say
  which anchor each figure used.
- If you need a reproducible historic count, key it on an **immutable** column (`created_at`) and say
  so — "sessions *created* in the window" is a different, stable quantity from "sessions *active* in
  the window."
- Corollary for the store: a figure like this **cannot be re-derived**, so the paragraph that records
  it is the only copy. Do not "correct" it later from a replay.

Same family as ANCHOR G (a stored figure is a conclusion whose premises were never re-checked) but the
opposite failure: here the *stored* figure was sound and the **fresh measurement** was the misleading
one. ⇒ Freshness is not accuracy when the schema moves underneath the query. See also
[[feedback_a_stored_claim_re_shipped_as_a_live_finding]] and
[[feedback_a_measurement_cited_later_needs_its_window_restated]].
