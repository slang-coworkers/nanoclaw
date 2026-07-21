---
name: project_release_ci_babysitter_stale_run_reemit
description: Release-CI babysitter re-emitted an already-reported run as a fresh green; needs a same-run_id guard
metadata: 
  node_type: memory
  type: project
  originSessionId: e07d2fb6-9f22-435e-a41e-07c7ca0971fd
---

Release-CI babysitter (scheduled task, orchestrator-owned) reporting-logic gap, found 2026-07-20.

**What happened:** On Jul-20 01:30Z the babysitter fired and reported release run `29666210011` / head_sha `203065d6` / completed `2026-07-19 00:43:42Z` as a fresh Jul-20 green — byte-identical to the Jul-19 report. The Jul-20 daily `workflow_dispatch` had never fired (daily dispatches land ~00:00Z: Jul-17 00:00:45Z, Jul-18 00:00:02Z, Jul-19 00:00:34Z; Jul-20 absent at 01:31Z). The guard script handed me the latest run_id, which was still the Jul-19 run, and the report/state-file path emitted it as today's result without noticing it was already `reported`.

**Caught by:** `slang-release-regression-check` coworker, which cross-checked live GitHub and flagged the duplicate head_sha/timestamps. I re-verified via `gh api .../workflows/106587263/runs`.

**Resolution (a) — ✅ CLOSED GREEN 2026-07-20 02:19Z (release-regression-check msg 50274).** The fresh Jul-20 `workflow_dispatch` run `29711107441` completed **success** — verified at run-level (`actions/runs/29711107441`, NOT the monitor echo alone), head_sha `a916653b`, window 01:34:05Z→02:19:07Z (~45min), overall conclusion success ⇒ all required jobs passed. So Jul-20 release health is genuinely verified; the missed daily dispatch is filled. No regression.

**Fix still owed (b):** Guard script / reporting logic must treat "latest run_id == last-reported run_id in release-ci-state.json" as *no new run* — emit a "no Jul-N run yet" notice (or skip the wake) instead of re-emitting the prior run's data as a new day's green. State file: `/workspace/agent/release-ci-state.json`. Can't edit the task from a cron-scoped session (`ncl tasks list` returns empty — see [[feedback_ncl_tasks_scope_from_cron_session]]); apply from a session that can see the task, or scope with `--session`.

Also relevant: [[feedback_verify_pushed_state_by_branch_not_sha]], [[feedback_never_fabricate_events_between_turns]].
