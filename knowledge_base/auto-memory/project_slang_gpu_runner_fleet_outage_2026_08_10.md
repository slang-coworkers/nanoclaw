---
name: project_slang_gpu_runner_fleet_outage_2026_08_10
description: "2026-08-10: slang self-hosted GPU runner fleet at ZERO ~3.5h, master blocked since 14:46Z, #12437 stuck. VERIFIED without runner-admin scope: in_progress_total=0 with 6 queued (4 real, 146-195min). jobs_queued>30 alarm read 20 — a total outage CANNOT trip a depth alarm. Alarm on AGE and total==0."
metadata:
  node_type: memory
  type: project
---

# 2026-08-10 — slang GPU runner fleet at zero; the monitored alarm could not fire

`slang-discord-support` reported a capacity outage. **I verified it from a different instrument than theirs, and mine needs no runner-admin scope:**
```
/actions/runners            -> 403 "Resource not accessible by integration"   <- same gap they hit
/actions/runs?status=in_progress -> total = 0          <- DECISIVE
/actions/runs?status=queued      -> total = 6
      195 min  31415341472  CI  (merge_group)      <- real
      159 min  31418387472  CI  (pull_request)      <- real
      154 min  31418856219  CI  (pull_request)      <- real
      146 min  31419527226  CI  (pull_request)      <- real
   110335 min  26435273307  Falcor Tests            <- 74-day zombie, known inert
   106664 min  26596502131  pages build             <- 74-day zombie, known inert
master last landing 2026-08-10T16:15:55Z (1ca1aa50e5)  <- /activity; my first figure 14:46:49Z was the BUILD time, see below
#12437  state=open  mergeable_state=blocked  updated 16:27:49Z
```
⇒ ⭐⭐⭐ **`in_progress == 0` WHILE `queued > 0` IS THE CAPACITY-OUTAGE SIGNATURE AND IT REQUIRES NO PRIVILEGED ENDPOINT.** Work exists and nothing is executing ⇒ servers are gone, not idle. **This is the instrument to reach for when `/actions/runners` 403s** — and it independently corroborates their `runner_groups 0/0` + last-GPU-job-started-17:20:20Z pair.

⚠️ **Their refusal to name the mechanism is correct and I could not close it either:** quota is not the limiter (T4 0–16/24, L4 0–5/80), yet quota read 16/24 at 18:51Z while `runner_groups` read 0/0. **"Autoscaler stopped registering" vs "runners went offline" is not separable without the runner-admin page**, which 403s for this token. ⇒ **Operator-only. Reporting the effect with the mechanism explicitly unattributed is the honest shape** (their words: *"mechanism deliberately not named"*).

## ⭐⭐⭐ THE MONITORING FINDING IS THE DURABLE ONE: A TOTAL OUTAGE CANNOT TRIP A DEPTH ALARM

Documented alarm is `jobs_queued > 30`. **During a total capacity outage it read 20.**
```
queue DEPTH climbs only while servers are BUSY accepting work;
when servers VANISH, depth FLATLINES at whatever was in flight.
busy == total also fails VACUOUSLY at 0/0  (0 == 0 is "healthy")
```
⇒ ⭐⭐⭐ **THE ALARM IS ANTI-CORRELATED WITH THE WORST FAILURE: the more completely capacity disappears, the less the depth metric moves.** ⇒ ✅ **Alarm on (a) OLDEST-QUEUED AGE — would have read 195 min — and (b) `total == 0`.** Age is monotone in badness; depth is not. **Same family as the watchdog whose `success` conclusion is blind to the condition it exists to clear, and as `busy==total` reading healthy at 0/0: a ratio or a delta can be vacuous where an absolute is not.**

## ✅ SCHEDULER BACKLOG IS THEIRS, NOT PLATFORM-WIDE — measured on my own edge

They flagged their wake delivered **3h22m late** (`process_after` 17:05, delivered 20:26) and asked whether other groups are affected. **Checked mine: `ncl tasks list` → tasks with `process_after` in the past = 0.** ⇒ **My scheduler is current; the backlog does not generalize from their group to the platform.** ⚠️ **But their process point stands and is the reusable half: A LATE WAKE IS INDISTINGUISHABLE FROM A QUIET ONE unless `process_after` is compared to `date -u`.** Their Discord channel went unscanned 16:58→20:27 and a user question aged 3h — **the silence looked like calm.** ⇒ **Every scheduled agent should print `now - process_after` at wake; it is one line and it converts an invisible failure into a visible one.**

✅ **Their 5-flagged-failures triage is the discipline I keep asking for: 5 findings, 5 DISTINCT causes, audited by ID before spending calls** — including correctly clearing `31406670536` as the designed bot-yield, and identifying human-PR failure `31408290048` as a REAL test failure because **its 5 GPU jobs are `success:5` and it predates the outage.** ⇒ **"Predates the outage + its GPU legs passed" is exactly the right discriminator against blaming infra for a code defect.**

## ⛔⭐⭐⭐ 21:10Z — I QUOTED 14:46:49Z AS "MASTER'S LAST LANDING". WRONG, AND MY OWN STORE HAS THE RULE.

The peer reported `16:15:55Z`; I reported `14:46:49Z` twice — to them and to the operator. **Settled by measurement, and they were right:**
```
/commits?sha=master  ->  commit.committer.date = 2026-08-10T14:46:49Z   sha 1ca1aa50e5
/activity?ref=refs/heads/master
                     ->  timestamp 2026-08-10T16:15:55Z  merge_queue_merge  after=1ca1aa50e5
```
⇒ **SAME SHA. 89-minute gap.** Under a merge queue the commit object is created when the queue BUILDS the candidate; it lands when the queue MERGES it. **`committer.date` timestamps the build, `/activity` timestamps the landing.**

⇒ ⭐⭐⭐ **THIS IS `technique_merged_at_not_committer_date_for_merge_time` VERBATIM — a leaf I wrote, which names `/activity?ref=refs/heads/master` as THE landing instrument for a series, and which records a peer retracting three consecutive wakes over the same 4.4h error.** I re-derived the wrong answer anyway, in a report to the operator, on a chain where the figure is load-bearing (*"how long has master been blocked"*). ⇒ ⭐⭐ **A RULE IN THE STORE DID NOT FIRE BECAUSE I NEVER ASKED WHETHER ONE EXISTED — the trigger has to be the QUESTION ("when did this land?"), not a memory of having been burned.** The `/commits` route is the one that feels like the obvious answer, which is exactly why it needs the guard.

⚠️ **Consequence for the escalation I already sent: my "master hasn't landed in 6 hours" understated by 89 minutes in the SAFE direction** (the real gap is shorter), so the conclusion survives — but the figure was wrong and the operator has it. **Correcting it upstream rather than letting it stand.**

## ✅ THEIR FOUR SELF-CAUGHT ARTIFACTS — all four are real instrument traps, and one nearly reported a false recovery

1. ⛔ **`started_at` is populated on `status=queued` jobs**, where it is a QUEUE timestamp, not an execution start ⇒ they briefly had *"RECOVERY: newest started job 20:48:21Z"* on screen. **Filter `status != queued` before reading `started_at`.** ⭐⭐ **A false RECOVERY is worse than a false alarm: it closes an incident.**
2. ⛔ **`?per_page=40` of the general run list spans ~20 minutes**, so it cannot contain a 200-minute-old queued run ⇒ their "GPU-labelled queued = 0" was a WINDOW artifact. Querying `?status=queued` directly: **20 GPU-labelled jobs queued.** **Same window trap as `#30105` being absent from `/actions/runs?per_page=100` this morning.**
3. ✅ **The control that caught #2: printing the EMPTY-LABEL count — 24 of 44 scanned jobs had empty `labels`.** ⇒ **A filter over a field that is frequently empty returns a true zero about a set you never saw; print the empty count beside the filtered count, always.**
4. ⛔ **In their own verifier: snapshot gone (`/tmp` lifecycle), so they hand-checked frontmatter and printed `title = *** LOST ***` — but 58 of 69 leaves have no `title` at all.** ⇒ ⭐⭐⭐ **ONLY A BASELINE DISTINGUISHES ABSENT FROM LOST, and the missing snapshot is precisely what denied them one. Without a baseline, report ABSENCE and refuse to call it LOSS — a checker that says LOST for ABSENT invents defects.** Their gate correctly refused; the hand-check is what mislabelled.

⇒ ⭐⭐ **Their own summary is the keeper: "all three would have shipped as measurements, and each was caught by a control rather than by care."** Four instrument artifacts in three consecutive commands, zero caught by attention.

✅ **Scheduler closed numerically on both edges:** theirs `process_after 21:05Z` vs `now 21:07:27Z` = **2.5 min ⇒ on cron, backlog cleared**; mine 0 overdue. ⚠️ **And their sharpening of my process point is correct: `ncl tasks list` shows `LAST RUN 7m ago` / `NEXT RUN due` and NEITHER answers "am I late" — only `now − process_after` does.**
