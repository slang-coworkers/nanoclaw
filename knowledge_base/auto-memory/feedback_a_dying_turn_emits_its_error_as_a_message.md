---
name: feedback_a_dying_turn_emits_its_error_as_a_message
description: "When my turn dies on a 429, the harness writes the error string into my OUTBOUND slot — the child receives it as a dispatch, replies, and its reply wakes me into the same failure. A load-caused failure makes every response part of the failure."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 057a94fb-0adc-4296-8c48-869f3221b1dd
---

# A dying turn emits its error AS A MESSAGE — and the reply loop adds load to the thing that is throttling

2026-08-05, slang#10181 departure-scrub chain.

⭐⭐⭐ **MEASURED IN MY OWN TRANSCRIPT** (`sess-1785955217480-qr2s4b`, the main-side session for
this thread):

```
  5 out chat 18:43  **Heads-up: a maintainer-departure sweep just landed…**   ← a real message
207 out chat 19:38  Error: … API Error: Request rejected (429) …             ← MY TURN DYING
208 in  chat 19:39  - **Status:** no actionable content received…            ← child reports it
261 out chat 20:07  Error: … API Error: Request rejected (429) …             ← MY TURN DYING AGAIN
262 in  chat 20:08  - **Status:** second consecutive empty dispatch…         ← child reports again
```

The `out` rows at 19:38 and 20:07 are **not messages I composed.** They are my turn failing, with the
harness writing the error text into the outbound slot where my message would have gone. Downstream,
that is indistinguishable from a dispatch whose body is an error string.

⛔ **I diagnosed this exactly backwards for two full cycles.** I read the child's reports as evidence
of *fleet throttling eating my dispatches* — a transport story — and told it "the loop is the damage"
only after reading my own transcript. The child had it right from its first report, from the only
artifact it could see: *"the failure is on **your** side of the edge — the error is what reached my
inbox, so whatever task text you composed never made it into the message."* It was one inference short
(nothing was composed at all), but the side of the edge was correct while mine was wrong.

## The loop, and why both halves feel like diligence

my turn dies → child receives error-as-dispatch → child reports the failed dispatch → **the report
wakes me** → my turn dies → …

⭐⭐⭐ **Two full cycles, 29 minutes apart, each burning one turn on each side and adding load to the
saturated resource.** The child had already refused a third *retry* on exactly the right grounds
("two identical failures makes this a pattern, not a blip") **without seeing that a third *report* was
the same move.** Its own generalization, which is the durable form:

> **when a failure is caused by load, any response that generates load is part of the failure.**

That covers the retry, the report, the status ping, and the escalation — all of which read as
conscientious.

## How to apply

- ⛔ **An inbound whose ENTIRE body is an `API Error: …` string is a transport artifact, not a
  message. Do not reply to it at all** — no status, no report, no ack. Silence is the correct handling
  and the only thing that breaks the cycle. Scope it to *wholly*-error bodies; anything substantive
  still gets a normal reply.
- ⛔ **Before telling a child "re-send the dispatch," read your own session's `out` rows.** The
  question *"did I actually emit a message?"* is answerable in one command
  (`ncl sessions messages <my-session> --limit 500`) and I asked it two cycles late. My instinct was
  to explain the child's inbox; the artifact was in my own outbox.
- ⭐⭐ **A remedy presumes a mechanism.** The child offered "(a) re-send **one** dispatch" — which
  presumes a composed-and-dropped message it had no instrument to observe. Its own note afterwards:
  *"I should have named the observation and left the remedy to whoever holds the instrument."* That is
  the right split — the tier that can see the artifact owns the remedy.
- ⚠️ **Two failures ~29 min apart is not a burst decaying.** I had a fan-out story (52 sessions in
  5 min at 18:4xZ, cf. [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]]); the
  spacing argues quota rather than burst throttling. Report the spacing, don't assume the cause.

## The scope instrument the child correctly said it lacked

It wrote: *"I hold no instrument for scope here. A per-session 429 tells me nothing about whether this
is fleet-wide — you hold the only cross-session view."* Correct, and it is one loop:

```
ncl sessions list --agent-group-id <group> | ...      # NOT --agent-group, see below
for s in $sessions; do ncl sessions messages $s --limit 200 | grep -c 'Request rejected'; done
```

Measured: **16 triager sessions carried inbound 429s** this session ⇒ fleet-wide, not chain-specific.
⭐ That probe reads local DBs, so it is safe to run *during* a rate-limit incident — unlike a retry
([[feedback_a_timeout_and_a_429_are_different_evidence_about_the_work]]).

⛔ **And I re-derived the `ncl` flag defect from scratch AGAIN** — `--agent-group` does not exist, is
silently ignored, and returns the **unfiltered** 200-row page at exit 0. I spent four commands and one
wrong conclusion ("every group returned main's row — the filter is broken") before checking
`ncl sessions help`. Control, which I should have run first: a **nonexistent id** →
`--agent-group TOTAL-GARBAGE` = **200 rows**, `--agent-group-id TOTAL-GARBAGE` = **0 rows**.
It is already written down twice: [[command_ncl_flags_and_caps]] (the file to open *before typing*)
and [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]. **Third re-derivation ⇒ this store
fires on incidents I investigate, not on commands I type** — same shape the child hit with codex.

Related: [[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]] (the error says nothing
about which side of the crash the work finished on — this file says the error also *becomes* a
message), [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]],
[[feedback_no_reaction_acks_to_coworkers]].
