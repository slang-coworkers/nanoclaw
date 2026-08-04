---
name: project_8306_8785_triager_session_never_produced_a_turn
description: "slang#8306 + #8785: jkwak-work asked @nv-slang-bot to triage 07-18; 17d silence. Sessions EXIST and are `running` with in=1/out=0 — dispatch landed, turn never happened. 08-04 nudge woke #8306 (out=1 in ~60s) but #8785 STILL out=0 under an identical nudge ⇒ per-session stall, reproduced. Cause UNKNOWN — do not guess."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-04
---

## Verified state (Main, 2026-08-04 00:2xZ, REST + `ncl`)

| issue | title | session | created | in | out |
|---|---|---|---|---|---|
| **#8306** | Embedding core + GLSL binaries inside slang.dll does not appear to work (`Dev Reviewed`, `cmake`) | `sess-1784379813414-45qr7w` | 07-18 13:03 | 2 | **1** ✅ woke |
| **#8785** | Amplification shader and payload (unlabelled) | `sess-1784379251124-qetp85` | 07-18 12:54 | 2 | **0** ❌ still silent |

Both assigned `jkwak-work`; **no bot comment on either issue** (his request is still the last comment). #8306's ask is *"This might be resolved… can you triage this?"* ⇒ a verify-at-HEAD, not a fresh investigation. #8785's original ask (bmillsNV, 2025-10-23) was to write an amplification shader and confirm Slang support; jkwak's follow-up is a bare triage request.

## ❌ CORRECTION 00:26Z — "per-session stall, REPRODUCED" was WRONG. It was LATENCY, and I called it at 60s.

**Triager's report on waking:** *"first nudge did land, turn was already in flight (research agents + repro running) when your second wake arrived, so this is 'turn starts, output comes late', not broken delivery."* Then `out=1` at 00:26 — **~3.5 min after the first nudge**, not never.

**What I actually measured vs what I claimed:**
- Measured: `out=0` on #8785 at ~00:23 and ~00:25, while its twin #8306 had `out=1` by 00:23.
- Claimed: a **reproducible per-session stall**, and filed it as such.
- Truth: #8785's turn was **running the whole time** — it fans out research agents and a repro, so its first outbound is minutes later than #8306's one-line ack. **A slower turn is indistinguishable from a dead one at a 60-second horizon.**

⇒ **`out==0` is only `awaiting_us` once you have exceeded a plausible turn duration.** The rule as I wrote it (*"`out==0 && in>=1` is unconditional"*) is **too strong for a live window** — it is sound for a 17-day-old row and wrong for a 2-minute-old one. **The claim needs a time bound: `out==0` AND no inbound within N minutes**, where N exceeds the agent's worst-case turn (minutes, for an agent that spawns subagents).

⚠️ **And my "reproduced live" was the more damaging error**, because a reproducible bug justifies escalation. I nearly took a platform-bug report to the operator built on a 60-second sample. **Same shape as every non-discriminating-signal error today: my probe could not distinguish the two states I cared about** — slow-turn vs no-turn — and I read the reassuring-to-me interpretation (a clean reproduction) rather than the boring one.

**The 17-day silence remains genuinely unexplained** and must NOT be folded into this correction: a turn taking 3.5 minutes today says nothing about 17 days of nothing between 07-18 and 08-03. Two separate claims — one now refuted, one still open. **Do not let the refutation of the live-stall claim quietly discharge the historical one.**

## (superseded — kept for the arc) The stall looked PER-SESSION and appeared to reproduce

Both sessions received a **byte-identical-shaped supervisor nudge at 00:22:36Z** (seq 4). #8306 produced `out` seq 5 at **00:23** (*"On it — resuming #8306 now…"*). **#8785 produced nothing.** Same agent group (`ag-1780667166418-apezq5`), same messaging group, same `container_status: running`, same `last_active: 2026-08-04 00:22`, identical session records apart from id/thread. ⇒ **not an agent-wide fault, not a routing fault, not the dispatch.** One session wakes, its twin does not.

**The 17-day silence therefore has a live, reproducible instance** — which is far more useful than the historical record, because it can be probed now.

## ⛔ Cause UNKNOWN. Ruled out so far

- **Not a missing dispatch** — sessions exist with the inbound at seq 2. (My first read said "never dispatched"; that was a `ncl sessions list` 200-row truncation artifact — see [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].)
- **Not agent health** — the triager is actively working other threads (39+ sessions; #12181, #12331, #12333 live) and replied on #8306 within ~60s.
- **Not `echo_drop`** — the triager group does show **186 `echo_drop:loop_repeat`** drops (largest on the system, `first_seen` 06-22 → `last_seen` **08-01 06:42**), but those are **triager→Main outbound echoes** and predate today's nudge. **A red herring for this stall**, though the 186 count is worth its own look someday.
- **Not the container** — `running` on both.

⚠️ **The triager cannot diagnose this and correctly refused to try.** Its context is the #12181 chain; those two inbounds are not in its window, and it said so: *"no record, cause unknown"* rather than inventing a mechanism. **That was the right call** — and it correctly named the session layer as *my* instrument, not its. It is proceeding on my relay of the issue content without needing a re-dispatch.

## RESUME

1. **#8306 is live** — triager working it; expect a verify-at-HEAD verdict + 5-bullet.
2. **#8785 needs another wake attempt**, and if a second identical nudge also produces nothing, that is a **platform bug worth escalating to the operator** (a `running` session with a delivered inbound that never yields a turn). Consider `target_session_id`-pinned wake, or `ncl groups restart` scoped to that session.
3. Do **not** re-dispatch #8785 content into a *fresh* session as the first move — that hides the defect instead of fixing it, and loses the reproducible instance.

## ⭐ Standing lessons this produced

- **`out==0 && in>=1` is unconditional `awaiting_us`.** `container_status: running` and a fresh `last_active` **both read healthy on a session that has never spoken** — `last_active` advances on host-side touches, so it measures the maintainer, not the work. **Count outbound rows.**
- **A fresh `last_active` on group X says nothing about thread Y.** Key session lookups on the **thread**, not the group.
- **`ncl sessions list` silently caps at 200 rows** — I concluded "never dispatched" from a truncated list and nearly recorded a false root cause that would have sent the next reader hunting a routing bug that doesn't exist. Pass `--limit 2000`.
- ⭐**A differential test (default vs explicit high limit) proves a cap ENGAGED without knowing its value — but it is ASYMMETRIC: identical output is NO INFORMATION, never a clean bill.** (babysitter's refinement: its own edge returned 14 rows at every limit, which cannot distinguish "no cap" from "cap not engaged.") For *absence* you need a documented default or a positive control like `total_count`.

Related: [[project_coworker_named_edge_dropped_silent_hang]], [[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]].
