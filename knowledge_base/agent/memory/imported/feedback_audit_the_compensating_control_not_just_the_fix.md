---
name: feedback_audit_the_compensating_control_not_just_the_fix
description: "When a PR trades correctness for an availability cost and offers a compensating control (operator command / alert / escape hatch) as what makes the trade acceptable, EXECUTE the control against the process that enforces the constraint — the fix can be right while its escape hatch is unreachable and reports success"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 80a2a06b-593c-4d13-a8b7-2a36ffec0a6d
---

**2026-08-10, nanoclaw#1163 (reply-capacity settlement, F15). The core fix was correct; the thing that made it *acceptable* was not, and only executing it found that.**

The PR argued: an unsettled reservation must stay CHARGED forever (age is not evidence of failure — a process can get HTTP 200 then die before writing `reply_accepted`). It conceded the cost — a crash permanently consumes one reply of a thread's quota — and offered a **three-part compensating control** as what makes the trade OK: *"an explicit state, an alert, and an operator command. All three."*

I verified the accounting hard (exhaustive sweep: 7,380 sequences, 0 invariant violations — the state machine is genuinely sound) and could have stopped there. Instead I ran the **operator command** end-to-end against the daemon that enforces the cap:

```
daemon in-memory charged      : 15/15  (gate closed: True)
operator settled 15 as --failed
log-derived charged           : 0/15
admin list exit code          : 0   ("ok: every reservation has settled.")
daemon in-memory charged AFTER: 15/15  (gate closed: True)   <-- unchanged
after daemon RESTART          : 0/15
```

The prod daemon calls `_load_thread_state()` **once** at startup and never re-reads the log; `settle` only appends to disk. So the documented recovery command has **no effect on the process it exists to unstick, and prints success.** Because the charge is now permanent *by design*, the failure mode moved from "unsound but self-healing" (the old TTL reclaimed it) to "wedged until someone restarts the daemon". A sibling read path (`discord.py`) re-reads on every call, so the control *works there* — which is exactly why reading alone would have passed it.

⇒ ⭐⭐⭐**A fix and its compensating control are two separate claims. Verifying the fix says nothing about the control.** When a change makes a deliberate trade and names a mitigation, the mitigation is load-bearing and gets its own execution test — **against the specific process that enforces the constraint**, not against whichever code path is easiest to drive.

⭐⭐**The tell that generalises: ask "what re-reads the state after the recovery action writes it?"** In-memory state + append-only log + a CLI that only appends = the CLI cannot reach the daemon. Same shape as any cache/source-of-truth split.

⭐⭐**Also check each promised bullet EXISTS, not just that the feature does.** The body said "explicit state, an alert, and an operator command" — its own three bullets were *explicit state*, *operator command*, and *no privileged path*. The alert had quietly become something else, and grep confirmed **0 consumers** of `unresolved_ids()` in `src/` outside its own definition, absent even from the startup summary line that already reports its sibling counter. **A named mitigation with no consumer is discoverability, not an alert.** Enumerate the promises, then grep for each one's consumer.

⚠️**Do not let "the fix is correct" set the verdict for the whole PR.** My headline had to distinguish three things that pull in different directions: the accounting (correct, well-tested), the compensating control (ineffective — 🔴), and an inherited defect the PR neither introduced nor fixed (🟡, measured on **both** trees before I called it inherited — see [[feedback_a_correct_action_does_not_validate_its_rationale]]).

Related: [[project_nanoclaw_1123_reply_capacity_refund]] (the parent PR, whose review raised the findings this one closes), [[feedback_a_documented_invariant_with_no_enforcer]], [[feedback_a_declared_supply_chain_gate_needs_a_refusal_control]].
