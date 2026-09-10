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

## ⛔⭐⭐ 2026-08-07 — Half 2 had a THIRD hole one level down: a non-numeric count SILENTLY SKIPS the day

**Trigger:** `slang-release-regression-check` flagged that day's dispatch fired **00:28:33Z** while the 14
preceding ones all fired **00:00:01–00:00:57Z** (mine-verified via
`actions/workflows/106587263/runs?branch=master`), and advised *"don't tighten `no_dispatch` to a narrow
window around 00:00."*

✅**Its advice was sound and the guard already satisfied it — there was no window to widen.** The filter is
`select(.created_at | startswith("$TODAY"))`, **day-granular by construction**, so a 00:28 run matches as
well as a 00:00:01 one. Recorded as an in-script comment so a future editor does not "improve" it into a
window. ⭐**The recommended fix was already in place; the real defect was somewhere its author couldn't see.**

⛔**What the check actually had: `TODAY_RUNS` was tested only against the string `"0"` and the string
`"ERR"`, and EVERYTHING ELSE fell through to `wakeAgent:false`.** So any non-numeric value — empty, `null`,
a jq error, or a whole JSON error body — read as *"nothing to do"* and the day went **unreported**.
**CONTROL RUN, on the real backed-up script, with a stub `gh` returning `{"message":"Bad credentials"}` and
exit 0:**
```
OLD: {"wakeAgent": false, "data": {"reason": "no pending run to check; {\"message\":\"Bad credentials\",\"status\":\"401\"} run(s) on master today"}}
NEW: {"wakeAgent": true,  "data": {"liveness": "query_failed", …}}
```
⇒ ⭐⭐⭐**This is Half 2's own bug recursed: the branch built to stop "silence when health is unmeasured"
was itself silent when its own instrument failed.** `|| echo ERR` only catches a **non-zero exit**; a 200
with an unexpected body exits 0 and skips past it. **Every check needs its FAILURE distinguishable from its
NEGATIVE result — including the check you added to fix exactly that.**

**Installed 2026-08-07** on `task-1777346910467-p0dxfu` (old script backed up to
`/workspace/agent/tmp/guard-OLD-backup.sh`, 2534 B, revert = one `ncl tasks update`):
1. Parse once into `{n, newest, ageH}`; **anything unparseable ⇒ `query_failed`**, never the quiet branch.
2. `no_dispatch` now carries **`newest_run_age_hours`**, because a single 01:30 check **cannot distinguish a
   late dispatch from a never-fired one** — today's +28 min jitter ate 28 of the ~90 min margin. 25.7h ⇒
   probably late; 49.7h ⇒ dispatcher broken. ⭐**When one observation can't separate two causes, report the
   quantity that separates them rather than picking one.**
3. Test hooks (`STATE_FILE`, `FAULT_RUNS_JSON`) **stripped from the installed copy** — a fault-injection env
   var left in a production guard is a live footgun.

⚠️**Verified by executing the INSTALLED copy read back from the DB, not my local file** — the read-back also
caught that installed vs. intended differ only by a trailing newline. Faults armed **separately and named**:
gh-absent, gh-200-with-error-body, and node-absent all ⇒ `query_failed`; real state ⇒ `wake=false`;
fault-injected date ⇒ `no_dispatch` + age. ⛔**One near-miss worth keeping: my first "broke gh" run had `gh`
present and `node` absent** (`PATH=/usr/bin:/bin` still had `/usr/bin/gh`). It produced the right verdict for
the wrong reason — I'd have filed "GitHub unreachable ⇒ query_failed" on evidence that proved nothing about
`gh`. **`command -v` the binary you think you broke.** Same family as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

⭐**Provenance:** the jitter observation is the coworker's; the fall-through hole is mine, found only because
its next-action sent me to read a branch I'd have otherwise left alone. **A recommendation that turns out
unnecessary can still be the reason the real defect gets found** — the value was in re-opening the file.

## ⛔⛔⭐⭐⭐ 2026-08-07, SAME SESSION — THE JUL-20 BUG WAS NEVER CLOSED. It re-enters through the PIN.

**The coworker then measured the dispatch→check margin** (dispatch→completion 43–52 min; normal slack to
01:30 = **36–48 min**; on 08-07 the +28 min jitter cut it to **14 min**) and asked me to confirm the pending
branch treats a mid-flight run as re-check, not failure. It does. **But testing that surfaced the real
defect one step past it.**

⛔**An UNRESOLVED PIN BECOMES A STALE RE-EMIT 24 HOURS LATER.** The checker is `30 1 * * *` — **once a day**.
If the pinned run is still in flight at 01:30, the guard correctly returns `wakeAgent:false`, so the state
file keeps `action=check_run, status=pending` — **and nothing re-checks it for 24 h.** On the next fire the
pinned-run branch finds it `completed` and emits it as today's result. **MEASURED, not reasoned:**
```
state: {"run_id":31058294691,"status":"pending","action":"check_run"}   # the 08-06 run
OLD →  {"wakeAgent": true, "conclusion": "success",
        "run_json":{"created_at":"2026-08-06T00:00:57Z", …}}            # nothing marks it a day old
```
Per the task prompt, shape 1 + `success` ⇒ *"send OK message with run link"* ⇒ **I would have reported a
24-hour-old run as today's green.**

⇒ ⭐⭐⭐**THIS IS THE JUL-20 BUG, and Half 1's own fix is what re-opened it.** Half 1 replaced *"hand me the
latest run"* with *"hand me the pinned run"* — which removes staleness **only while the pin resolves the same
day.** A pin that outlives its day is a **stronger** staleness vector than "latest", because "latest" at
least tracks reality. ⭐⭐**A fix that removes a bug's trigger can preserve its mechanism behind a new
precondition — and the fix's own success makes nobody look there again.** This file said Half 1 was
"structurally gone." It wasn't; it was *conditional*, and the condition (pin resolves within the day) was
never written down, so nothing tested it. Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]].

⇒ **Reachability is real, not theoretical:** the breach condition is `dispatch_delay + duration > 90 min`.
At the median 46 min duration a **>44 min** delay breaches; at the observed 52 min max, **>38 min** does.
08-07 spent 28 min of that budget. **The slack looked infinite for 13 days because every dispatch fired
within 57 seconds of 00:00.**

✅**FIXED + INSTALLED 2026-08-07** (script + prompt both, read back from the DB and diffed):
- **New 4th shape `stale_pin`** — pinned run completed but `created_at` is not today ⇒ wake with an explicit
  *"NOT today's result, NOT a green whatever its conclusion says"*, carrying `run_created_at`.
- **Mid-flight made explicit**: `wakeAgent:false` with `status=in_progress, conclusion=null - not a failure`.
  In-flight is checked **before** staleness, so a yesterday-created still-running run stays a wait, not an alarm.
- Prompt rewritten to teach all **four** shapes and to use `newest_run_age_hours` for late-vs-never.

⚠️⭐⭐**MY FIRST MID-FLIGHT ARM WAS INVALID AND I NEARLY KEPT IT.** I pinned a live `in_progress` run
(`31139292203`, found at 01:50) — it **completed at 01:51:48, between discovery and my guard run**, so the
arm took the *completed* path and proved nothing about mid-flight. Re-armed with a **stub `gh`** emitting
`status=in_progress, conclusion=null`, plus a `command -v gh` control proving the stub was answering.
⇒ ⭐⭐⭐**A test whose fixture is a live external state can silently change class mid-test.** The tell was
`created_at 01:50:06 / updated_at 01:51:48` in my own output — the fixture's timestamps refuted the arm's
premise while the arm "passed". **Stub the state you are testing; don't borrow it from production.** Second
instance tonight of the same shape as the `gh`/`node` mix-up: *right-looking output, wrong mechanism*.

**Branches now fault-armed and verified against the copy read back from the DB:** real state ⇒ `wake=false`;
today-pin ⇒ normal green (no `stale_pin` false positive); yesterday-pin ⇒ `stale_pin`; stubbed in-flight
(today **and** yesterday) ⇒ `wake=false`; gh-absent / gh-200-error-body / node-absent ⇒ `query_failed`;
fault-injected date ⇒ `no_dispatch` + age. Old script: `/workspace/agent/tmp/guard-OLD-backup.sh`.

⭐**Three holes, one family, found in one night by three different prompts:** false green (Jul-20) → silence
on missed dispatch (Half 2) → silence's own instrument failing silently (fall-through) → **stale pin re-emit
(this)**. Each fix's success is what hid the next. **The polarity keeps flipping between asserting unmeasured
health and asserting nothing; the invariant to test is "can this path report a day as verified when it
wasn't?", not any individual branch.**

Also relevant: [[feedback_verify_pushed_state_by_branch_not_sha]], [[feedback_never_fabricate_events_between_turns]].
