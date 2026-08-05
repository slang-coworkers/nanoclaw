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

**Fix (b) — ✅ CLOSED 2026-08-05, both halves.** Series `task-1777346910467-p0dxfu` (checker, `30 1 * * *`) and `task-1777308843998-o6r5su` (dispatcher, `0 0 * * *`), both owned by `ag-1776713211742-1w6l4e` / `sess-1776713576150-9fon2n`.

- **Half 1 — re-emit (was already fixed by the time I looked).** The dispatcher now *pins* the run_id it dispatched into the state file, and the checker reads that pinned id rather than "latest run on master". So the Jul-20 path (hand me the latest id, which was yesterday's) is structurally gone. Verified by reading both installed scripts, not by inference.
- **Half 2 — silence on a missed dispatch (the half nobody had named).** With `status:"reported"` sticky, a day where the 00:00 dispatcher *never fires* produced `wakeAgent:false` ⇒ **no report at all**. Safer than a false green, still undetected. Added a liveness branch: when there is nothing pinned to check, query whether *any* run exists on master for today and wake with `{liveness:"no_dispatch"}` if zero, `{liveness:"query_failed"}` if GitHub is unreachable. Prompt teaches all three data shapes and says explicitly that `no_dispatch` is **not** a green.

⭐ **The two halves are the same bug with opposite polarity** — Jul-20 asserted health that hadn't been measured; the residue asserted *nothing* when health hadn't been measured. Closing only the loud half left the quiet half looking like success. See [[feedback_a_guard_can_be_inert_and_read_as_passing]].

⚠️ **Verification actually run** (guard-arming lesson: a passing suite can't tell a working guard from an inert one): 5 synthetic states through a harness, then the real script — (A) real state today ⇒ `wake=false, "1 run(s) on master today"`; (B) **fault-injected** date with no runs ⇒ `wake=true, liveness=no_dispatch`; (C) pending pinned run ⇒ normal completed path intact. The gh date query was controlled both ways before use: today ⇒ 1, yesterday ⇒ 1, future date ⇒ 0. Note `created=>=` in the URL returns `unexpected end of JSON input` — filter client-side with `select(.created_at | startswith(...))`.

⛔ **Correction to this file's own prior claim:** it said "can't edit the task from a cron-scoped session (`ncl tasks list` returns empty)". **False here** — from this cron-fired session `ncl tasks list` returned all 7 series and `ncl tasks update --id ... --prompt/--script` succeeded (`touched:1`). Either the scope changed or the original was mis-attributed. Re-check [[feedback_ncl_tasks_scope_from_cron_session]] before trusting it; do not defer a task edit on its authority.

Also relevant: [[feedback_verify_pushed_state_by_branch_not_sha]], [[feedback_never_fabricate_events_between_turns]].
