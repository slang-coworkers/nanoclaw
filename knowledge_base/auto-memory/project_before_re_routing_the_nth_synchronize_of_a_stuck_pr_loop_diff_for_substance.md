---
name: project_before_re_routing_the_nth_synchronize_of_a_stuck_pr_loop_diff_for_substance
description: "When a PR fires repeated pr_ready_for_review (synchronize) webhooks and its approver chain is confirmed-degraded, diff head-to-head for SUBSTANCE before re-routing — hold non-substantive rebase churn pending the escalation already filed, route the first push that touches the reviewed area."
metadata: 
  node_type: memory
  type: project
  originSessionId: 40bd584e-08e5-4c7d-a174-bdeb7529246d
  modified: 2026-09-16T10:25:34.463Z
---

**shader-slang/slang#12136, Jul–Sep 2026.** A fork PR ("Load autodiff builtins
on demand", `jvepsalainen-nv`) fired **8 revisions** of `pr_ready_for_review`
(reason `synchronize`). Each is a genuine new head (verified head-sha != last),
so none is a re-fire — but from R5 on the approver chain was confirmed degraded
on three axes, all receipt-backed from `sess-1784180176857-773lfi`:

1. **Reports don't reach the orchestrator.** The approver's own OUTPUT_REVIEW
   critique gate blocked its delivery/handoff message 3× (session seq 64/66); R5
   and R6 decisions existed but never landed in my inbox — found only by reading
   its session.
2. **Ledger can't record.** `APPROVAL_LEDGER_WRITERS` unset → every
   `record_decision` denied (host-side, 35+ days).
3. **Fork head → correct-but-useless abstain.** `isCrossRepository:true`, so the
   approver correctly abstains `CLAUSE_FAIL:head_provenance` in shadow mode (empty
   `v0-shadow` policy mount). The right verdict — and identical on every push.

⭐**The trap: mechanically routing every synchronize because "head advanced, so
it's not a re-fire."** True, but irrelevant. A new head that is **pure rebase
churn** (`.github/`, `docs/generated/`, `CMakeLists.txt`, `.gitmodules`) with the
reviewed code byte-identical carries no new information for the reviewer, while
each route costs a full Devin + bot-harvest cycle that can only reproduce the
prior abstain — and here couldn't even report or record it.

⇒ **Heuristic — before re-routing the Nth synchronize of a loop you've already
diagnosed as degraded:**
- `gh api repos/O/R/compare/<lastHead>...<newHead> --jq '.files[].filename'` and
  check the **reviewed area** specifically (for #12136: the gap sites
  `slang-language-server.cpp` goto-def allowlist + `getBuiltinModuleSource`).
- **Substantive change** (touches the reviewed code / the prior finding) → route
  it; the verdict may legitimately flip.
- **Churn only + prior blocker unresolved** → **hold**, don't burn the cycle.
  Notify the operator with a one-tap override; the hold is **self-resolving** —
  keep diffing each push and route the first that touches substance. That is not
  "silently dropping the event" (the bug the routing rule exists to prevent) —
  it's a diffed, logged, reversible hold with the decision escalated.

**Do NOT unilaterally suppress a review-event class permanently** — that is the
operator's call. Hold + escalate + offer override; resume on operator ruling OR
first substantive push, whichever comes first.

**Detector for "did my dispatches even get processed":** the approver has ~5000
sessions, so `ncl sessions list --agent-group <id>` at `--limit 2000` silently
misses old rows. Use `--limit 5000` and grep the PR number across ALL groups;
the single reused session (one per canonical thread — no phantom duplicates here,
thread routing was clean) carries `last_active` that pinpoints which dispatch it
last ran, and `ncl sessions messages <sid> --limit 400 | tail` shows the verdicts
that never reported up.

Links the family: [[feedback_a_no_ci_lane_runs_x_claim_is_refuted_at_the_test_harness]]
(measure the right object), and the standing rule that a stalled handoff you own
is yours to chase, never assumed "queued / will self-heal."
