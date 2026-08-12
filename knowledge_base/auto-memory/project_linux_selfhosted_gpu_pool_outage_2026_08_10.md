---
okf_version: "0.1"
name: project_linux_selfhosted_gpu_pool_outage_2026_08_10
description: "shader-slang/slang: BOTH Linux self-hosted GPU pools (Linux,self-hosted,GPU,GCP and ...,SM80Plus) stopped accepting jobs 2026-08-10T17:0xZ — 14.4h with zero runner assignments, 8 CI runs / 40 queued jobs. Windows,self-hosted,build and falcor-bridge are healthy, so it is these two pools, not self-hosted generally. Discovered while sanity-checking a PR#12464 CI caveat."
metadata: 
  node_type: memory
  type: project
  originSessionId: 38aa9de4-bdbb-406b-97e8-664448589d2c
---

# Linux self-hosted GPU pools dark since 2026-08-10T17:0xZ · 8 runs blocked

**Found 08-11T07:2xZ, not by looking for it.** The approver flagged that slang#12464's run
`31446085572` was `status: waiting` with `updated_at` frozen at 00:53:41Z and correctly called its
own red-job triage "a judgement at a partial head". I went to check whether the 5 queued jobs were
merely slow. They are not slow — **their runner pool has assigned nothing in 14.4 h.**

## Measured (commands named — ANCHOR G)

`gh api repos/shader-slang/slang/actions/runs/<id>/jobs?per_page=100` exposes per-job
`labels` + `runner_name`; `/actions/runners` is **403** to us, so label-set + assignment
timestamps are the only instrument (the workaround already recorded in
[[feedback_waiting_and_queued_are_two_different_blocks]]).

| label set | last runner assignment | age | state |
|---|---|---|---|
| `Linux,self-hosted,GPU,GCP` | `2026-08-10T17:01:23Z` (`linux-test-2873e722`) | **14.4 h** | 🔴 dark |
| `Linux,self-hosted,SM80Plus` | `2026-08-10T17:05:16Z` (`linux-sm80plus-4aaf565f`) | **14.4 h** | 🔴 dark |
| `Windows,self-hosted,build` | `2026-08-11T07:22:25Z` (`win-build-a1b4d932`) | 4 min | ✅ healthy |
| `Linux,self-hosted,X64,falcor-bridge` | `2026-08-11T06:43:56Z` (`kernelvm-falcor-bridge`) | 42 min | ✅ healthy |

⭐⭐**The healthy rows are the load-bearing half of this table.** Without them "self-hosted is
broken" or "GitHub Actions is degraded" both fit the GPU rows equally, and both would route the
escalation to the wrong owner. Windows self-hosted assigning a runner 4 minutes ago falsifies
them. **Two pools, not a platform.**

⚠️**Distinct from a starved/saturated pool** — this pool is *absent*, not busy. The
handoff-timestamp discriminator in the sibling leaf splits busy-vs-absent: a saturated pool shows
1-2 s handoffs between long jobs; here there are **no assignments at all** for 14.4 h while demand
is continuous. `runner_name=""` + `steps=0` cannot tell them apart on their own.

## Blast radius

**8 CI runs, 40 queued jobs** (5 per run, all on these two label sets), oldest 12.8 h:

```
31418856219 12.8h · 31442501782 7.7h · 31443242771 7.5h · 31446085572 6.7h (#12464)
31455227764  3.8h · 31460556242 2.1h · 31461777213 1.7h · 31464506768 0.9h (#12453)
```

⚠️**Not one closed set.** New PR runs keep arriving into it, so any count here is a floor with a
timestamp; the *rate of arrival into a dead pool* is the figure, not the total.

## Compounding: 12464 is ALSO behind the falcor-ci gate, and that freezes bot dispatch

`/actions/runs/31446085572/pending_deployments` → `env=falcor-ci`, **`wait_timer=0`**,
`wait_timer_started_at=null`, `current_user_can_approve=false`, reviewers `ci-approvers`.
`wait_timer=0` ⇒ **no elapsed-time path exists at any duration**; only a human clears it.
And `extras/ci/ci_priority_common.py:29` still has `ACTIVE_STATUSES = {"queued","in_progress",
"waiting","requested","pending"}` — **`waiting` is in the set**, so every bot CI dispatch yields
to it. 3 runs are `waiting` repo-wide right now (`31446085572` #12464/fix-issue-12440,
`31311092637` fknfilewalker, `31258367401` fix/issue-11981 — the last **since 08-08**).
Both mechanisms are re-verified live, not quoted: see the sibling leaf for the deadlock
derivation (a fresh dispatch resets the only clock that could free it).

⇒ **#12464's head cannot settle for two independent reasons.** Fixing the runner pool leaves the
falcor gate; clearing the gate leaves 40 jobs with nowhere to run.

## What it does NOT invalidate (approver's point, and it holds)

The 5 queued jobs are x86_64 Linux `test-slang`/`test-slang-rhi` — the PR's four new tests
**already passed** on linux-aarch64 (debug+release), macOS-aarch64 (debug+release),
linux-x86_64-**cpu** and windows-release-dx. So they would add platform breadth on tests green
elsewhere, **not a first execution of the changed paths.** The genuinely-unexecuted-anywhere piece
is the LLVM arm, a pre-existing hole. ⇒ the `WOULD_APPROVE` is not undermined by the outage; what
the outage removes is the *option* of waiting for a settled head.

## ⭐⭐⭐ The corpus is the fix, NOT more pages — measured on two edges

The approver tried to confirm the 14.4 h age and its probe **structurally could not**: it paged
`actions/runs?per_page=100` ×3 and reported *"none found in 3 pages"*, a window spanning
`05:52Z → 07:34Z` = **1.7 h** against a 14.4 h-old event. It caught this itself and reported the
check as unsound rather than as agreement. Same page count on the right corpus, measured on my
edge at 07:3xZ:

| corpus, 3 × per_page=100 | window | span |
|---|---|---|
| `actions/runs` (repo-wide) | `08-11T05:52Z → 07:34Z` | **1.7 h** |
| `actions/workflows/ci.yml/runs` | `08-06T18:19Z → 08-11T07:17Z` | **4.5 days** |

**Same depth, ~65× the reach.** Cause: only **3 of 100** repo-wide runs are `CI` — the list is
dominated by `status`, `workflow_run` and label-check workflows. ⇒ ⭐⭐⭐**"Page deeper" is the
wrong remedy for a wrong-corpus query, and it is the one that feels like diligence** — 10 pages of
repo-wide still would not reach yesterday. Also: the run under investigation
(`31446085572`) **is not in the 100 most recent repo-wide runs**, so the approver's first scan
reported `queued_now=0` for pools it had *directly observed* 5 queued jobs on. A population error
reads exactly like a negative result. (Recorded once already in the sibling leaf as "a per_page
bump does not fix a wrong-corpus query" — it recurred on a different edge the same week, which is
why it is restated here with the ratio.)

⇒ ✅**The trigger that catches it: a "none found" claim is a quantifier over a set, so name the
query AND its window.** `1.7 h` vs `14.4 h` fails on sight; `none found in 3 pages` does not.

## Still dark at re-measure

Re-ran the assignment probe at **07:39Z** (not quoted from the section above): zero assignments on
either label set across every `ci.yml` run created after 07:00Z. ⇒ **~14.6 h and ongoing.**
`Windows,self-hosted,build` and `Windows,self-hosted,regression-test,vulkancts` were both
assigning within minutes at that moment (approver-measured, independently: 07:25:03Z / 07:27:58Z),
so the control still holds on a second edge.

## ✅ RESOLVED 2026-08-11 — recovery confirmed by slang-discord-support, by positive signature

Coworker `slang-discord-support` reported recovery at 16:53Z, **confirmed by a positive execution signature, not an absent alarm**: 15 GCP-GPU Linux jobs completed on `linux-test-*`/`linux-sm80plus-*` runners, newest `16:14:47Z success`; the 44+11 backlog drained to 0 queued. ⇒ **Outage ran `2026-08-10T17:09:31Z → ≤2026-08-11T13:11Z` ≈ 20 h** (onset pulled earlier than my 17:0x reading by #12437's own `test-linux-*-gcc-x86_64` jobs completing 13:11–13:27Z on `linux-test-*`).

Two discriminator near-misses the coworker caught and I'm recording as reusable:
- ⭐⭐ **The GCP GPU pool is identified by RUNNER-NAME prefix (`linux-test-*`/`linux-sm80plus-*`), NOT by "linux" in the job name.** A first scan matched GitHub-*hosted* `test-linux-*-aarch64` and nearly reported recovery off the wrong pool. Same lesson as this leaf's label-set point, one layer down.
- ⭐⭐ **Master unfroze SEPARATELY and earlier** — `merge_queue_merge` at `09:13:47Z`, so the ~17 h freeze ended 09:13Z, not "ongoing". A carried headline would have escalated a resolved freeze; re-deriving caught it. (Same class as ANCHOR G: a stored figure re-ships as a live finding.)

⭐⭐⭐ **The durable finding outlives the incident: the depth-based alarm caught this ~14 h late. `total==0 AND queued>0` on the same pool for ≥2 frames fires ~14 h earlier and excludes the ~200 benign scale-up lags.** That predicate recommendation is the real carry-forward — filed as a post-incident draft at `issues-to-file/2026-08-11-linux-gcp-gpu-pools-zero-registered.md` (coworker's edge), needs a **human to file** (coworker has no GitHub write scope).

⚠️ Coworker's own frame was partial (`queue_partial: true` + a TLS x509 error on `?status=queued`), so its `jobs_queued: 0` was a **null reading, not a drained queue** — it correctly used direct live job reads instead. Recorded because "a partial frame's zero is a null, not a measurement" is the same trap as this leaf's wrong-corpus zero.

## Method note worth keeping

⛔**My first three corpus attempts each returned a true number about a set I had not chosen.**
`gh run list --limit N` and repo-wide `actions/runs?per_page=100` are dominated by non-CI
workflows (`status`, `workflow_run`, label checks), so a scan for CI test jobs found 0-3 rows and
looked like a clean history. `actions/workflows/ci.yml/runs?per_page=100` is the right corpus
(window `08-09T18:40Z → 08-11T07:17Z`, n=100). ⭐⭐**And `gh run view --json jobs` omits
`labels`/`runnerName`** — the field I needed to attribute an outage to a *pool* only exists on
`/actions/runs/<id>/jobs`. A scan that cannot see the label set can only report "some jobs are
queued", which is the symptom everyone already had. Also: I closed the completeness hole
explicitly (49 older runs scanned for any assignment later than 17:01:23Z — none), because
"newest N runs show nothing" is not "nothing happened".
