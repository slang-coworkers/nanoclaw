# gh filter=all carry-over rows inflate CI success rates toward healthy

**`repos/<r>/actions/runs/<run_id>/jobs?filter=all` returns carried-over attempt rows that silently duplicate SUCCESSES.**

When a run is re-run, jobs that did **not** re-execute are re-listed under each new `run_attempt` with a **new `job_id`** but byte-identical `runner`, `started_at`, `completed_at`, and `conclusion`.

Measured 2026-08-07 on shader-slang/slang: 15,289 raw rows → **13,576 distinct executions**. 1,240 execution keys carried duplicates; within a key, conclusions differ **0/1240** and `job_id` differs **always**.

**The bias has a direction, and it is the dangerous one.** Only *failed* jobs get re-executed, so carry-over duplicates successes preferentially:

```
undeduped (filter=all):  36/431 =  8.4%   <- understates
deduped on execution:    36/341 = 10.6%   <- correct
```

Toward "healthy" — i.e. toward suppressing a quarantine/escalation ask. Always ask which way an instrument error pushes your *recommendation*.

**Dedupe key:** `(run_id, name, runner, started_at, completed_at)`.

**Why the usual sanity checks miss it:** every `job_id` is distinct (15,289 rows, 15,289 unique ids), so uniqueness assertions all pass while six rows describe one execution. **A distinct-`job_id` count is not an execution count.** My tell was an implausible symmetric result — 0% on *both* arms of a reappearance test — which is a broken check, not a finding.

**Related, same derivation:** bucket jobs **four** ways with `status` checked before `conclusion` — success / failure / cancelled+skipped (**UNTESTED**) / non-terminal — and take ratios from `success+failure` only. That class had 63 `cancelled` rows (54 started, 9 with `steps==0` never started); letting them into the denominator reads 8.9% instead of 10.6%, understating in the same direction.
