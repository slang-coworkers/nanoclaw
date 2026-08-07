---
title: "Post-outage: only a terminal success in the GATING class authorizes reruns"
type: learning
topic: misc
source: learnings/1786062123477-post-outage-only-a-terminal-success-in-the-gating-.md
---

# Post-outage: only a terminal success in the GATING class authorizes reruns

## Post-outage recovery: three signals, only one decides

Sweeping right after the 2026-08-06 GitHub Actions control-plane outage, three signals disagreed:

- **Incident text** (posted 1 min before): *"System-wide queues have been drained… fix for self-hosted runners fully rolled out"* → recovered.
- **`Actions` component color**: `major_outage`, `updated_at` frozen ~7.5 h earlier → still down.
- **Queue depth**: 3 queued / 2 in-progress (vs **103** mid-outage) → ambiguous.

**Queue depth is two-sided**: low depth means *drained* OR *nothing is being created*. Pair it with the run **creation rate** (98 runs in the prior hour ⇒ not a creation collapse).

**Only a fresh terminal success in the class you gate on can authorize action.** Self-hosted jobs with `steps>0`: **92 success / 1 failure**, freshest 3 min old, across Windows GPU + Linux sm80 runners. Cheap GitHub-hosted checks recover *first* and manufacture survivor bias — they had already fooled me once during the outage itself.

⛔ **Filter `steps>0`, and treat an empty result as a broken probe.** My first self-hosted query returned an *empty* tally that read as "GPU fleet still dead." Cause: the newest CI runs were doc-only `skipped` with `runner_name=None` and zero steps. A control (print run names — must hit) exposed the instrument bug in one call.

## Corollary: `steps=0` on a `failure` means UNTESTED, not broken

The same rule cracked the sweep's only fresh red. An `actionlint` job showed `conclusion=failure` after 45 minutes — but `steps: 0`. Checking the whole workflow's history: **all 6** of its failures repo-wide sat inside a 75-minute outage window across 6 unrelated branches, and it had been green since. Rerun → immediate `success`. Without the `steps` field this looks like a workflow-syntax error on the PR.

Same signature explained a merge-queue eviction: 4 cheap checks `cancelled` with `steps=0` while the heavy `CI` run **succeeded** → queue reported `checks_timed_out`. Nothing failed; nothing ran.

## Bonus: a green rollup can still time out of the merge queue

One evicted PR had **all 45 check-runs green** yet was evicted `checks_timed_out`. The blocker was a *commit status*, not a check-run: `SlangPy Tests` stuck `pending` for ~2.5 h, never terminal. **Query both `/check-runs` and `/status`** — a check-runs-only sweep reports that PR as fully healthy.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786062123477-post-outage-only-a-terminal-success-in-the-gating-.md`_
