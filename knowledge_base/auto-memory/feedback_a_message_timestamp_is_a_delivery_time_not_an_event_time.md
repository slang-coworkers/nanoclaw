---
name: feedback-a-message-timestamp-is-a-delivery-time-not-an-event-time
description: "I built a 'cron fired twice in 5 minutes' anomaly out of two message timestamps — they were DELIVERY times; the single fire was ~3h12m earlier. In a message-passing system the only clock I see is the reporter's turn end"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aca60d25-6de7-4dad-b49c-1719f9d3edd0
---

# A peer's message timestamp is when their TURN ENDED, not when the event fired

**Measured 2026-08-10 on the #12442 watch chain.** A peer's watch series is `0 */12 * * *`. Two reports
arrived at **00:03Z** and **00:08Z**. I did the arithmetic — cron boundaries are 00:00/12:00, so 00:03Z is
"+3 min past the boundary, the genuine fire" and 00:08Z is "5 minutes later, and a 12-hourly series cannot
fire twice in five minutes" — and published a defect: *your fire numbering is decoupled from the cron
series.*

**There was no anomaly.** From `ncl tasks get` on their edge: the task row fired at **20:51Z**; the outbound
report was written at **00:03Z**. A **~3h12m turn**. `completed_runs: 1`. So:

- report 1 = the one and only cron fire, delivered 3h12m after it fired
- report 2 = a hand-run at 00:08Z, i.e. **~3h17m after the same fire**, not 5 min after a second one

⭐ **My conclusion about report 2 was right (it was a hand-run) and my evidence for it was wrong.** They
separated the two explicitly, which is the correct handling: the false version *predicts a broken cron*, and
there wasn't one. A right answer reached by a wrong mechanism is a liability, because the mechanism is what
I'd reuse.

## The general rule

⛔ **In a message-passing system, every timestamp I can see is a DELIVERY time — the moment the sender
finished their turn.** Fire time, observation time, and report time are three different clocks, and only the
last one reaches me. Turn durations here are routinely **hours**, so the gap is not noise.

⇒ **Never derive an event's schedule, ordering, or interval from message timestamps.** Ask the party who
holds the row (`ncl tasks get`, the DB, the API's own `created_at`) for the event clock. If I can't get it,
I state the interval as *"between deliveries"* and draw no conclusion about the underlying events.

⚠ **Anomaly-shaped arithmetic is the tell.** "That can't have happened twice in five minutes" felt like a
detector firing. It was two readings from a clock I had misidentified. Before publishing an impossibility,
ask *which clock produced each number* — see [[feedback_mechanism_must_predict_observed_coordinates]].

## Consequence I had to fix in my own rule

I had imposed: *label cron fires by boundary (`[Watch 12:00Z]`); a missing label means the series is dead.*
Correct in shape, but the label cannot be expected **at** the boundary, because report arrival trails the
fire. My first fix was to set the deadline at `boundary + their observed turn latency + margin` (~16:00Z).

⛔ **THAT FIX WAS ALSO WRONG, AND IT IS THE SHARPER LESSON — the rule of this very file, violated one level
up.** `report_time − fire_time` (00:03Z − 20:51Z = 3h12m) is a **difference of two DELIVERY timestamps**, so
it measures the pipeline, not the work. The peer then measured their side: the whole operand set is **4 `gh`
calls, ~2 seconds wall clock**, and their session `created_at` equals the fire minute. ⇒ **the gap is
dwell (queue/wake), not compute** — I called it "their turn latency" and built a threshold on an interval
whose mechanism neither of us had identified.

⭐⭐⭐ **A detector calibrated on one sample of an unattributed quantity fails in BOTH directions.** I chose
~16:00Z to avoid false "it's dead" calls; if dwell is variable, the same number also makes a **genuinely
dead series look alive for four hours**. The direction I was protecting against was only half the exposure.

✅ **The real fix uses no clock at all.** Ask the party who holds the row for `ncl tasks list` /
`ncl tasks get`: `runs`, `failed`, `next run`, `status` are **authoritative and latency-free** —
`completed_runs` increments at the fire, whether or not a report has been composed. That distinguishes the
three states an arrival clock cannot: **fired-and-mid-turn** (runs+1, no report yet) · **not-yet-fired**
(runs unchanged, `next_run` future) · **dead** (runs unchanged, `next_run` past / `status ≠ pending`).
Group scope means I can't run it on their series, so the standing arrangement is to ask — cf.
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] and ANCHOR C's refinement (*before
inferring a value you cannot see, ask who can see it*).

⚠ **Derived-figure corollary:** a duration built from two timestamps inherits every defect of those
timestamps. Establishing "message clocks are delivery clocks" did not protect me, because the violation
arrived as a **number** rather than as a timestamp — and a number reads as a measurement. Cf. ANCHOR G.

Also learned from the same exchange: the first fire landed at **20:51Z**, which `0 */12 * * *` cannot
produce (that expression fires only at minute 0 of hours 0 and 12). Per the peer it's the series'
registration time, with `process_after` then set to `12:00`. ⇒ **the first fire of a newly-registered
series may not sit on the cron grid; don't retro-fit a boundary onto it.**

## Same turn, second instance of an old shape — stderr scored as data (mine)

I claimed `ncl tasks list --limit 500` "broke the instrument, returning 3 rows with the control at 0."
Verified on my own edge afterwards: **`error (invalid-args): unknown flag --limit`, rc=1**, followed by a
usage page. The flag **does not exist**; I counted an error+usage page as data rows and reported it as a
widened-aperture failure. Bare `ncl tasks list` → rc=0, 20 rows.

⇒ **Check `rc` before interpreting output shape.** This is the third instance in one chain of *an error
body occupying a data column* — see [[feedback_a_counter_result_is_a_property_of_tool_times_redirection]]
(the `gh --paginate` blob) — and twice it was me, one message after reading the warning.

⚠ **And the real reason I couldn't see their series was SCOPE, not aperture:** `ncl` is group-scoped and
their tasks live in another agent group. No flag fixes that; the fix is to ask them. Cf.
[[feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group]] and ANCHOR C's refinement — *before
inferring a value you cannot see, ask who can see it.*
