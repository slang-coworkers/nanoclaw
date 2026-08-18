---
title: "CONSOLIDATED: /supervise-issues operations (nudge, deliver, format, concurrency)"
type: learning
topic: agent-ops
source: learnings/1780558152383-CONSOLIDATED-supervisor-operations.md
---

# CONSOLIDATED: /supervise-issues operations (nudge, deliver, format, concurrency)

*Authoritative (2026-06-04). Consolidates the nudge-mechanism, manual-tick-fan-out, and peer-watcher-echo learnings.*

## 1. Render ≠ nudge (the core gap)
Putting "→ NUDGE" in the board is **NOT** a nudge. The supervisor must actually **dispatch** a message. (Observed 2026-06-04: board flagged nudge-worthy chains; zero nudges were sent.)

## 2. When to nudge a coworker (vs not)
Coworker-nudge ONLY when a chain is stuck *inside* the o→t→f→r pipeline — the assigned coworker session went silent mid-task (no outbound ≥ ~60min) **AND the chain has produced ZERO GitHub artifact** (no comment, no PR).
- **If ANY GitHub artifact exists (comment or PR) → do NOT coworker-nudge** (wastes tokens). The pipeline did its job.
- **PR-complete-but-review-stale** (PR open, awaiting maintainer): not a coworker-nudge. Post a **polite, ONE-TIME** GitHub ping to the assignee/reviewer; if no assignee, post a "standing down for maintainer to drive" comment.

## 3. How to nudge (concrete)
1. Find the stuck session: `ncl sessions list --agent-group-id <coworker-ag> --limit 2000 | grep 'gh-issue-<o>/<r>-<N>'`; `ncl sessions messages --id <sess> --limit 3` (last row inbound-with-no-reply ⇒ stuck).
2. Dispatch into that EXISTING session: `send_message({ to:"<coworker>", text:"[Supervisor nudge — gh-issue-<o>/<r>-<N>] No outbound for <dur>. Blocked? status/blocker/ETA.", target_session_id:"<sess-id>" })`. `target_session_id` resumes with context (falls through if stale). Or `<message to="<coworker>" thread_id="gh-issue-<o>/<r>-<N>">…`.
3. Track `nudgedAt` in supervisor-state.json; **max 2 nudges then escalate** — never loop.

## 4. Peer-watcher heartbeats are NOT stuck
Regular terse echoes from a code-writer peer (e.g. `"Unchanged. End silently."` every ~30min) are a **PR/build-watcher heartbeat by design** = sign of life, not a stuck loop. Don't escalate on cadence alone; require positive breakage evidence (error/abort string, peer asking for help). Distinguish **silent peer** (no echoes/replies/PR — concerning) from **echoing-by-design** (fine).

## 5. Delivery (cron sessions)
A scheduled/cron supervise session has **NO default reply target** — a bare `send_message`/`send_file` fails "multiple destinations — specify to" and the board is silently dropped. Deliver with **`send_message(to="orchestrator", text=<board>)`** (or inline `<message to="orchestrator">…`) — `orchestrator` is the dashboard channel. NEVER omit `to=`; NEVER `send_file`.

## 6. Board format (operator-locked 2026-06-04)
Sections: Active human-debate (lead) → PR-bearing (ours) → No-PR parked → Archived. 10 cols: `Issue#(link) | Title | Orch | Triage | Fixer | Rev | Github | Status | State/Disposition | Next`. Tier cells = session deep-links `<dashboard-base>/#/cw/<folder>/s/<sess>` — resolve `<dashboard-base>` from the running prod dashboard (do not hardcode a host) and `<folder>` from the session's real `agent_groups.folder` via `ncl` (never assume it from the coworker-type name). **Github cell = PR link + ALL comments numbered `[c1]…` newest-first** (`gh api .../comments --jq 'sort_by(.created_at)|reverse|.[0:5]|to_entries|map("[c\(.key+1)]("+.value.html_url+")")|join(" ")'`). **A/B pairs labeled A=prod / B=ours.** State/Disposition = where the task sits in o→t→f→r + stuck flag.

## 7. Source of truth & concurrency
A single manual `/supervise-issues` can fan out to **multiple concurrent orchestrator sessions** that each rewrite `supervisor-state.json` + `reports/issue-chain-tracker.md` → divergent partial reconciliations. Mitigations: (a) **live `gh` is the single source of truth** — never trust "(triaged)"=no-PR; resolve the real PR (`gh pr list --head fix/issue-<N>`, `closedByPullRequestsReferences`, `gh pr view`). (b) A chain `_archived` as "shipped" may actually be OPEN — verify `mergedAt`. (c) **On concurrent writes, RECONCILE don't clobber** — re-read the file before writing, fold in the peer's correct catches, fix gaps with surgical edits. Surface the fan-out to the operator (N× API cost + divergence risk).

## 8. Dropped-webhook safety net
A webhook chain can be silently dropped if the orchestrator's routing turn dies on an API 502 (no auto-retry). "Orchestrator session exists but no triage/fixer session + 0 comments" ⇒ treat as **dropped, re-dispatch** (see the webhook-502 learning).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780558152383-CONSOLIDATED-supervisor-operations.md`_
