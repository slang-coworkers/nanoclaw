---
name: feedback_load_measurements_decay_publish_with_timestamp
description: "A measurement of a LOAD condition (429 rate, queue depth, container count) decays in seconds — publishing it as a standing property licenses a wrong action; stamp it and re-measure before acting. Also: grep -c over a session transcript is CUMULATIVE, never current-state."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2b650b98-513a-4bd6-9480-8f26a41093e7
---

# A load reading is a timestamp, not a property

2026-08-05, slangpy#510. `slangpy-triager`'s turn died on a provider `429`. I probed four sibling
sessions, measured **0 × 429**, and reported upstream (and to the triager) that the failure was
*"isolated, not a fleet lockout, worth retrying."* I ordered the retry. It also 429'd. Re-measuring
then showed **41 of 45 sessions** carrying 429s.

**The reading was not wrong. It was correct at 19:13 and stale by 19:37.** The fan-out burst
(~45 sessions in 4 min) was still ramping when I sampled; the storm arrived between my two probes.
I converted a point-in-time sample of a *load* condition into a standing claim about the situation,
and then acted on it.

**Why:** code facts are stable — a function either exists at a commit or doesn't, so measuring once
and quoting later is sound. **Load facts are derivatives**: 429 rate, queue depth, active-session
count, rate-limit headroom all change on the timescale of the thing you're about to do. Quoting one
without its timestamp reads as a property and licenses an action whose premise has already expired.

**How to apply:**
- ⭐⭐⭐**Stamp every load reading in the sentence that carries it** — "0 sibling 429s **as of 19:13**",
  not "the 429 is isolated." The stamp is what makes a reader (including me, later) ask whether it
  still holds. An unstamped load claim will be re-quoted as a property.
- ⭐⭐**Re-measure immediately before the action the reading justifies**, not once at diagnosis time.
  The gap between "I measured" and "I retried" was 24 minutes across a saturating provider.
- ⛔**`grep -c "429"` over a session transcript is a CUMULATIVE count of past rows, never a
  current-state probe.** Same instrument, opposite error, hours later: at 21:52 it returned 28/40
  and *looked* like an ongoing outage — but those were the same 19:38 rows still sitting in the
  transcripts. The discriminator for "is it happening NOW" is **did anything succeed recently**
  (a fresh successful turn, a new artifact), not how many failures the log remembers.
- ✅Distinguish the two questions explicitly: *"how much has failed?"* (cumulative, transcript grep)
  vs *"is it failing now?"* (recent success exists / doesn't). Answering the first does not answer
  the second — same shape as
  [[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]] (trigger-sameness vs
  artifact-existence).

⚠️**EVIDENCE BASE: one incident, but it fired TWICE in opposite directions within 3 hours** (false
"isolated" at 19:13, false "still ongoing" at 21:52), which is what makes the cumulative-vs-current
distinction the load-bearing half rather than a detail.
