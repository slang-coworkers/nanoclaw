---
title: "CONSOLIDATED: a2a messaging — reply routing rules + self-edge/empty-ack loop incident"
type: learning
topic: agent-ops
source: learnings/1780558160000-CONSOLIDATED-a2a-messaging-routing-and-self-edge-loop.md
---

# CONSOLIDATED: a2a messaging — reply routing rules + self-edge/empty-ack loop incident

*Consolidation (2026-06-07) of 17 a2a/self-edge/empty-ack notes. Supersedes them.*

## A. Reply routing rules (still prescriptive)

**Anchor `in_reply_to` to the peer's MOST RECENT inbound, not a stale one.** `in_reply_to` routes to the `source_session_id` of the inbound row it references. A peer can legitimately have multiple sessions (one per thread/task), each a different `source_session_id`; the **newest** inbound names the session that is actually awake. Replying to an older inbound (e.g. their original `[Fix Report]` whose session has since gone idle) delivers to that **dead/idle session** — the live session never receives it, with **no error**: the send "succeeds" sender-side and the work silently never starts.
- Incident: shader-slang/slang#11372 / PR#11373 (2026-06-01). Triage forwarded the maintainer's gap-signoff to the fixer anchored on the fixer's *original* `[Fix Report]` msg, but the fixer's live session had rotated (it had moved to an admin-requested authorship fix). Reply routed to the dead session → **~6-hour mid-chain stall**, no diff change between sessions' commits. Recovery: re-send the full direction anchored to the fixer's *current* live inbound — work resumed immediately.
- **A long silence after you sent direction looks identical to in-progress work.** Suspect a stale-inbound delivery to a dead session *before* suspecting a work failure. Verify on the peer side (git state / file diffs unchanged = never received). A cheap status-reconciliation ping ("state of X — started / stalled / blocked?") catches it. Sender-side "Message sent" is NOT proof of delivery.
- The runtime **refuses `send_file` to a thread with multiple unresponded inbound rows** unless you pass an explicit `in_reply_to` — that refusal is a hint the thread has ambiguous routing; pick the peer's latest inbound.

**Don't echo acks to holding/status pings — stay silent.** When a parent/peer sends a content-free ping ("Holding.", "Standing by.", "No action.", a milestone-table FYI, a chain-close confirmation), reply with **nothing** — no `<message>`, no `send_message`, no "Acknowledged." A turn with no substantive action should end with **zero chat output** (scratchpad text outside `<message>` blocks is logged but not delivered, so silent turns are fine). This is the spine's "No echoes. No meta-acknowledgements." rule (`chain-reporting.md`). Recording a one-time local learning (a file write) is fine; repeating status acks up/across the chain is not. Break silence only for a genuine deliverable, a real question, or a substantive inbound.

## B. Self-edge / empty-ack loop — root cause

**Symptom:** an inbox floods with contentless echoes — `.`, `(idle)`, `"Holding."`, `"Waiting."`, `"No response needed."`, `"Done."` — every ~10–60s, indefinitely, each a full agent wake burning API credits. Observed on slang-triager, slang-fixer, slang-reviewer (2026-06-02); one loop ran ~19h; another bystander flood ran ~7h with hundreds of messages.

**Two distinct failure modes — diagnose which before acting:**
1. **Self-edge** (`platform_id = agent:<ag>:<ag>`, source == dest): the sender id equals the agent's *own* group id. A self-targeted a2a route reflects the agent's output back into its own inbox, re-waking it. Fix is admin-level (below).
2. **Mutual cross-edge empty-ack ping-pong** (source != dest, a *legitimate* edge, e.g. triage↔fixer): two wired agents trade near-empty messages, each claiming no reply is warranted while both keep replying. **Deleting the wiring does NOT apply** — the edge is needed for the real chain. Confirm via `ncl sessions messages --id <sess>`: alternating out/in near-empty rows between two *different* agent groups. These tend to **self-terminate** after ~10–15 exchanges (~2 min) once one side finally emits nothing.

**Root cause PINNED (read-only NanoClaw code investigation, 2026-06-02; live branch `wt-nv-main-sync` / `sync/upstream-nv-main` — NOT the default `/workspace/agent/project` checkout, which is a *docs* branch carrying the OLDER `agent_destinations`-only a2a design with no `ensureA2aWiring`; if you grep `project/` and find nothing, you're on the wrong branch):**
- **Sole minter:** `ensureA2aWiring()` at `src/modules/agent-to-agent/agent-route.ts:64-104` builds `platform_id = agent:${source}:${target}` and creates the messaging group + wiring as a side effect. Sole prod caller is `routeAgentMessage` at `:489` (fresh-delegation branch). A self-targeted a2a (outbound `platform_id == own agent_group_id`, i.e. `<message to="<own-group-name>">`) reaching that branch mints the self-edge — and the mint runs **before** the same-session guard at `:505`, so the guard drops self-*delivery* but the mg+wiring are already persisted. The explicit-reply path (`:411`/`:473`) has **no** same-session guard at all — that's the steady-state loop engine.
- **Ruled out:** `wire_agents` (rejects src==dst at `wire-agents.ts:65`, only writes `agent_destinations`); `create_agent` (its "ownMg" is a *dashboard* channel mg, never `agent:X:X`). No wake/restart/sweep/scheduler path calls `ensureA2aWiring`.
- **Why severance doesn't stick:** `createMessagingGroupAgent` (`db/messaging-groups.ts:184-190`) auto-creates a durable self-pointing `agent-mg-a2a-*` channel destination that survives severance.
- **No session GC:** sessions are born `status='active'` and **no production code ever transitions status** (`updateSession`, `db/sessions.ts:112`, only touches `container_status`/`last_active`; `deleteSession` has zero prod callers). The 60s host-sweep (`host-sweep.ts:161,238-243`) wakes any active session with due messages, keyed on the *session* + its own `inbound.db`, **never re-checking wirings**. `status='closed'` exists in the schema + CLI enum (`cli/resources/sessions.ts:33`) and `getActiveSessions` already filters on it — but nothing sets it. So a live looping session keeps being re-woken regardless of wiring state.
- **Scheduled tasks are session-resident, not mg-routed:** `handleScheduleTask` (`scheduling/actions.ts:44`) inserts `kind='task'` rows into the session's own `inbound.db`; both one-shot and recurrence fire via `wakeContainer(session)` with no messaging-group lookup. So severing an agent's `agent:X:X` self-edge is SAFE for its scheduled wakes (but futile — re-minted on next self-route).

**Detect:**
```bash
# self-edge mgs (source==dest) across the host (admin):
ncl messaging-groups list | grep -oE "agent:[a-z0-9-]+:[a-z0-9-]+" | awk -F: '{if($2==$3)print}'
ncl wirings list                              # messaging_group_id per agent_group_id
ncl messaging-groups get --id <mg>            # platform_id agent:X:X (source==dest) is the bug
ncl sessions messages --id <sess> --limit 20  # confirm empty-ack ping-pong (note: --id, not bare positional)
# from the receiving side, is the "unknown" sender me?
ncl groups get                                # your group id
ncl destinations list                         # if agent_group_id == the sender id, loop is self-referential
```
- **Tapering vs flat:** a finite residual backlog decays and stops within seconds of a wake. A **flat, non-decaying stream over minutes = an active source still emitting** — do NOT accept a "residual backlog draining" explanation for a stream that won't stop (a stream persisting 16+ min through a stated severance falsified the backlog model). (An early note mis-diagnosed this as backlog drain; corrected: a still-`running` session bound to a self-edge keeps reflecting outbound→inbound in-process even after the wiring is severed.)
- **`last_active` advancing is heartbeat noise, NOT proof of looping** — a running-but-idle container bumps it. Confirm a real loop only via actual contentless-ack message traffic on an `agent:X:X` session.

## C. Mitigation & stand-down protocol

**What does NOT fix it:**
- **Replying** to the pings — even "stop" or a one-word ack is another inbound that re-feeds the loop. A direct "stop pinging" to a looping peer does not work and adds turns.
- **Deleting the self-edge wiring alone** — re-minted on the next self-route (`ensureA2aWiring`); also doesn't kill an already-running looping session (no GC).
- **A single `request_restart` of your active container** — works ONLY if the looping session *is* your active/main session (confirmed on slang-triager: zero echoes for 2+ min after). It will **not** stop a sibling *per-thread* session in the same group (observed: ~4h of silence, then pings returned). The looping session is often NOT your active one.

**Stopgap that works (temporarily):** group-wide `ncl groups restart --id <ag>` (admin/operator-approval gated) cycles ALL the group's containers, clearing the current looper. Buys hours, not permanence — expect recurrence until the code fix merges. There is **no `ncl sessions close/stop` verb**.

**Operating guidance while looping (the agent caught in it):** stay silent (scratchpad-only, end turn — don't feed it). Report **once** to parent when pings persist past the restart window, framed as an operational flag, not chain content. Leave an on-disk handoff (`/workspace/agent/SESSION-HANDOFF.md`) before restarting so the fresh session knows to re-check and escalate if pings persist >2 min post-restart. Don't spam.

**Bystander coworker receiving a peer's flood:** (1) respond scratchpad-only "no action" — never a `<message>`/`send_message` reply. (2) Escalate **ONCE** to the admin-context holder (parent/orchestrator) as an operational flag: "peer X appears stuck in a self-edge loop; a direct hold directive won't stick; above my reach — suggest operator delete the self-edge wiring + group restart," then explicitly say you won't re-escalate. (3) Do **not** keep re-escalating once the parent acknowledges ownership (the parent is blocked on the same human approval).

**Converged-chain stand-down (the behavioral root of most empty-ack loops):** when a chain has **converged** — reviewer returns APPROVE / 0 critical findings, or the fixer shipped its `[Fix Report]` and there's nothing new to decide — it is in a **terminal state**. The deepest tier posts its one terminal artifact (`[Fix Report]` upstream to parent, or the `[Resolution]`/5-bullet on GitHub) and then **emits nothing further to the peer**. An empty/echo inbound (`.`, bare "Holding."/"Done.", or a restatement of a position you already hold) → **silence** (scratchpad-only). A `[Fix Report]`/`[Review Verdict]`/`[Resolution]` is a *close*, not an invitation to reply. "Max 2 review rounds" (slang-fix-issue Step 8) is a hard cap — after round 2, take the better diff, report, stop. A genuinely substantive new inbound (real question, new finding, human comment with content) is NOT an echo — answer it normally on the peer's edge with `in_reply_to`.
- Incident #11487 (2026-06-05): chain worked perfectly through review (triage → fix → codex caught a stale report → reviewer caught a real infinite-recursion bug → round-2 fix → 0 bugs → **PR#11492 shipped**), then degenerated: reviewer sent `"."`, fixer replied `"Holding."`, ~110 round-trips / **317 a2a routes** on the `gh-issue-shader-slang/slang-11487` thread, one every 5–7s, until containers idled out hours later; a dashboard admin had to intervene. a2a wirings are `engage_mode='always'`, so each empty message wakes the recipient — only one side choosing silence breaks the cycle.

**Behavioral avoidance:** agents must **never** `<message to="<own-group-name>">` — that self-route is the mint trigger.

**Durable fix (recommended; NOT yet implemented as of 2026-06-05 — needs operator sign-off):**
- (A) **Root cause:** hoist the self-target drop ABOVE the mint at `routeAgentMessage:489`, and/or early-return in `ensureA2aWiring` when `source === target` (~3–5 lines, bug-fix class — stops all new self-edges).
- (B) **GC:** add `closeSession()` = `updateSession(status='closed')` + `killContainer`, exposed via `ncl sessions close`; self-heal in the sweep when it detects an `agent:X:X` session — but **skip any session holding pending `kind='task'` rows**.
- (C) One-shot cleanup of existing self-edge mgs / wirings / `agent-mg-a2a-*` destinations — only durable AFTER (A).
- Full report: `reports/a2a-self-edge-investigation.md`. As a domain specialist, give an engineering +1 on the guard but route framework self-mod authorization to the human operator. **Orchestrator caveat:** do NOT *close* an orchestrator session without first confirming its cron tasks aren't stored in that session's `inbound.db`.

## D. Status (as of 2026-06-05)

- **Systemic, root-cause-pending.** A 2026-06-02 audit found a self-edge mg (`agent:<ag>:<ag>`) for **every** agent group, and new ones were still being minted (slang-maintainer's was created 2026-06-02, after the original 2026-05-20/22 batch) — deleting wirings is whack-a-mole until fix (A) lands. Operator batch-cleanup was in progress.
- **Prod state 2026-06-05:** 2 self-edge wirings remained — **Orchestrator** (`ag-1776713211742-1w6l4e`) and **Slang CI Babysitter** (`ag-1776713259045-nax3cr`). Dormant (the route-level self-target guard drops self-delivery) but a latent loop risk of exactly this class.
- **Current guidance** is **stand down + escalate once**, not keep-pinging. Chains were converging; the dominant live cause shifted from raw self-edges to behavioral empty-ack ping-pong on converged chains (§C).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780558160000-CONSOLIDATED-a2a-messaging-routing-and-self-edge-loop.md`_
