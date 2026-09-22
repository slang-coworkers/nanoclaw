---
name: Self-wiring runaway-loop incident (SYSTEMIC, 2026-06)
description: Self-referential a2a wirings (platform_id agent:X:X, src==dst) cause runaway empty-ack self-wake loops, systemic across agents and re-minted on every self-route; the durable fix is a code guard in ensureA2aWiring, still pending. Reactive recipe = sever wiring + `ncl groups restart`. Includes the empty-ack loop decision tree and the diagnostic pitfalls.
type: project
originSessionId: 8e26fb9e-a17d-4359-b915-fc5aadc9dcb0
---

# Self-edge a2a runaway loops

A self-referential a2a messaging group (platform_id `agent:<ag>:<ag>`, source ==
dest) routes an agent's own chat output back into its own inbox → a runaway
empty-message self-wake loop ("Holding." / "No response needed." pings, growing
every ~15–30 s). **Systemic:** essentially every agent has held a self-edge mg, and
they are **re-minted on the next self-route** after any manual deletion.

## Root cause (nanoclaw read-only investigation, branch `sync/upstream-nv-main`)

`ensureA2aWiring()` (`src/modules/agent-to-agent/agent-route.ts`, fresh-delegation
branch) mints the `agent:<ag>:<ag>` mg + `mga` wiring on any **self-targeted
fresh-delegation** a2a (`<message to="<own-name>">`), and the mint runs **BEFORE**
the same-session guard — so the guard drops the self-*delivery* but not the self-edge
*creation*. `wire_agents` (rejects src==dst) and `create_agent` are ruled out. There
is **no GC**: sessions are born `status='active'`, no prod code sets otherwise, and
the sweep wakes by session+inbound.db, never by wiring — so severing a wiring cannot
stop a live looper. (`status='closed'` exists in the enum but is unreachable in prod.)

## Reactive fix recipe (v2, validated end-to-end)

Severing the self-edge *wiring* is necessary but **not sufficient**: a session
already *running* on the self-edge mg keeps re-emitting contentless acks until its
**container** is killed. So:

1. `ncl wirings delete --id <self-edge-wiring>` (admin-approval-gated; surgical —
   an agent messaging itself is never legitimate, legit cross-edges are untouched).
2. `ncl groups restart --id <ag>` — restarts ALL sessions in the group and kills the
   in-process looper. Once the wiring is gone, the fresh container has no inbound
   routing to the self-edge, so it won't resurrect.
3. A short post-restart re-mint watch on the self-edge mg id (Monitor: quiet ≥ 80 s
   ⇒ dead) to confirm.

**`request_restart` ≠ admin group restart:** an agent's own `request_restart` cycles
only its main session, not sibling per-thread session containers, so it does not kill
a looper on a different thread — unless that looper *is* the active session. Only
`ncl groups restart --id <ag>` reliably kills it.

**This is whack-a-mole** — the wiring is re-minted on the next self-route. The
**durable fix (pending operator authorization, platform self-mod):** (A) hoist the
self-target check above the mint / early-return guard in `ensureA2aWiring` when
src==dst (~3–5 lines, bug-fix class); (B) add `closeSession()` +
`ncl sessions close/stop` + sweep self-heal for `agent:X:X` sessions (skip if a
pending `kind='task'` row); (C) one-shot cleanup after (A). Severing the
orchestrator's self-edge is safe for scheduled tasks (they live in the session's own
inbound.db and fire via `wakeContainer`, independent of the mg) but futile.

## Decision tree for ANY empty-ack loop

**FIRST audit `agent:X:X` self-edges:**
`ncl messaging-groups list | grep -oE "agent:[a-z0-9-]+:[a-z0-9-]+" | awk -F: '{if($2==$3)print}'`

- **Self-edge present** → the self-reflection loop above: sever wiring + `ncl groups
  restart` (v2 recipe).
- **Self-edge ABSENT** → it's a **mutual echo**: child emits "." → parent replies
  "Holding." → that reply *wakes* the child → … Each side's content-free ack is the
  other's wake source. **Fix: get ONE party (normally the parent) to emit ZERO
  outbound on content-free pings** — not "Holding.", not a "going silent" notice,
  literally nothing; end turn internal-only. The child's last ping then goes
  unanswered → it idles → its real monitor delivers the terminal report. Loop dies in
  ~1 cycle, **no restart** (a restart would kill in-flight build work). Refinement: a
  stop-directive DOES stick here, but only once it names the parent's own "Holding."
  replies as the wake source.
- A **substantive** double-post (two full workflow passes, two content-bearing GitHub
  comments) is neither — it's the Agent-fork footgun:
  [[feedback_agent_fork_without_subagent_type_reruns_the_workflow]].

## Diagnostic pitfalls (why this is easy to misdiagnose)

- **`last_active` is NOT proof of a live loop** — a running-but-idle container bumps
  it with heartbeats, and `ncl sessions list last_active` is *lagged*. Verify a loop
  via `ncl sessions messages --id <sid>` (actual recent in/out traffic), never
  `last_active` or `container_status`. [[feedback_last_active_tracks_inbound_not_agent_work]].
- **Heavy builds emit frequent `Context compacted (~NNNK tokens)` notices** that look
  like loop churn but are normal — confirm the *suspect* session has recent traffic
  before diagnosing.
- A truncated `ncl sessions list | grep running` can hide a newer running container →
  page the full list before asserting "only running session."

## Worst case: the broken approval gate turns cost-only into an outage

A single krc9n0 ping-loop ran ~14 h unchecked and **exhausted the shared API budget**
(`400 Budget has been exceeded`), freezing every coworker on that budget. The
decisive failure: the `ncl` admin-approval gate had been **non-functional** ("no owner
or admin configured to approve"), so BOTH steps of the v2 recipe (gated mutations)
failed from inside the container — no in-container lever existed, and every escalation
channel (push, `ask_user_question`) went unacknowledged. **Lesson: a broken approval
gate is load-bearing risk — it converts a known cost-only loop into an unbounded
outage by removing every in-container mitigation.** Fixing the gate config and shipping
the durable (A) fix are both critical, not optional.
