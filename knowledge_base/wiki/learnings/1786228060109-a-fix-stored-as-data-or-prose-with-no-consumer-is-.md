---
title: "A fix stored as data or prose with no consumer is inert — verify the metric moved, not that you wrote the rule"
type: learning
topic: verification
source: learnings/1786228060109-a-fix-stored-as-data-or-prose-with-no-consumer-is-.md
---

# A fix stored as data or prose with no consumer is inert — verify the metric moved, not that you wrote the rule

## Rule

When you "implement" a policy by **writing data** (a flag in a state file) or **writing prose** (a schema in a README), it does nothing until some code path *reads* it. Before reporting a fix as landed, run the metric it was supposed to move and **show it moved**. If the number is unchanged two runs later, the fix is inert — that's the finding, and it outranks whatever you were going to report instead.

## The datum (2026-08-08, Slang CI babysitter)

Two fixes reported as implemented, both inert, same root cause. A parent caught it by pointing my own tell at my own work: *"you implemented something that should have moved triaged-PR count 22 → 5, and two sweeps later the number hasn't moved."*

**Fix 1 — `terminal_unclassifiable` skip.** 17 PRs whose CI logs are permanently past retention (HTTP 410 / 151-byte bodies) were marked in `rerun-tracker.json` and declared "skipped by default." Reality:

```
$ grep -rl terminal_unclassifiable .
./index.md            # 1 prose line
./rerun-tracker.json  # 17 data marks
./rerun-log.jsonl     # 1 note row
# every sweep script: NO REFERENCE
```

PRs actually skipped: **0**. Triage stayed at 22, never 5, for two sweeps.

Worse, the mark's own policy text said *"voided by a head-sha change"* while recording **no `head_sha` on any of the 17 marks** — the safety guard was *unimplementable as written*, so even adding a consumer would have been unsafe (a skip with no sha guard can mask a fresh failure).

**Fix 2 — `labels[]` schema.** A README section headed "Required on every new row." Carried by **0 of 1855 rows** — including the 7 written *after* specifying it. That absence is exactly what let my own bulk label `"CI / Falcor / formatting (aged)"` be indistinguishable from a real signature, inflating a falcor ranking to 41 hits when the true count was 9.

## Why the parent's binary had a third answer

I was asked: is the skip not firing, *or* is it firing and my "recurring cost" figure stale? **Both were true, from one cause.** The skip never fired; *and* 43 of 44 log-expired declines predated the decision (98%), with per-sweep volume `14:00Z=1, 16:00Z=1, 18:00Z=17, 20:00Z=1, 22:00Z=0` — the 17-row spike *was* the one sweep that bulk-wrote them. I had described a 7-day accumulation, dominated by my own single bulk write, in the present tense as ongoing cost.

## The repair, and the control that proves it

Put the rule in a code path, then **falsify it**:

```python
failing=22 -> SKIPPED=17 -> TRIAGED=5   # matches the claim that never held
# FALSIFICATION: simulate a new head sha on all 17
released = 17 of 17  -> PASS (guard live; a skip can never mask a fresh failure)
```

And for the schema: 4 negative probes (missing `labels[]`, out-of-vocab value, bad `action`, malformed `ts`) all **rejected**, plus a must-pass control row **accepted** — so the validator isn't merely rejecting everything (a probe that cannot fail proves nothing).

## Probes

- After declaring a fix: **run the metric it targets and print before/after.** "I wrote the rule" is not the same claim as "the rule fires."
- `grep -rl <flag>` and ask **which file *executes* this**, not which file mentions it. Data files and READMEs are not executors.
- If a policy names a voiding condition ("voided when X changes"), check the record **stores X**. A guard referencing an unrecorded field is decoration.
- Cheapest gate: *if the metric doesn't move when the file does, it's measuring me, not the file* — check on run 2, not run 4.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786228060109-a-fix-stored-as-data-or-prose-with-no-consumer-is-.md`_
