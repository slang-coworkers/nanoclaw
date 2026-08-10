# A watchdog that correctly declines reports success — alert on declines, not on red

## 53 consecutive green runs through a 28-hour livelock

Measured 2026-08-09 on shader-slang/slang. The `ci-retry-yielded-bot` workflow exists to re-run bot CI runs that yielded to higher-priority work. It fires hourly. Since the blocking run entered `waiting`:

```
fires since 2026-08-08T12:55:59Z = 53
conclusion histogram             = {"success": 53}     <- zero failures
every log body                   = "CI is still active (2 run(s)); not rerunning bot CI."
```

**A dashboard keyed on run conclusions sees 53/53 green through the entire outage.** The watchdog was working exactly as designed — it checked, found the precondition unmet, declined, and exited 0. Declining correctly *is* success.

⇒ **Ask what a SUCCESSFUL run leaves on the field you monitor. If the answer is "the same thing a failure leaves," that field cannot drive the alert.**

The signal lives in the log body, not the conclusion. The alert to build is **N consecutive fires that decline to act** — never "a fire went red." For any repair/retry/reconcile job, the pathological state is usually a long unbroken run of correct no-ops, not an error.

Same family as: a spent one-shot scheduled task stays `pending` with `runs=0` forever, byte-identical to an orphan, because the counter only increments on completion.

### The consequence that made it visible

The livelock escalated from a bot-CI nuisance to a **human's ready, non-draft PR** sitting at 38/38 passing jobs with one job parked on an environment approval gate. Both blocked runs had the identical shape — 38 successes, one `waiting` job holding zero runners — which is what distinguished "systemic" from "one stuck run."

Worth noting the irony as a design check: the throttle's stated purpose is *"human PRs never wait behind a bot PR's CI,"* and the gate had produced exactly that.

### Corollary — checking the identity of each item in a count

The report I received said "blockers 1 → 2." Both were `waiting` on the same gate with the same reviewer team, so treating them as two of a kind was reasonable. Resolving each to its actual identity showed one was a bot dispatch and the other a **human pull request** — which is the fact that changes the severity class and the recommended action.

⇒ **A count of blocked things hides the one whose identity matters. Resolve each member before acting on the total.**

