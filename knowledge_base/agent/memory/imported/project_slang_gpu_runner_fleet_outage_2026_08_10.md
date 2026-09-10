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
⛔⭐⭐⭐ **RETRACTED — SEE THE 23:00Z SECTION: run-level `in_progress` is NOT the signature. The corrected instrument is JOB-level.** (original claim retained:) `in_progress == 0` while `queued > 0` requires no privileged endpoint. Work exists and nothing is executing ⇒ servers are gone, not idle. **This is the instrument to reach for when `/actions/runners` 403s** — and it independently corroborates their `runner_groups 0/0` + last-GPU-job-started-17:20:20Z pair.

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

## ⛔⭐⭐⭐ 2026-08-11 — MY OWN INSTRUMENT RETRACTED BY THE PEER, AND I HAD ESCALATED IT TO THE OPERATOR AS DECISIVE

I published *"`in_progress == 0` while `queued > 0` is the capacity-outage signature"* and sent it upstream as the verification. **They refuted it. I re-measured and they are right about the defect, though not about it being "a constant":**
```
NOW:  /actions/runs?status=in_progress -> total_count = 4      <- NOT a constant; it does move
BUT:  /actions/runs?status=queued -> 4 real runs, EACH with jobs = {"completed": 34, "queued": 5}
      => a run whose RUN-LEVEL status is "queued" contains 34 COMPLETED jobs.
      => run-level status is an AGGREGATE LABEL, not a statement about what is executing.
```
⇒ ⭐⭐⭐ **THE RUN-LEVEL FILTER ANSWERS "ARE ANY RUNS WHOLLY UNSTARTED", WHICH IS NOT "IS ANYTHING EXECUTING". Same `conclusion`-style unit trap, third instance in 24h: run vs job.** My "decisive" reading was a run-level count standing in for a job-level question.

✅ **THE CORRECTED INSTRUMENT — count EXECUTING JOBS, not runs:**
```
in_progress JOBS inside the queued runs = 0   (per-run: [0,0,0,0,0,0,0,0])
queued     JOBS inside them             = 25  (per-run: [5,5,5,5,5])
```
⇒ **0 executing jobs against 25 queued jobs IS the starvation signature, and it is job-level.** The conclusion I escalated survives — but by a different measurement than the one I gave the operator, so **the figure was right for the wrong reason**, which is not a defensible position to have shipped.

⇒ ⭐⭐ **AND THEIR POSITIVE CONTROL FAILURE IS THE SHARPEST ITEM: their `nodejs/node` control returned an empty count that LOOKED like agreement and was actually `{"message":"Bad credentials","status":"401"}` — the gateway injects PER-PATH.** ⇒ **A cross-repo positive control silently becomes an auth probe. An empty result from a control validates nothing until you print the control's raw body.** This is the same per-path injection fact that bit them on `/rate_limit` yesterday, now in a NEW disguise (as a control rather than as a limit).

⇒ ✅ **THEIR SECOND RETRACTION CORRECTS MY RELAY TOO: "the GPU fleet is at zero" OVER-SCOPED A LINUX-ONLY OUTAGE.** Across 16 frames `Linux GPU (GCP)` + `SM80Plus` are `0/0` for 11 consecutive frames (~5.0h) while **Windows GPU served throughout (4/4)**. **I forwarded "GPU runner fleet" to the operator; the correct scope is LINUX GPU pools.** ⇒ **And the "quota 16/24 vs runner_groups 0/0 contradiction" I helped publish was THEIR OWN OMITTED ADDEND — against Linux+Windows busy, T4 reconciles exactly in 11/16 frames. So there was never a contradiction, and I passed it upstream as one.** ⭐⭐ **A "contradiction between two instruments" is the shape that most often turns out to be a missing term in my own arithmetic — check the addends before publishing the paradox.**

✅ **What survives, re-derived with anchors stated:** last Linux GPU execution `17:20:20Z`; last master landing `16:15:55Z` (`/activity`, not `committer.date`); #12437 in the merge queue since `17:42:14Z`; `jobs_queued` read **25** against a `>30` warning ⇒ **the documented alarm stayed silent through 5 hours**, which is the anti-correlation finding and is unaffected by either retraction. **Mechanism still unattributed (runner-admin 403s).**

## ✅⭐⭐⭐ 04:01Z — THE INSTRUMENT IS ASYMMETRIC, NOT CONSTANT. THEIR RETRACTION WAS OVER-CORRECTED AND THEY CAUGHT IT THEMSELVES.

They retracted `in_progress` as *"not an outage signature — it's a constant"*, then refuted their own retraction with one query. **Measured across three of my own samples tonight:**
```
21:0xZ  in_progress_total = 0
23:0xZ  in_progress_total = 4
03:53Z  in_progress_total = 2   (their reading; raw body printed, X-Ratelimit 6000/Used 1981 => proxy intact)
04:0xZ  in_progress_total = 0   (mine)
```
⇒ ⭐⭐⭐ **IT VARIES, SO "CONSTANT" IS FALSE — AND THE SURVIVING CLAIM IS ASYMMETRIC: `in_progress == 0` is NOT sufficient for "outage" (a run with mid-flight jobs can read `queued` at run level), while a NON-ZERO reading IS trustworthy.** One direction is evidence, the other is not. **My original "decisive" framing and their "constant" retraction are both wrong in opposite directions; the asymmetric form is the only supported one.**

⇒ ⭐⭐⭐ **THEIR META-FINDING IS THE KEEPER AND IT NAMES A GAP IN MY OWN PRACTICE: A RETRACTION IS A CLAIM AND NEEDS THE SAME TEST AS THE THING IT RETRACTS.** *"Constant"* is strictly stronger than *"does not discriminate here"*, and only the weaker was supported. ⚠️ **They over-corrected in the direction that made their own original error look WORSE** — third instance this session of an unaudited self-critical figure. ⇒ **A retraction that overshoots is not humility; it installs a new false claim, and its self-punishing direction is exactly what stops anyone from checking it.** ✅ **And they propagated the fix INTO THE LEAF, not just the report** — the 22:5xZ leaf had asserted the falsified *"bucket is ~always empty"* line, which would have left **a falsified instance under a true rule**: the welding pattern, self-caught.

✅ **THE DISCRIMINATOR THAT ACTUALLY WORKS — `runner_id`, verified on my edge with the null control:**
```
newest jobs with a REAL runner_id (12 runs scanned): 04:01:08Z rtx-remix-shader-test, 03:52:16Z retry,
   03:49:46Z slashCommandDispatch, 03:44:31Z board-sync ... all GitHub-hosted
control: runner_id null = 9  /  real = 11   (of 20 scanned)
their split: Windows GPU 11 real-runner jobs, newest 03:28:30Z => ALIVE
             Linux GPU    5 real-runner jobs, newest 2026-08-10T17:05:16Z => DEAD, 10 queued
```
⛔**RETRACTED — `runner_id != null` PASSES A QUEUED JOB (sentinel `0`). Corrected discriminator is `runner_name` NON-EMPTY; see the 04:34Z section.** (original:) `runner_id != null` means "this occupied a machine", and the null rate is huge (9/20 here, 25 of 40 Linux-GPU jobs `completed/skipped` with `runner_id=null` on their edge).** ⇒ **`skipped` IS NOT EXECUTION — counting skipped jobs as activity reported a "1.3h-old execution" that never touched hardware.** And **`labels` is unusable as a filter: 408 of 554 scanned jobs have EMPTY labels** (populated on `queued`, absent on many completed) ⇒ **a label filter returns a true zero about a set never inspected.**

⇒ ⭐⭐⭐ **THEIR 10× PAGING ARTIFACT IS THE ONE I WOULD HAVE SHIPPED: their loop `break`ed out of page 1 on first hit and read page 2 (OLDER), returning 08-09T01:17 as the NEWEST Linux GPU execution => "50.6h".** ⇒ **When paging to widen a search for a NEWEST value, an early `break` INVERTS the answer — exhaust the newest page first.** Caught pre-publication.

✅ **CORRECTED ESCALATION SHAPE (their ask, and it is right): carry the ANCHOR, not a duration** — *"Linux GPU pools have served nothing since 2026-08-10T17:05:16Z"* — plus the corrected `in_progress` semantics so the operator does not read a `0` as proof in either direction. **Windows GPU is alive (03:28:30Z); the outage is Linux-only.**

✅ **And my 667-vs-1,194 index repair reproduced on their edge: their banner figures were DATED (so honest) but described 08-09 — 13,920 bytes / 67 rows against a live 15,370 / 69.** Fixed the same way: dated + an explicit *"NEVER QUOTE A FIGURE FROM THIS INDEX"* with the derivation commands. ⇒ **Compaction shortens hooks: rules and triggers survive, enumerated instances and figures do not. The index is a router, never a source.**

## ⛔⭐⭐⭐ 04:34Z — THE DISCRIMINATOR I ADOPTED AND USED IN MY OWN CONTROL IS WRONG. A QUEUED JOB RETURNS `runner_id: 0`, NOT NULL.

They handed me `runner_id != null` 30 minutes earlier; **I used it in my own null-control (9 null / 11 real) and passed it upstream.** They then refuted it and I reproduced the refutation exactly:
```
jobs inside queued runs, three states enumerated:
   132  completed   | real runner_id | named
     4  in_progress | real runner_id | named
    20  queued      | runner_id = 0  | runner_name = ""      <- THE SENTINEL
  e.g.  status=queued runner_id=0 runner_name="" test-linux-debug-gcc-x86_64 / test
```
⇒ ⭐⭐⭐ **`runner_id != null` PASSES EVERY QUEUED JOB.** So the filter dates an outage from a job that never ran — **on their edge it reported an 11.3h outage as ~30 minutes, a 22× understatement that reads as RECOVERING.** ⇒ ⭐⭐⭐ **THE ERROR DIRECTION IS THE DANGEROUS ONE: a false recovery closes an incident, where a false alarm merely costs a check.** Second time in one night that a queued-state field masqueraded as execution (the first was `started_at` on queued jobs).

✅ **CORRECTED: `runner_name` NON-EMPTY.** Verified — all 20 queued rows read `runner_name=""` while every completed/in_progress row is named.

⇒ ⭐⭐⭐ **THE GENERALIZATION, WHICH IS THE REAL LESSON AND APPLIES TO EVERY ABSENCE-BASED PREDICATE I WRITE: A SENTINEL IS NOT A NULL.** `null`, `0`, and `""` were **three different states** here and only one meant what the predicate claimed. ⇒ **When adopting "field X is absent" as a discriminator, ENUMERATE THE FIELD'S ACTUAL VALUES ACROSS ALL STATES first** — one `group_by` over `(status, field-shape)` would have shown it, and that is the query I skipped when I adopted their instrument instead of testing it.

⇒ ✅ **AND THE SAME TRAP ONE LEVEL UP, WHICH THEY CAUGHT PRE-PUBLICATION: AN ABSENT KEY IS NOT `total: 0`.**
```
02:00:16Z / 02:50:13Z  runner_groups keys = [Linux GPU, Linux SM80Plus, Windows]   <- "Windows GPU" ABSENT
04:13:27Z              keys = [..., Windows GPU]  busy 4 / total 4                 <- present, serving
```
**Rendering absence as `0/0` would have fabricated "Windows GPU died for three frames" — the INVERSE of the truth** (newest Windows GPU execution 04:07:24Z). ⇒ ⭐⭐ **The Linux pools appear in EVERY frame with `total: 0`, which is exactly why their zero is a MEASUREMENT and the Windows gap is NOT. Three states to separate before any absence-based claim: present-and-zero · present-and-sentinel · absent.**

✅ **Anchor updated (theirs, re-derived): Linux self-hosted GPU pools have served nothing since `2026-08-10T17:09:31Z`; 35 jobs queued across the two dead pools; master frozen behind merge-queue run `31415341472`; Windows GPU alive; GCP quota NOT the limiter (T4 4/24, L4 0/80); mechanism still unattributed (runner-admin 403s).**

⚠️ **Process note they self-corrected, matching my own deferred-reshard error: their log hit 205 lines — over threshold — and their previous artifact had said "trim next wake." "A threshold noted is not a threshold acted on."** Trimmed 205→101 by resolution, and the byte reconciliation done **bytes-to-bytes** rather than repeating the chars-vs-bytes false alarm. ✅ **And "a re-offered frame is not a new event"** — the precheck re-served the identical `04:13:27Z` snapshot with only `ci_frame_age_min` changed, and they spent nothing on it.

## ✅⭐⭐⭐ 08-11 09:00Z — THE BASE-RATE FINDING IS THE ONE THAT MAKES THE ALARM CORRECT, AND IT REFINES WHAT I ESCALATED

Verified independently: **master is STILL frozen at `2026-08-10T16:15:55Z` (`/activity`) = 16.7h**, and `#12437` remains `mergeable_state=blocked`, untouched since 16:27:49Z.

⇒ ⭐⭐⭐ **THEIR BASE-RATE MEASUREMENT KILLS THE NAIVE ALARM I FORWARDED: `total==0` ALONE IS PRESENT IN 1119 FRAMES BACK TO 2026-02-27 — the pool scales to zero BY DESIGN when idle.** So *"alarm on `total == 0`"*, which I sent the operator, would fire constantly. ⇒ ✅ **CORRECTED PREDICATE (theirs): `total==0` AND `queued>0`, sustained ≥2 CONSECUTIVE FRAMES** — because even the conjunction is usually one frame of scale-up lag. **Would have fired ~14h earlier.** ⭐⭐ **A condition that is normal 1119 times is not an alarm; the alarm is the CONJUNCTION plus DURATION.** I had the anti-correlation half right (depth can't rise during a total outage) and the replacement half wrong.

⇒ ⭐⭐ **AND THEIR EPISODE RANKING IS THE RIGHT WAY TO SIZE IT: as episodes, this is an outlier on DURATION × DEMAND — the only longer one (26.0h, 2026-03-07) had peak queue 4 and was harmless.** ⇒ **Rank incidents on the product, not on either factor; a long idle scale-down and a short starvation are both unremarkable.** ⚠️ **They also flagged `jobs_queued: 64` as a SINGLE-FRAME spike (prior 9 frames 30–41) and refused to lead with it — the sustained claim is the 15.5h capacity failure, not the depth number.**

✅ **Scope narrowed AGAIN, correctly, and this is the third narrowing: not "the GPU fleet", not "Linux self-hosted", not "GCP" — it is the `Linux GPU (GCP)` + `Linux SM80Plus GPU (GCP)` pools specifically. `falcor-bridge` Linux runners ARE serving.** ⇒ **I forwarded two of the three over-broad scopes upstream; each narrowing came from them measuring a pool I had lumped in.**

✅ **Their job-level instrument is now correct and controlled, and it supersedes every version either of us used tonight:**
```
predicate: status == "queued" AND runner_name empty
   Linux-GPU 24/24 and SM80Plus 6/6 queued jobs have EMPTY runner_name
   vs Windows-GCP-T4 29 named · Windows self-hosted 27 · GitHub-hosted 119
same-run control: 31471009070 — Linux jobs queued WHILE win-test-df402849 executes in that run
pre-onset control: 31400043939 — 5/5 names populated, all success  => the instrument VARIES
```
⚠️ **And the trap they caught that would have inflated the count: run `31466792212` has 37 jobs with empty `runner_name` but `conclusion: skipped` — SKIPPED JOBS ALSO REPORT EMPTY `runner_name` AND EMPTY `labels`.** ⇒ **Co-occurrence, not cause: that run never submitted a job to the pool.** **Zero of the 5 flagged failures are outage fallout.** ⇒ ⭐⭐ **THE FULL SENTINEL INVENTORY FOR THIS API, EARNED OVER FOUR CORRECTIONS: `runner_id: 0` defeats `!= null` · `started_at` is populated on jobs that never ran · empty `runner_name`/`labels` also means SKIPPED · run-level `status` is an aggregate over jobs. Only `status=="queued" AND runner_name empty` isolates starvation.**

⛔ **ONE ITEM IN THEIR NEXT-ACTION LIST IS ALREADY DONE — measured: `#12446` (jvepsalainen-nv, "On-demand IR loading for builtin modules", open, non-draft) ALREADY CARRIES `pr: non-breaking`.** ⇒ **The "one standing human action" is satisfied; re-escalating it would have spent operator attention on a closed item.**
⛔⭐⭐⭐ **BUT MY DIAGNOSIS OF *WHY* WAS FABRICATED, AND THEY RESOLVED IT TO A TIMELINE EVENT. Verified:**
```
/issues/12446/timeline -> 2026-08-11T08:50:45Z  labeled "pr: non-breaking"  by = jvepsalainen-nv
their subagent measured labels: [] at 08:43:28Z   <- TRUE AT THAT MOMENT
they published at 08:53                            <- window = 2m15s, and the AUTHOR closed it
```
⇒ **So it was NOT "a list item persisting across wakes after the world satisfied it" — there was no prior wake to carry it from. It was a fresh measurement racing a fix, closed by the author, not an operator.** My conclusion (*drop #12446*) was right; **the habit I prescribed was aimed at an error they did not make.** ⇒ ⭐⭐⭐ **THE CORRECT HABIT IS THEIRS AND IT IS DIFFERENT IN KIND: TIMESTAMP THE OBSERVATION — "as of 08:43:28Z, `labels: []`" — so a 10-minute-old state claim cannot read as live. A 2-minute race is NOT reliably closed by re-checking; only by dating the claim.** ⚠️ **And I have now twice inferred a habit-level fault from a correct-conclusion-wrong-mechanism read** (the other: the blob-drift story). **A right verdict does not license a diagnosis.**

⇒ ⭐⭐ **THEIR OWN PROCESS NOTE IS THE SHARPEST ITEM: they nearly accepted my "you carried a stale item" and wrote themselves a self-diagnosis for an error they had not made.** Resolving the subject to a timeline event *before* conceding is what separated *"my read was wrong"* from *"the world moved 7 minutes later."* ⇒ **A concession is a claim: resolve the subject before accepting blame** — the mirror of my own rule that a retraction needs the same test as the thing it retracts, and the third instance this session of an unaudited self-critical claim.

⚠️ **AND A REAL CAVEAT ON MY SENTINEL TABLE, which I published as though self-validating: `status=="queued" AND runner_name empty` isolates starvation ONLY where no `completed/skipped` rows are mixed in.** Their aggregate is trustworthy because they confirmed **zero skipped rows** in those runs; where both shapes mix (`31471338530`: 12 skipped-and-empty) the predicate needs `conclusion` read FIRST. ⇒ ✅ **Carry it as "read `conclusion`, THEN apply the predicate" — a conjunction is not a filter until you know which populations are present.**

⚠️ **Second recurrence of the backlogged wake: `process_after 05:20` → delivered 08:41 = 3h21m late, with two identical frames delivered.** First occurrence was group-local; this is now a pattern rather than an incident, and it is why a 15h outage went ~5 wakes without a draft being written.
