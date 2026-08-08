---
name: waiting-and-queued-are-two-different-blocks-on-one-job-name
description: "A required-reviewers gate yields run/job status='waiting' with a non-empty pending_deployments; a starved self-hosted pool yields 'queued' with runner_name='' and steps=0 — pr-12309 was the second, misreported as the first, and the falcor-bridge pool has ONE runner (11 rows, NOT the n=1 I first published) while two sibling Windows falcor pools have 2-3 — count runners BY LABEL SET; queued splits into busy-vs-absent by handoff timestamps."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-07, slang.** A peer reported that a new `falcor-ci` **required-reviewers** environment (landed via #11915, merged 12:03:50Z — verified: 3 files, `ci-falcor-test.yml` gains `environment: falcor-ci` at `:18`) had parked merge-queue head-of-line **pr-12309** on human approval for 124 min, and asked me to approve it and to decide a steady-state policy for queue traffic.

⛔ **The gate diagnosis was wrong for that run.** Measured on run `31179974395`:

```
run.status            = queued          ← a gate yields "waiting", never "queued"
pending_deployments   = []              ← an empty gate queue
job test-falcor       = queued, steps=0, runner_name="", labels=[Linux,self-hosted,X64,falcor-bridge]
merge_group runs (100 fetched)          → statuses {completed:97, queued:2, in_progress:1}, waiting: 0
```

⭐⭐⭐ **`waiting` and `queued` are two different blocks that render identically in prose as "stuck".** The discriminator is one field pair:

| block | `run.status` | `pending_deployments` | `runner_name` | `steps` |
|---|---|---|---|---|
| **required-reviewers gate** | `waiting` | **non-empty** (env + reviewers) | `""` | 0 |
| **starved self-hosted pool** | `queued` | `[]` | `""` | 0 |

Both show `runner_name=""` and `steps=0`, so **those two fields cannot separate them** — the separating field is `status` (`waiting` vs `queued`) plus `pending_deployments`.

✅ **The gate is real, just not on the run they cited.** Two *`pull_request`* runs were genuinely `waiting`, each with `pending_deployments=[{environment: falcor-ci, reviewers: [Team ci-approvers]}]`:
- `31187761893` — `add-callshader-support-to-optix`
- `31184917490` — **`fix/issue-10641`**, another coworker's own branch

⇒ ⭐⭐⭐ **The gate applies to `pull_request` and — on the evidence — NOT to what was blocking the merge_group entry.** `ci.yml` does fire on `merge_group: [checks_requested]` and calls the gated workflow with no event exclusion, so a merge_group run *can* hit the environment; but the actual post-gate merge_group falcor jobs measured **`completed/success` (12:03:52Z, 3 steps)** and **`in_progress` (13:37:56Z, 2 steps)**. **Queue falcor work is executing, not gated.**

⛔ **`current_user_can_approve = False` on both gated runs, reviewers = `Team ci-approvers`.** So the request *"only you can clear it"* is false for me: I am not on that team and the API refuses me. **A request to approve should be verified against `current_user_can_approve` before it is escalated to a human as actionable** — otherwise the escalation names the wrong actor.

## ⭐⭐⭐ THE REAL MECHANISM, which neither of us was looking for: the pool has ONE runner

```
falcor jobs with an assigned runner today = 1
DISTINCT runner names                     = 1   ['kernelvm-falcor-bridge']
in-flight simultaneously                  = 3   (pr-12309 queued, optix queued, fix/issue-10641 waiting)
```

⇒ **`falcor-bridge` is a single-runner pool, so falcor work SERIALIZES.** Three demands, one server: whoever is second waits for the first to finish, and that wait is `queued`, indistinguishable in a status column from a policy gate. **A long `queued` on a `self-hosted` label is a capacity question (how many runners serve this label?), not a policy question** — and the count is one query.

⚠️ **The gate still plausibly contributes, indirectly:** a gated `pull_request` run holds no runner while `waiting`, so it does not consume the single bridge — but once approved it will, ahead of or behind queue traffic. **The interaction between a one-deep pool and a human-approval gate is the thing to reason about, and it is invisible if you attribute the delay to either one alone.**

## ⭐⭐ What the peer did right, and it is the part to copy

They **withheld the alarm** after catching their own instrument defect: their first landing-gap read (`per_page=40`) said *"106 min, exceeds median 47"*, but that median was **a single sample** and the read had missed the newest landing. Three pages gave 26 landings ⇒ current gap **69 min = 24th percentile**, 19 of 25 historical gaps larger. ⇒ ⭐⭐⭐ **Truncated pagination can MANUFACTURE an alarm, not only hide one** — the same silent bound I hit twice today, third polarity. A short page biases a *median* as readily as it empties a *list*, and a median-of-one has no error bars at all. **Any threshold claim must carry its N.**

⇒ **Diagnosis and alarm are separable, and they got that ordering right: report the mechanism, withhold the alarm.** My correction is to the mechanism, not to the restraint.

See [[feedback_a_field_named_like_a_state_is_not_a_test_for_that_state]] (`started_at` set on a `queued` job — same endpoint, same trap family) and [[feedback_a_negative_grep_for_someone_elses_wording_is_not_a_negative_for_the_belief]] (the pagination bound, and why a cause you just proved gets over-attributed).

## ⛔ MY "ONE RUNNER" FIGURE WAS n=1 — the exact defect I had credited the peer for catching, two messages earlier

I wrote `falcor jobs with an assigned runner today = 1 → DISTINCT runner names = 1` and called `falcor-bridge` a single-runner pool. **That is a pool size inferred from ONE sample** — structurally identical to the "median 47 from a single sample" I had just praised them for catching. They widened it; the conclusion survived on real evidence, and I re-measured independently at higher N still:

```
my re-measure: 127 ci.yml runs scanned, 86 falcor job rows (08-06T19:00 → 08-07T15:41)
  [Windows,self-hosted,perf]             43 rows → 3 runners  SLANGWIN10X64-1, SLANGWIN4, SLANGWIN5
  [Windows,self-hosted,falcor]           32 rows → 2 runners  SLANGWIN4, SLANGWIN5
  [Linux,self-hosted,X64,falcor-bridge]  11 rows → 1 runner   kernelvm-falcor-bridge   ← ONLY
```

⭐⭐⭐ **`Test (Falcor)` runs under THREE different label sets, so "how many falcor runners are there?" has no single answer** — aggregate across them and you get 4+ distinct names and the bottleneck vanishes; sample only today's one assigned job and you get 1 from n=1. **Same right answer from a wrong-N instrument, which is the least informative kind of agreement.** ⇒ **Group runner counts BY LABEL SET, and report rows-per-group as the N.**

⚠️ **And my first re-measure attempt sampled only 4 rows** because `actions/runs?per_page=100` is dominated by non-CI workflows — the *repo-wide* run list is the wrong corpus for a question about one workflow. `actions/workflows/ci.yml/runs` paged to 127 runs gave 86 rows. **A per_page bump does not fix a wrong-corpus query.**

## ⭐⭐⭐ `queued` HAS TWO SUB-CAUSES THAT ALSO READ IDENTICALLY: a busy pool and an ABSENT pool (peer's, from their own near-miss)

They checked live bridge occupancy, got **empty output**, and were one step from reporting *"the runner is offline, this isn't serialization at all"* — a full refutation built on a too-narrow query (their occupancy loop searched only the 2 repo-wide `in_progress` runs; the bridge job wasn't in that slice). `/actions/runners` is **403** to both of us, so the pool cannot be inspected directly.

✅ **The instrument that works without that permission: consecutive job start/end timestamps on the single runner.**
```
08:55:43 → 09:45:47   50 min
13:31:29 → 14:14:47   43 min   (long idle before — genuine gap)
14:14:49 → 14:58:23   44 min   ( 2 s handoff)
14:58:25 → 15:41:44   43 min   ( 2 s handoff)
15:41:45 → 15:42:13    0 min   ( 1 s handoff)
15:42:14 → running now          ( 1 s handoff)
```
**1–2 second handoffs between 43–50 minute jobs ⇒ SATURATED, not dead.** pr-12309's 176-minute wait ≈ 4 job-lengths of backlog — **arithmetically expected, not anomalous.**

⇒ ⭐⭐⭐ **The actionable quantity is runners × job duration, not runner count.** `1 × 45 min` means every additional demand costs three quarters of an hour, and three simultaneous demands guarantee a >2 h wait **with nothing wrong anywhere**. A capacity diagnosis that stops at "one runner" cannot tell you whether a 176-minute queue is normal; the time constant is what makes it decidable.

⇒ **Full discriminator tree for a stalled-looking job:** `status=waiting` + non-empty `pending_deployments` ⇒ policy gate (find the reviewers, check `current_user_can_approve`). `status=queued` ⇒ capacity — then split *busy* from *absent* by consecutive handoff timestamps on that label set, since `/actions/runners` is 403.
