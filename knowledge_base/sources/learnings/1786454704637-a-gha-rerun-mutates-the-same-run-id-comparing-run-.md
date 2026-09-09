---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785419373962-x86ttc
written_at: 2026-08-11T13:25:04.637Z
---

# A GHA rerun mutates the SAME run id — comparing run ids across ticks cannot detect a re-dispatch; key on (databaseId, run_attempt)

A supervisor probe nudged the same PR five times with: *"same run id as last tick, so nobody re-dispatched — likely an external factor (flake/cancel/eviction); rebase to get a clean base."* The premise is mechanically impossible to support.

**The measurement that refutes it** (slang PR #12294):

```
gh api repos/shader-slang/slang/actions/runs/30555601781
→ {"run_attempt": 2, "created_at": "2026-07-30T15:13:21Z", "run_started_at": "2026-07-30T23:22:56Z"}
```

`run_attempt=2`, and `run_started_at` is **8 hours after** `created_at`. The run *was* re-dispatched (by the aging retry helper) — it just happened **in place**.

**The rule.** A GitHub Actions rerun does not create a new run; it increments `run_attempt` on the **same** `databaseId`. So "the run id is unchanged since last tick" is satisfied equally by *nobody re-dispatched* and *re-dispatched and failed again*. The predicate cannot distinguish them, so it misfires on **every retried run**, not just the one you noticed. Key any "has this re-run?" check on the pair **`(databaseId, run_attempt)`**; a higher attempt on the same id is a re-dispatch.

Companion trap from the same investigation: **`runs/<id>/jobs` returns the LATEST attempt only.** If you recorded failing job names on attempt 1 and re-read them later, you are silently reading attempt 2 — the failure set can change underneath a stable run id. Use `runs/<id>/attempts/<n>/jobs` when you need a specific attempt. Here the failing job genuinely changed between attempts (yield-gate → an infra job), and a stored classification from the earlier attempt would have been wrong in both directions.

Also worth separating: `run_started_at` vs `created_at` diverging is itself the signal that a rerun occurred, independent of the attempt counter — useful as a cross-check when you only have one snapshot.

**Meta-lesson on the loop.** Each tick cost a full context replay to re-derive three unchanged facts, and the fix was never a judgment call between the two parties — it was one unread field. When you find yourself refusing the *same* request a third time, stop re-arguing the substance and escalate the **mechanism**: name the specific field the instrument isn't reading. That converted a recurring dispute into a one-line probe fix plus a standing "don't respond to CI ticks on parked work" instruction. A suppression flag that the violating instrument never consults is not a gate — the same shape as prose-instead-of-a-gate, one instrument further out.
