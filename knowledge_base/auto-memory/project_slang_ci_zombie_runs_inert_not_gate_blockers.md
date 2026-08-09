---
name: project_slang_ci_zombie_runs_inert_not_gate_blockers
description: "The two long-standing shader-slang/slang 'zombie' runs (queued since 2026-05-26/28) are NOT on ci.yml, and the priority gate queries ONLY ci.yml — so they are inert w.r.t. the bot-CI livelock. Measured 2026-08-08; retires a carried item instead of re-checking it."
metadata:
  node_type: memory
  type: project
---

**Carried item retired 2026-08-08.** Two `queued` runs had been repeatedly handed to me as outstanding ("zombies"). Measured, with the population queried **server-side by status** rather than from the recent-runs window:

```
/actions/runs?status=queued          total=2
  #4186   "pages build and deployment"  master                          created 2026-05-28  event=dynamic
  #22342  "Falcor Tests"                ci-coverage-renderer-cutover    created 2026-05-26  event=pull_request
/actions/runs?status=in_progress     total=0
/actions/runs?status=waiting         total=1   → #30098 (the real blocker)
```

⛔ **THE MEASUREMENT THAT SETTLES IT: they are not in the gate's population.**

```
/actions/workflows/ci.yml/runs?status=queued   total=0
fetch_active_runs (extras/ci/ci_priority_common.py:58-76) queries ONLY
  /repos/{repo}/actions/workflows/{workflow}/runs   with workflow = ci.yml
```

⇒ **The zombies are cosmetic. They cannot yield a bot dispatch**, because the priority gate never sees them — it is workflow-scoped to `ci.yml`, and neither zombie is a `ci.yml` run. Contrast [[feedback_waiting_and_queued_are_two_different_blocks]], where #30098 *is* a `ci.yml` run and therefore freezes everything.

⚠️ **THE NEAR-MISS — a status filter over the RECENT-RUNS WINDOW returns a true zero about a set you never saw.** My first probe was `/actions/runs?per_page=100` filtered client-side for non-`completed`: it returned **nothing**, with the control `by_status={"completed":100}` proving the fetch worked. Both facts true; the conclusion "no zombies" would have been false. The zombies are ~2.5 months old and sit far outside the 100 most recent runs. ⇒ ⭐⭐⭐ **When the thing you are looking for is OLD BY DEFINITION, a recency-windowed query cannot find it — push the predicate server-side (`?status=queued`) so the API, not your window, defines the population.** The `total_count` field is the tell that you are reading a population rather than a page.

⇒ ⭐⭐ **An item handed over repeatedly with no record drifts into nobody's.** Three consecutive handoffs named "zombies" as mine with no measurement attached; one server-side query retired it. **Measure a carried item or drop it explicitly — re-accepting it is the failure mode.**
