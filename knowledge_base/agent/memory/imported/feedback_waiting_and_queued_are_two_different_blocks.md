---
name: waiting-and-queued-are-two-different-blocks-on-one-job-name
description: "A required-reviewers gate yields run/job status='waiting' with a non-empty pending_deployments; a starved self-hosted pool yields 'queued' with runner_name='' and steps=0 — pr-12309 was the second, misreported as the first, and the falcor-bridge pool has ONE runner (11 rows, NOT the n=1 I first published) while two sibling Windows falcor pools have 2-3 — count runners BY LABEL SET; queued splits into busy-vs-absent by handoff timestamps. A 'waiting' run also counts as ACTIVE CI (ACTIVE_STATUSES), so one unapproved gate froze every bot dispatch repo-wide, with no clock (wait_timer=0) to free it."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

# `waiting` and `queued` are two different blocks on one job name

**2026-08-07/08, shader-slang/slang** (distilled 2026-10-04). A peer reported that the new `falcor-ci`
required-reviewers environment (#11915, `ci-falcor-test.yml:18`) had parked merge-queue head
**pr-12309** for 124 min and asked me to approve it. Run `31179974395` said otherwise:
`run.status=queued`, `pending_deployments=[]`, job `test-falcor` queued with `steps=0`,
`runner_name=""`, labels `[Linux,self-hosted,X64,falcor-bridge]`. A gate yields `waiting`, never
`queued`.

## Discriminator tree for a stalled-looking job

| block | `run.status` | `pending_deployments` | `runner_name` / `steps` |
|---|---|---|---|
| required-reviewers gate | `waiting` | **non-empty** (env + reviewers) | `""` / 0 |
| starved self-hosted pool | `queued` | `[]` | `""` / 0 |

`runner_name` and `steps` are identical in both, so only `status` + `pending_deployments` separate them.

- **`waiting`** ⇒ policy gate. Find the reviewers and check `current_user_can_approve` **before**
  escalating "please approve" — here it was `false` (reviewers = Team `ci-approvers`), so "only you can
  clear it" named the wrong actor. Then measure the blast radius (below).
- **`queued`** ⇒ capacity. Count runners **per label set**, then split *busy* from *absent* by
  consecutive handoff timestamps (`/actions/runners` is 403 to us).

The gate was real, just on `pull_request` runs (`31187761893`, `31184917490`); merge_group falcor jobs
were completing normally.

## Capacity: count runners by label set, and multiply by job duration

`Test (Falcor)` runs under three label sets (86 rows across 127 `ci.yml` runs, 08-06T19:00 → 08-07T15:41):

| label set | rows | runners |
|---|---|---|
| `[Windows,self-hosted,perf]` | 43 | 3 (SLANGWIN10X64-1, SLANGWIN4, SLANGWIN5) |
| `[Windows,self-hosted,falcor]` | 32 | 2 (SLANGWIN4, SLANGWIN5) |
| `[Linux,self-hosted,X64,falcor-bridge]` | 11 | **1** (`kernelvm-falcor-bridge`) |

Aggregated, the bottleneck vanishes; my first "one runner" came from **n=1** (one assigned job) — the
same single-sample defect I had just praised the peer for catching. Report rows-per-group as the N.
`actions/runs?per_page=100` is dominated by other workflows (gave 4 rows); use
`actions/workflows/ci.yml/runs` — a bigger page does not fix a wrong-corpus query.

**Busy vs absent:** the peer's occupancy check came back empty and nearly became "the runner is
offline" — its query covered only 2 repo-wide `in_progress` runs. Consecutive jobs on the bridge runner
showed 43–50 min jobs with **1–2 s handoffs** ⇒ saturated, not dead. pr-12309's 176 min ≈ 4 job-lengths
of backlog — expected. The actionable quantity is **runners × job duration**, not runner count.

The two interact: a `waiting` PR run holds no runner, but takes the single bridge once approved.

## `waiting` counts as ACTIVE CI — one unapproved gate froze every bot dispatch

Run #30098 (`31179559787`, `fix/issue-12383`) sat `waiting` 29.7 h on `falcor-ci`.
`extras/ci/ci_priority_common.py:29` `ACTIVE_STATUSES = {"queued","in_progress","waiting","requested","pending"}`,
so `wait-for-priority.py` yielded every bot CI dispatch to it: **12 failed dispatches across 6 branches**
(fix/issue-12386 ×5, 11981 ×2, test/property-accessor-coverage-12231 ×2, 12371, 12367, 12307 — checked
per run on the `wait-for-human-priority` job). ⇒ On finding a `waiting` run, `grep ACTIVE_STATUSES` to
learn who else yields to it; **the radius, not the age, is the actionable figure.**

**No safety valve can clear it:**
- `wait-for-priority.py --max-yield-hours 12` ages from `created_at` (`:65`, ceiling `:179`), but each
  fresh dispatch is a new run (measured 0.12 h, 0.56 h) — the clock only accumulates on reruns.
- `ci-retry-yielded-bot.yml` would rerun, but refuses while anything is active (12 fires in 2 h:
  "CI is still active … not rerunning bot CI").
- `retry-yielded-bot-ci.py --lookback-hours 16` had already aged #30098 out.
- `pending_deployments` showed **`wait_timer: 0`, `wait_timer_started_at: null`** — there is no
  elapsed-time path at any duration. Only a human can clear it.

When reading "we escalate after N hours", ask **which clock** — a rerun's `created_at` and a fresh
trigger's differ, and that decides whether the guarantee exists.

## Lessons

- **Truncated pagination can manufacture an alarm.** The peer's `per_page=40` read gave "106 min vs
  median 47" — a median of one sample. Three pages: 26 landings, current gap 69 min = 24th percentile.
  Any threshold claim carries its N. They reported the mechanism and withheld the alarm — copy that.
- **A fetched field you didn't interpret is a field you never had.** `wait_timer: 0` sat in my own
  output an hour before a peer named it. When a payload answers question A, name what its other fields
  say before closing — especially `0`/`null`/empty values.
- **A right action on a wrong mechanism is an unexploded failure.** The fixer stopped dispatching
  because runs were "noise"; the real reason is each dispatch resets the only timer that could help.
- **"X reported the cause" needs independent resolution.** "The livelock affecting my PR" was the
  most-affected branch, not the cause.
- **A recency window can under-count a live radius.** The peer's newest 5 yields were all `12386`
  (it dispatches most); a trigger "watch for a second branch" was already satisfied five times — a
  trigger set against a windowed baseline can be pre-satisfied and dead.
- **Build the resume path, don't promise it** ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]).
  The `.ci30098_gate.sh` watch I built then fired forever once #30098 died —
  [[feedback_a_sentinel_pinned_to_an_instance_fires_forever]].

See also [[feedback_a_field_named_like_a_state_is_not_a_test_for_that_state]] (`started_at` on a
`queued` job), [[feedback_a_negative_grep_for_someone_elses_wording_is_not_a_negative_for_the_belief]],
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]],
[[project_slang_ci_zombie_runs_inert_not_gate_blockers]].
