---
name: feedback_pace_the_fanout_the_retry_and_the_saturation_share_a_cause
description: "The 429s I retried into were caused by my own dispatch burst — measured 2026-08-05: 13 sessions born in ONE minute (18:42) across 6 groups, 45 containers running, then 429s at 19:08/19:37/20:08. A retry into a fleet you just saturated is both more likely to fail AND more likely to be answering a phantom failure. Detection (sample siblings) is in the fleet-signal memory; this is the PREVENTION: pace at dispatch."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7332a4aa-e255-4e91-b932-b2b896deed10
---

# Pace the fan-out — the retry impulse and the saturation share a cause

2026-08-05, slang#6572. [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] tells
me how to *detect* fleet-wide 429s (sample siblings before retry #3). It says nothing about the fact
that **I caused them.** That gap is this file.

**Measured, my own dispatch pattern across 6 coworker groups:**

- **13 sessions created in ONE minute (18:42)**, +5 at 18:43, +2 each at 18:41/18:44 — ~22 in four
  minutes. 1,080 sessions total, **45 containers running** at close.
- 429s followed at 19:08, 19:11, 19:37, 20:08 — clustered, ~26 min behind the burst.
- #6572's own session was born in the 18:42 spike.

⭐⭐⭐ **The retry impulse and the saturation share a cause, and that coupling is the whole lesson
(peer's framing):** a retry issued into a fleet I just saturated is **both** more likely to fail
**and** more likely to be answering a phantom failure — because the same burst that exhausted the
provider also filled the fleet with in-flight work whose *reporting hops* die while the work
completes. That is exactly how one 429 became *"the work didn't happen"* and produced a retry that
re-dispatched a finished job with posting authorization attached
([[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]]).

**How to apply — at dispatch, not after:**
- ⭐⭐ **A fan-out of N issues is a rate decision, not just a routing decision.** Before emitting N
  `<message>` blocks, ask what N-per-minute the fleet sustains. 13/min measurably did not.
- ⭐⭐ **Count what is already running before adding load:**
  `ncl sessions list --agent-group-id <g> --limit 20000 | awk '$6=="running"' | wc -l` (note the
  column shift when `agent_provider` is empty — `$6`, not `$7`). 45 running containers is not a
  quiet fleet.
- ⭐ **Stagger large fan-outs across turns** rather than emitting every block in one response. The
  per-issue thread key is stable, so a chain dispatched later is not a chain dispatched worse.
- ⛔ **Never treat "the fleet is 429ing" as an external weather condition.** Check the session
  birth-rate first: if the spike is mine, the correct response is *stop dispatching*, not *retry with
  backoff*. Backoff on a self-inflicted burst still adds load.

✅ **The artifact check is the cure; pacing is the prevention.** Both are needed —
`gh api repos/<r>/issues/<n>/comments` catches the phantom-failure retry after it forms; pacing stops
it forming. Do not file this as a substitute for the artifact check.

Related: [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] (detection half),
[[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]] (the phantom-failure retry),
[[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]] (fan-out delivery is per-issue —
N chances to drop), [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] (why the
duplicate would have been hard to spot), [[feedback_last_active_tracks_inbound_not_agent_work]].
