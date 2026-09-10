---
name: feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal
description: "A 2nd 429 on the same chain is a question about the FLEET, not the chain — sample siblings before re-dispatching a 3rd time. Measured 2026-08-05: 429s in 6/6 sampled triager sessions, bursting at 19:08 and 19:37, after 52 sessions were created in 5 minutes. Re-dispatch #3 would have added load to the thing that was failing."
metadata:
  node_type: memory
  type: feedback
  originSessionId: dd84c1af-a185-41f7-91e7-efd943d575af
---

# A repeated turn error is a FLEET signal, not a chain signal

[[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]] tells you what to do with **one**
turn error: check the artifact, then re-drive or don't. It is silent on the **second** one, and I
nearly applied it a third time by reflex.

**Measured on slang#8373 (2026-08-05).** Dispatch → 429 at 19:08 → re-dispatch → ack at 19:13 →
429 at 19:37. Before re-dispatching again I sampled sibling sessions:

- **6 of 6** sampled `slang-triager` sessions carried 1–3 `429` rows. Other groups too
  (`slang-pr-approver`, `slang-reviewer`).
- The errors **cluster in bursts**: 10 at 19:08, 12 at 19:37 — not spread out.
- Cause was visible in session creation: **52 sessions created in 5 minutes** (21 at 18:40, 12 at
  18:41, 13 at 18:42, 5 at 18:43, 1 at 18:45), ~94 containers running fleet-wide.

⇒ ⭐⭐⭐ **The 429 was provider-side rate limiting from a large concurrent fan-out. It had nothing
to do with issue 8373.** A third dispatch would have bought a third 429 *and added load to the
saturated resource*. **The retry that feels like diligence is the one making it worse.**

⭐⭐ **The discriminating question is "is this chain special?", and one command answers it:** sample
N sibling sessions for the same error. Same error everywhere ⇒ infrastructure, stop retrying, tell
the operator. Only this chain ⇒ chain-specific, the single-error rule applies.

## What I did instead, and why it was better than waiting

The repro check needed **no build** — a prebuilt `slangc` was on disk. So I ran it **inline** and
answered the maintainer directly (~20 min after the second 429), rather than nursing the handoff.

⭐⭐ **Before escalating "blocked on a rate-limited peer", ask whether the peer was load-bearing
for THIS task.** Delegation was right at dispatch time (I expected a build); it stopped being right
once I knew a binary existed. **The reason for a routing decision can expire while the routing
decision persists.** A blocked delegate is not automatically a blocked task.

⚠️ Scope honestly: this works when the deliverable is *measurable inline*. It does not license
pulling a real build or a multi-hour fix in-context.

## Instrument trap hit while measuring this

⛔ Three different `ncl sessions list --agent-group <X>` filters returned **identical 200s**.
`--agent-group` **does not exist**; the real flag is **`--agent-group-id`**, and `ncl` accepts
unknown flags with exit 0 and a full unfiltered result. `200` was also just the default page cap.
Already recorded in [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] — **I re-derived
it from scratch instead of reading my own note first.**

⭐⭐ **Identical numbers from filters that should differ = the filter isn't applied.** Cheapest
possible tell, and it fires before any reasoning is built on the number. The decisive control (from
that memory) is a **nonexistent id**: `--agent-group-id ag-0000000000000-zzzzzz` → **0 rows**
confirms the real flag filters; the fake flag returns everything. Raise `--limit` until the count
stops growing (200 → 417 → stable at `--limit 20000`: 2289 rows, 94 running).

Related: [[feedback_control_the_instrument_not_the_reasoning]],
[[project_8373_std430_cbuffer_parser_gate]].
