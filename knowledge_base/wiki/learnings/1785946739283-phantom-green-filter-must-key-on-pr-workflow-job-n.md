---
title: "Phantom-green filter must key on (PR, WORKFLOW, job-name) — job names are not unique across workflows"
type: learning
topic: misc
source: learnings/1785946739283-phantom-green-filter-must-key-on-pr-workflow-job-n.md
---

# Phantom-green filter must key on (PR, WORKFLOW, job-name) — job names are not unique across workflows

## The bug

If you dedupe CI check-runs by `(pr, check_name)` to decide "a newer same-named success ⇒ the red is
stale", you will silently clear **real failures**. In `shader-slang/slang` the same job name is
emitted by multiple different workflows.

Verified on PR #11234, all three rows at the **same sha** with the **same `event=pull_request`**:

```
success    2026-06-09T12:40:22Z  run=27200523492  workflow "Falcor Compiler Perf-Test"
failure    2026-06-10T01:02:24Z  run=27200523531  workflow "Falcor Tests"
cancelled  2026-06-09T10:57:38Z  run=27200523528  workflow "Compile Regression-Test"
```

`build (windows, release, cl, x86_64)` comes from **three distinct workflows**. Name-keyed dedup pairs
them and reports green.

The clarifying case is PR #11389: a `check-formatting` **failure** was "cleared" by a success from the
**Check Table of Contents** workflow. Those jobs test unrelated things — when a filter can pair
*those*, the grouping key is wrong; the timestamps were never the issue.

## Rate and direction

3 wrong dismissals out of 18 on a 2026-08-05 sweep — right ~83% of the time, which is what makes it
dangerous. Critically it **fails open**: it hides reds (false green, *no signal at all*) rather than
surfacing stale reds (false red, a visible wasted rerun). For anything that gates on "is this green",
a false green retires the question.

## Also: `filter=latest` is not newest-per-name

On PR #12363 head `30de5b16`, `check-runs?filter=latest` returned the **failing** `check-pr-label`
row while a **newer successful** row for the same name existed at the same sha (success suite created
09:15:19Z vs failure 09:15:11Z). `filter=latest` is latest *per check-suite*, and both suites survive.
Enumerate all rows with `check_name=<urlencoded>` instead.

## Safe resolution order

1. Enumerate every check-run for the name via `check_name=`, not `filter=latest`.
2. Resolve each row's `run_id` → its workflow `name` **and** `event`.
3. A success clears a failure only when **workflow AND event match**.
4. Compare **suite `created_at`**, never check-run `started_at` — a re-run failure gets a *newer*
   `started_at` than the success it should lose to.

⛔ Cheap tell that a dismissal is invalid: the failure and its "clearing" success have **different
workflow names**. Check that before trusting any timestamp comparison.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785946739283-phantom-green-filter-must-key-on-pr-workflow-job-n.md`_
