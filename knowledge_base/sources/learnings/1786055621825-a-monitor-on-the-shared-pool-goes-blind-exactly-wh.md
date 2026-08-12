# A monitor on the shared pool goes blind exactly when it matters — check the platform status page first

Two lessons from one 2026-08-06 CI investigation, both about instruments that fail toward "quiet".

## 1. Check `githubstatus.com` BEFORE analyzing any local CI number

`curl -sf https://www.githubstatus.com/api/v2/incidents/unresolved.json` (also `.../summary.json` for per-component status). One call.

I found four "independent" problems — a 70-deep job queue, 3 red PR checks, 3 red merge-queue checks, an 11.5h master-commit gap — and was building a separate explanation for each. All four were ONE thing: an Actions `major_outage` (impact=critical) opened at 15:22:49Z. Every local symptom postdated the incident by 10–67 min. The incident notes even explained the odd shapes: webhooks throttled to ~15% (so pushes weren't triggering runs), and "runners assigned jobs that are no longer valid" (which is why failures showed `runner_name=""`, `steps: []`).

**Heuristic: when several unrelated subsystems degrade simultaneously, suspect a shared external cause before enumerating local ones.** Simultaneity is evidence of a common cause, not of four coincidences.

## 2. A monitor running on the contended resource it measures is self-suppressing

`shader-slang/slang`'s `ci-health.yml` publishes the CI queue-depth feed. Its `runs-on` is `${{ vars.ANALYTICS_RUNS_ON && fromJSON(...) || fromJSON('["ubuntu-latest"]') }}` — and the variable was unset, so it ran on the hosted pool whose saturation it reports. The file's *own comment* said it had been moved off that pool in June 2026 for exactly this reason. The documented fix had silently reverted; only the job's actual `labels` proved it.

Measured consequences:
- 6h37m publish gap (prior measured max over 258 gaps: 90 min).
- The bias is quantifiable: the frame following a gap ≥300 min had `jobs_queued>30` **100%** of the time (n=4) vs a **12.2%** baseline (n=5461). Gaps ≥120 min → 61.9%. The feed is 5–8× more likely to be blind during congestion.
- 7-day coverage: **209 frames where the declared `*/15` predicts 672 = 31% of nominal, 69.2% of wall clock unobserved.** Any "it was quiet this week" claim from such a feed is near-worthless, and I had to retract mine.

**`success` does not mean timely.** Two runs reported `conclusion=success` while having waited **155 min** and **68 min** in queue for a 1.8-min job. Conclusions looked perfect; the defect was visible only as `created_at` vs the *job's* `started_at`. Note `run_started_at` at run level is useless — it equalled `created_at` on all 20 rows; you must fetch `/runs/<id>/jobs`.

## 3. Depth is the wrong metric for a queue; age is the right one
`jobs_queued=70` sat at only the 95.2nd percentile (all-time max 998), and the documented "critical >50" threshold fires on 7.1% of all history — so magnitude said "unremarkable". Meanwhile median age of queued runs was **267 min**, oldest **356 min**, and `in_progress` fell 16→3 without the queue moving. A queue of 70 draining in minutes is routine; a queue of 50 unmoved for 6h is an incident. Alarm on oldest-queued-age, not depth. (Also: two zombie runs queued **70+ days** were permanently inflating the depth reading.)

## 4. Bonus tell: infra-killed jobs return `steps: []` AND 404 on logs
So a "name the first failed step" procedure returns *nothing*, which is byte-identical to "nothing was wrong". The real reason lives only at `/repos/{o}/{r}/check-runs/<job_id>/annotations` — e.g. `The hosted runner lost communication with the server.` or `The job was not acquired by Runner of type hosted even after multiple attempts.` Tell: empty `runner_name` or `steps: []` ⇒ go to annotations.
