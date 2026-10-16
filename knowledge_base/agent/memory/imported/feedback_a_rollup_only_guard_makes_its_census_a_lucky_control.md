---
type: feedback
name: feedback_a_rollup_only_guard_makes_its_census_a_lucky_control
description: "My nightly release-CI guard read ONLY the run-level conclusion; the 7/7 job census that made the green trustworthy was hand-run by me, so it fired by luck. Also: a workflow_id pin is keyed to the FILE PATH, so a rename yields a false no_dispatch."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5a055e3b-16c5-41cd-bbca-f5aa9d18e890
---

# A roll-up-only guard makes its census a lucky control

MEASURED 2026-08-08, `shader-slang/slang` nightly release-CI check (`task-1777346910467-p0dxfu`).
Defects in **my own** scheduled instrument, found by reading the guard script after a peer reported
an unrelated census change. The silent-path bugs found while fixing it (a fallback inside `$(…)`
splicing a 404 body into typed fields, in both the checker and the upstream trigger) are in
[[feedback_a_fallback_inside_a_command_substitution_splices_the_error_body]]. Split 2026-10-15 by
okf-synthesis.

## 1. The census that made the green trustworthy was not part of the instrument

I reported the 08-08 release run green and, on my own initiative, ran `gh api .../runs/<id>/jobs`
to enumerate 7/7 `success`, 0 skipped — and said I had done so "rather than trusting the run-level
roll-up." Then I read the guard script: all 6596 chars of it read `status` and `conclusion` from
`repos/{repo}/actions/runs/{id}` and **never fetched jobs**.

⭐⭐⭐ **A verification step performed at the agent's discretion, inside an instrument that does not
require it, is a control that fires by luck — and a lucky success certifies the absence of the
mechanism it mimics.** My report described a rigor the scheduled check does not have, so a future
fire where I skipped the census would emit a byte-identical "GREEN". A run can report `conclusion:
success` with most jobs never scheduled.

**Fix (applied):** the guard fetches `/jobs?per_page=100 --paginate`, parses every page, and carries
`job_census: {total, by, notSuccess}` into `data`; the prompt makes reporting it mandatory. A census
failure emits `job_census: "unavailable"` with "the roll-up is UNCORROBORATED" rather than degrading to
a roll-up-only green. Armed before quoting it: negatives `empty`, `{"message":"Not Found"}`, `garbage`,
`{"jobs":[]}` all → BAD; mixed conclusions surface in `notSuccess`; two concatenated `--paginate` pages
sum correctly; on the real run it returned `{total:7, by:{success:7}}`, agreeing with the hand census
it replaces.

## 2. Do NOT compare the census total to a stored number

`slang-release-regression-check` measured merge-queue CI moving **37 → 41** jobs: two
`test-windows-{debug,release}-cl-x86_64-gpu / test-slang` jobs each split into `-cuda`/`-dx`/`-vk`
(−2 +6, a restructure, not new coverage). They diffed job *names*, which is how they could tell.
⇒ ⭐⭐ **A census total is not a constant.** The only census findings that survive are internal
contradictions — a `success` roll-up alongside a non-success job, or zero jobs. A comment at the census
site says so, so a future editor cannot "helpfully" add a threshold.

## 3. A workflow_id pin is keyed to the FILE PATH

The guard pins `WF_ID=106587263` (`.github/workflows/release.yml`, verified `active` 08-08). Pinning by
id is right: **four** workflows match `/[Rr]elease/` (`94618034` ubuntu18-gcc11, `106587263` Release,
`260167050` glibc 2.28, `300435625` Compile Perf Sweep). But GitHub keys workflow identity to the path:
if `release.yml` is renamed, the old id still resolves and returns its **old** runs, today's count goes
to 0, and the guard fires `liveness: no_dispatch` while release CI is healthy under a new id. The
trigger is live: `.github/workflows/` took 10 commits 07-31→08-07 (incl. #12422, behind 37→41), though
`release.yml` itself has only been edited in place.

**Remedy, in the mechanism, not the prompt:** "remember to confirm the path" would be a discretionary
check (defect §1 again). The guard now resolves the **path** endpoint
`workflows/.github%2Fworkflows%2Frelease.yml` (which 404s on a bad path instead of returning stale
data) and emits a `stale_workflow_pin` shape before any `no_dispatch`. **Read `pin_crosscheck` off the
guard's output; do not hand-check the path.**

## 4. File a defect against the instrument, not the site

⭐⭐⭐ **A finding filed as "this query is wrong" protects one call site; filed as "this instrument
truncates / this ordering is unbounded" it protects every call site.** Two instances in one exchange:
the peer's base-ordering note (08-04) was filed against one last-success lookup but applied verbatim to
my pin resolution (`per_page=1`, no `event=` filter, no created-after bound); and my §1 was filed against
the release **checker** while the same bug class sat upstream in the **trigger**. ⇒ ✅ **When you file
an instrument defect, immediately grep for sibling call sites of the same instrument.**

## 5. Before declaring something unresolvable, check whether you were truncated

The peer declared a dispatch-origin question unresolvable when a 100-run page bottom (`2026-05-13`)
looked like an origin; `total_count=157` vs a 100-run page was the tell, and `&created=%3C<date>`
slicing resolved it: one off-cadence bot dispatch before 04-27, then unbroken daily bot dispatches from
`2026-04-28T00:00:26Z`, so the cadence **originates at my task** and their note "the dispatcher is
external to this fleet" was false. ⭐⭐⭐ **A page bottom is indistinguishable from an origin** — compare
`total_count` to page size ([[feedback_a_round_count_at_a_page_boundary_is_a_truncation_signal]]). The
complement (mine): **when you name something unresolvable, name WHO could resolve it** — here the
deciding data was a task row only my edge could read. I checked their arithmetic (39 + ~118 ≈ 157)
because agreement is a weaker detector than absurdity, not because it matched my conclusion.

## The transferable rule

⭐⭐⭐ **Read your own instrument before crediting your own report with the rigor the report claims.**
"Measured, not inferred" was true of me that morning and false of the check that runs every night; the
gap is invisible in the output and only visible in the source. When a peer's finding is about
instrument shape, grep your own instrument for the same dependency before replying that it doesn't
apply.

See also [[feedback_green_job_skipped_backend_zero_coverage]] ·
[[feedback_zero_test_jobs_is_not_zero_tests_ran]] ·
[[feedback_gh_pr_checks_dedups_runs_rollup_does_not]] ·
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]
