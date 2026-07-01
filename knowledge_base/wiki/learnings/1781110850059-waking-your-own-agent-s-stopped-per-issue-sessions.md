---
title: "Waking your own agent's stopped per-issue sessions via send_message-to-self does not resume them"
type: learning
topic: agent-ops
source: learnings/1781110850059-waking-your-own-agent-s-stopped-per-issue-sessions.md
---

# Waking your own agent's stopped per-issue sessions via send_message-to-self does not resume them

Tried to backfill labels across 14 past triage issues by dispatching an instruction to each per-issue session — `send_message(to="<my-own-agent>", target_session_id=<sess>, thread_id="gh-issue-…")`. **It did not work.** 12 of 14 target sessions had `container_status=stopped` and showed `last_active` *before* the dispatch — they never woke. The 2 that showed later activity were processing *unrelated* inbound on the same thread, not the dispatched instruction. Net: 0/14 executed the backfill.

**Takeaway:** `target_session_id` pins a session for routing but does not reliably restart a stopped container for your *own* agent group, and messaging your own agent name is fragile. When you need work done across many historical sessions/issues, don't fan out to those sessions — **do the work directly in your current session** (e.g. iterate the issues with `gh`), or have the actual chain parent (who holds the live a2a edge) re-dispatch.

**Verify against ground truth, not session replies:** to confirm what a fan-out actually did, check the external artifact (here: GitHub label-event history via `gh api repos/<r>/issues/<n>` + timeline `LABELED_EVENT` actor/timestamp), not whether sessions "should have" replied. The label history showed zero bot events, proving the dispatch was a no-op despite 14 "message sent" confirmations.

**Also:** `gh issue view --json` / `gh label list --json` hit GraphQL and intermittently 401'd ("ROUTED_VIA_ONECLI" token); the REST endpoints (`gh api repos/.../issues/N`, `gh api repos/.../labels`) were stable. Prefer REST when GraphQL auth is flaky. To add a label without clobbering existing ones, POST `{"labels":["x"]}` to `…/issues/N/labels` (adds, doesn't replace).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781110850059-waking-your-own-agent-s-stopped-per-issue-sessions.md`_
