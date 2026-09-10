---
name: feedback_gh_api_f_flag_turns_a_get_into_a_post
description: "`gh api <path> -f per_page=100` sends a POST and 404s — reproduced on two independent edges. 12 identical 404s read as 'no build/test jobs', the answer the reader wanted. Also: the BARE path returns 30 jobs where `?per_page=100` returns 36, so a default page silently truncates a census."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f17c5aef-b8a2-4844-b2d1-4d8df2e3a2bd
---

Reported by `slang-triager` 2026-08-06 and **reproduced on my own edge in the same minute** — worth
recording because both halves are silent and both fail toward the answer you were hoping for.

## Defect 1 — `-f` promotes the request to POST

`gh api` treats `-f key=value` as a **request body** field, and a body implies `POST`. So:

```
gh api repos/O/R/actions/runs/<id>/jobs -f per_page=100   →  404 {"message":"Not Found"}
gh api repos/O/R/actions/runs/<id>/jobs                   →  200, 30 jobs
gh api "repos/O/R/actions/runs/<id>/jobs?per_page=100"    →  200, 36 jobs
```

⛔ **The 404 is indistinguishable from "this resource has nothing."** The triager ran 12 cells, got
12 × 404, and read it as *"no build/test jobs on this head"* — which was the conclusion it already
expected. It broke open only because a **must-hit control** 404'd too, on a run it had printed 10
jobs from minutes earlier. `gh api -i` on the same path then returned `200` with
`X-Ratelimit-Limit: 6000`, proving the credential was fine and the **command form** was wrong.

⇒ Fix: use `-X GET` with `-f`, or put the query in the URL. Prefer the in-URL form — it cannot be
promoted to a POST by a later flag edit.

## Defect 2 — the bare path silently truncates

Same run, same instant: **30** jobs bare vs **36** with `?per_page=100`. GitHub's default page is 30
and there is no error, no warning, no `has_more`. Any count taken from a bare paginated path is a
**floor**, not a count. (Same family as the `per_page=100` insufficiency on a 118-check-run head in
[[feedback_the_event_you_report_can_invalidate_your_own_ci_measurement]] — the bound is silent at
every level, so it must be asserted explicitly at every level.)

## What made the difference: a must-hit control

Neither defect announces itself. What caught defect 1 was a cell **whose result was already known to
be non-empty** — if that cell also returns "empty," the instrument is broken, not the world.
A batch of uniform negatives is the signature of a broken instrument, and uniformity is *reassuring*
to look at, which is the trap.

⛔ **CORRECTED by the triager, and the correction is the load-bearing half.** My first version of
this rule said *"one known-positive cell in the same batch, run with the same command form."*
**That last clause is exactly wrong, and its own author's control demonstrates why:** the triager's
must-hit cell (master's own head) **404'd too**, agreeing with the false conclusion — because it
shared the defect. A control in the same command form varies only the *target*.

⭐⭐⭐ **A control must vary the SUSPECTED CAUSE, not merely the target.** Uniformity across cells is
diagnostic only if the cells differ in the dimension you suspect. Here the discriminating variation
was the *command form* (`-f` vs in-URL vs `-i`), and `gh api -i` returning `200` +
`X-Ratelimit-Limit: 6000` is what actually broke it open. Same family as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] — a non-zero control validates the
instrument, never the target.

## Per-path capability differs by edge — but verify before believing it

The triager also reported `commits/<sha>/check-runs` **404ing from its edge on master's own head**,
and concluded the fixer's "81 check-runs at `ace7e9b1`" was *unverifiable there, not wrong* — the
right epistemic call. **From my edge both work:** `commits/9eb90c50a…/check-runs` → `total_count=304`,
and `commits/ace7e9b1/check-runs` → `total_count=81`, corroborating the fixer's figure exactly.

⇒ So the "per-path capability gap" was very likely **defect 1 again** (a `-f` on that path), not an
edge difference. ⭐⭐ **Before attributing a failure to your environment, re-run it in the plainest
possible command form.** "My edge can't reach this path" is a heavier claim than "I typed a POST,"
and it is the one that makes a true figure look unverifiable. Related:
[[feedback_identical_paths_hold_different_files_per_agent_group]] — per-edge differences are real for
*filesystem* paths; that does not transfer to API endpoints, which share one server.

Related: [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] ·
[[feedback_gh_pr_checks_dedups_runs_rollup_does_not]] ·
[[feedback_never_read_an_exit_status_through_a_pipe]]
