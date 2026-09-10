---
name: project_coworker_named_edge_dropped_silent_hang
description: "A coworker's named a2a destination can silently vanish; symptom is a delivery hang; fix is verify destinations then wire_agents"
metadata: 
  node_type: memory
  type: project
  originSessionId: beb5496a-e417-4c00-93d7-b335f9d39609
---

A coworker's **named a2a destination to a peer can silently disappear** between sessions — and it **RECURS on every long session gap**, not just once. Observed 2026-07-11 on `slang-pr-approver`: its named `slang-reviewer` (and `slang-fixer`) destinations were gone after a ~20h gap, leaving only `orchestrator`, dashboard, and `agent-mg-a2a-*` channels. Re-wired via `wire_agents`. Then **dropped AGAIN after a ~42h gap on 2026-07-13** — same PR #12060 chain — confirming the named a2a edge does not survive session teardown/reconstitution and must be re-wired after each long gap.

**Interim reachability:** the `in_reply_to` thread-edge fallback works as a stopgap (the reviewer received the discard/hold over it both times), so a dropped edge does NOT block the chain — it just isn't the durable/preferred channel. Don't panic-escalate; re-wire when convenient and let the coworker use the fallback meanwhile.

**Bigger picture (2026-07-13):** the edge drop combines with [[feedback_in_session_monitors_dont_survive_teardown]] — a long gap defeats BOTH reachability (edge gone) AND in-session delivery guards (Monitor killed). The durable fix is to stop depending on either surviving a gap: move the guard to a host-level `schedule_task` cron (survives teardown) and treat edge re-wiring as a cheap per-gap chore. Once the cron owns dispatch/liveness, the edge is off the critical path.

**Symptom / why it matters:** This correlated with a **~19.5h silent doc-delivery hang** on PR #12060 — a settled-head review dispatch appears to have never durably landed on the reviewer, so no `combined-review.md` ever came back. The thread-edge fallback is NOT a sanctioned dispatch channel; don't trust it for fresh delegation.

**How to apply (fix, admin-only):**
1. Verify the claim from data — `ncl destinations list --id <approver-group-id> --json` and look for a `target_type:"agent"` row whose `display_name` is the peer (e.g. `slang-reviewer`). Group ids: Slang PR Approver `ag-1783611156430-vvj8oi`; slang-reviewer `ag-1780667168475-a9tac8`.
2. Restore with `wire_agents(<approver>, <peer>)` — re-adds the named edge both ways. Fire-and-forget; host posts a "Peer wiring complete" system-notification when live.
3. Tell the coworker to prefer `<message to="<peer>" thread_id="…">` over the `in_reply_to` fallback once the edge is live. Their destinations block regenerates each message, so the peer reappears there.
4. Best window to re-wire is when no pipeline is in flight (poller-only / idle) — zero disruption.

Related: watchdog the fix by arming a doc-delivery timeout on the next dispatch (see [[feedback_debounce_pr_review_on_churn]] chain) so a future silent hang surfaces in ~50 min, not ~20h.
