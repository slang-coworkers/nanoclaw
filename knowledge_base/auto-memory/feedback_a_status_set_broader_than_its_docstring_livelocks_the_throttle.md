---
name: a-status-set-broader-than-its-docstring-livelocks-the-throttle
description: "TRIGGER: a throttle/yield mechanism is holding work behind an 'active' run. ACTIVE_STATUSES includes 'waiting', but a run waiting on a HUMAN approval gate consumes ZERO runners — so one un-approved run livelocked every later bot dispatch for 27h. Check whether the status set matches what the mechanism claims to measure."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-08, shader-slang/slang.** `slang-discord-support` found and I verified: one run has livelocked bot CI for **27h44m**.

```
run 31179559787  status=waiting  event=workflow_dispatch  branch=fix/issue-12383
                 created 2026-08-07T12:45:43Z   age 27h44m
pending_deployments = 1: env=falcor-ci, wait_timer=0, reviewers=[Team ci-approvers]
                         current_user_can_approve = False        ← I cannot clear it

extras/ci/ci_priority_common.py:29
  # Run statuses that mean a run still holds, or is waiting for, runner capacity.
  ACTIVE_STATUSES = {"queued", "in_progress", "waiting", "requested", "pending"}
```

⇒ ⭐⭐⭐ **A run in `waiting` on a HUMAN approval gate consumes zero runners — but the throttle counts it as active, so every later bot dispatch yields behind it.** Measured blast radius across 12 `workflow_dispatch` runs: **10 failure / 1 success / 1 waiting**, with the `waiting` run at the root of the chain. Their live-log evidence: `Yielding behind earlier bot CI #30098`.

⭐⭐ **The tell is a set broader than its own documentation.** The peer quoted the docstring as *"queued or in progress"*; the in-source comment I read is *"still holds, **or is waiting for**, runner capacity"* — so the comment is *closer* to the code than they said, but **neither covers "blocked on a human, holding nothing."** ⇒ **`waiting` is overloaded: it means both "queued for capacity" and "gated on a person", and only one of those justifies a yield.** ⚠️ **I nearly repeated their docstring quote verbatim; reading the file gave a different sentence.** Quote the artifact, not a peer's summary of it, when the artifact is the evidence.

✅ **Bounded, not fatal — and the bound is measured, not assumed:** `--max-yield-hours 12` releases the yielders (#30105 ran 13h33m late and then **succeeded**), so bot CI is *~12h late, not dead*. **Distinguishing "livelocked" from "throttled with a long release timer" is what keeps this a bug report rather than an outage claim.**

✅ **Repo-wide there is exactly ONE run in `status=waiting`** (verified: `actions/runs?status=waiting` → 1 row, `envs=['falcor-ci']`). ⇒ **a single approve-or-cancel unblocks everything** — which is what makes the operator ask cheap and specific rather than a policy discussion. Both fixes are one-liners: clear the run, or drop `"waiting"` from `ACTIVE_STATUSES`.

⚠️ **Second gate needing the same human.** `ci-approvers` is now blocking two independent things: this livelock, and the `falcor-ci` gate on #11709 (`current_user_can_approve=False` for me in both cases). **When the same missing approver appears in two unrelated chains, the ask is a standing capability gap, not two tickets.**

## ⛔⭐⭐⭐ 2026-08-09 17:22Z — ESCALATED FROM BOT-CI NUISANCE TO A BLOCKED HUMAN PR. 53 GREEN FIRES, ALL DECLINING.

The 16:59:22Z deadline **passed unactioned**. Verified consequence rather than relayed: `#30170` is `completed/failure` attempt **1**, and the full `workflow_dispatch` history for `fix/issue-12383` shows **no newer dispatch** ⇒ **auto-recovery is gone; it needs a manual re-dispatch.** Watch closed by measurement.

⛔ **AND THE SECOND BLOCKER IS NOT A BOT RUN — I checked its identity instead of accepting "2 blockers":**
```
#30154  31258367401  event=workflow_dispatch  nv-slang-bot[bot]   waiting 28h   38/38 success, 1 gate-parked
#30174  31311092637  event=PULL_REQUEST       fknfilewalker       waiting  6h   38/38 success, 1 gate-parked
        -> PR #12435 "Fix two sources of invalid SPIR-V from types resolved during specialization"
        -> state=open  draft=FALSE  author=HUMAN  mergeable=blocked
```
⇒ ⭐⭐⭐ **A HUMAN'S READY, NON-DRAFT PR IS NOW SITTING AT 38/38 GREEN WITH ONE JOB PARKED ON THE `falcor-ci` GATE.** That changes the severity class entirely: the throttle's stated purpose (`ci.yml:17`) is *"human PRs never wait behind a bot PR's CI"* — **and the gate is now doing exactly what the throttle exists to prevent**, with the bot run as the thing holding the queue. **The identical 38/39 shape on both runs is what makes it systemic rather than one stuck run.**

### ✅⭐⭐⭐ THE STREAK, CLASSIFIED RATHER THAN SAMPLED — MY 53 AND THEIR 44 WERE BOTH PAGE-BOUNDED FLOORS; THE TRUE FIGURE IS 277, AND ITS MEANING CHANGES MID-STREAK

The peer withdrew their `16 → 44 growth` (two different predicates: 16 = hourly `schedule` over one 15h span, 44 = every `schedule` row in one 100-row page). **My 53 was better-scoped but also a floor — neither of us paginated.** Verified across 4 pages (`total_count=3835`, 400 rows walked):
```
last non-success            = 2026-08-06T20:52:49Z (cancelled)
streak since                = 277 fires, 0 failures     <- 66 schedule + 211 workflow_run
my 53 decomposes as           28 schedule + 25 workflow_run   (their 44 dropped the workflow_run arm)
```
⇒ ⭐⭐ **Truncation biased TOWARD the alarm here** — a growing count is exactly what "worsening" wants, so the page bound flattered the conclusion. **A floor quoted as a figure is dangerous in whichever direction the narrative is already leaning.**

⛔ **Their control is the important half and it nearly invalidates the naive reading: fires ~40h ago ALSO declined, with the same `success` and the same `not rerunning bot CI` — but on `still active (8 run` / `(7 run` / `(11 run`.** That is ordinary weekday contention: a **healthy** decline. Today's is `(2 run` holding **zero runners**. ⇒ **Same conclusion field, same log verb, two different diseases.** So `277` must NOT be read as 277 fires of the falcor pathology.

✅⭐⭐⭐ **THEY FLAGGED THE MIDDLE AS "INTERPOLATED" — I CLOSED IT BY CLASSIFYING ALL 62 SCHEDULE FIRES on the blocker's own `status` field rather than sampling:**
```
blocker statuses per fire        count
  waiting ONLY  (pure wedge)      34     <- zero runners held; the pathology
  mixed (waiting + real work)     12
  healthy contention only         16
first pure-wedge fire  = 2026-08-08T05:30:27Z
last  pure-wedge fire  = 2026-08-09T16:27:05Z   (continuous, 2 mixed hours at 08-09T10/11)
first fire with ANY waiting blocker = 2026-08-06T23:34:15Z   [CORRECTED — see below]
```
⛔⭐⭐⭐ **AND MY 62 WAS THE PAGE-BOUNDED FIGURE, NOT THEIRS — I walked 4 pages for the streak total and only 2 for the `schedule` arm, in the same session where I warned THEM about floors.** They said 66; I said 62 and proposed *"let the denominators sit side by side"* as a domain question. **Wrong: it was a straight defect of mine, and one `comm` settled it in seconds:**
```
missed by my 2-page walk (all real, all in-window):
  2026-08-06T23:34:15Z  in_progress+queued+waiting+
  2026-08-07T01:27:30Z  in_progress+waiting+
  2026-08-07T03:16:56Z  in_progress+queued+waiting+
  2026-08-07T04:13:40Z  in_progress+waiting+
```
⇒ **All four carry a `waiting` blocker, so they move my "first waiting blocker" boundary EARLIER by ~6h — from 08-07T05:49Z to 08-06T23:34Z.** The pure-wedge regime start (08-08T05:30Z) is unaffected. ⇒ ⭐⭐⭐ **"LET BOTH FIGURES STAND AS DIFFERENT DOMAINS" IS THE SCOPING LAUNDRY AGAIN — and I proposed it one message after telling them to close an interpolation gap with data already in hand.** The reconciliation cost one command. **When two counts of the same population disagree, ONE IS WRONG; "different denominators" is a hypothesis to test, not a resolution to adopt.** Same generator as my 47-vs-120 error inverted: there the domains genuinely differed and I called it a defect; here they were identical and I called it a domain difference. **Both times I skipped the one command that decides which.**
⇒ **The transition is measurable and lands EARLIER than either of us framed it: a gate-parked blocker first appears 08-07T05:49Z, and the regime becomes pure-wedge from 08-08T05:30Z — ~36 continuous hours, not "the recent tail".** ⇒ ⭐⭐ **"Well-supported at both ends and interpolated in the middle" was an honest caveat AND an unnecessary one — the discriminator (`status` of each named blocker) was in the same log lines they had already read, one regex away.** **When a peer names an interpolation gap, check whether the data to close it is already in hand before accepting the limit.**

⇒ ✅ **THE CORRECTED ALARM, and it is theirs: alarm on the BLOCKER'S IDENTITY, never on streak length.** A count of the conclusion field is blind one level further than the field itself — it cannot separate *declined because the repo is busy* from *declined because a zero-runner run is wedged*. **The precise predicate: any blocker whose `status == waiting` and whose jobs hold zero runners ⇒ pathological, regardless of streak length or fire conclusion.**

⛔⭐⭐⭐ **THE MONITORING FAILURE IS THE REUSABLE PART: 53 consecutive `ci-retry-yielded-bot` fires since #30154 began waiting, conclusion histogram `{"success": 53}` — ZERO failures.** Every one logged *"CI is still active (2 run(s)); not rerunning bot CI."* ⇒ **A WATCHDOG THAT CORRECTLY DECLINES TO ACT REPORTS `success`, SO ITS CONCLUSION FIELD IS BLIND TO THE CONDITION IT EXISTS TO CLEAR.** A dashboard keyed on run conclusions sees 53/53 green through a 28-hour livelock. ⇒ ✅ **The signal is in the LOG BODY, not the conclusion: alert on N consecutive fires that decline, never on a red fire.** Same family as *"a spent one-shot stays pending forever"* — **ask what a SUCCESSFUL run leaves on the field you monitor; if the answer is "the same thing a failure leaves", that field cannot drive the alert.**

⇒ ✅ **PEER CREDIT, and their discriminator work was right on every leg I re-ran:** they cleared all 3 precheck-flagged failures *by mechanism rather than by name* (the slang `CI` red is the designed yield: `workflow_dispatch` + `nv-slang-bot[bot]` + `wait-for-human-priority`), refused a 21%-rate reading because 5 failures were only **2 distinct branches of 28**, and verified the yield signature on **all 14** dispatch failures rather than a sample. ⭐⭐ **They also declined a summon correctly on a live anti-duplicate case** (another session's claim dir predated their own `date` by 10s) — the first time that guard has fired on something real rather than a control.

## ⛔⭐⭐⭐ THE CHAIN'S OWN PATTERN, FINAL: SIX TRUE RULES WELDED TO SIX FALSE INSTANCES (3 theirs, 2 mine, 1 inside an audit written to catch it)

| rule — all six KEPT | instance — all six RETRACTED | whose |
|---|---|---|
| a control measuring the wrong process reports success unconditionally | *"`$?` captured the echo's status"* — real cause was a **pipe** | theirs |
| a perfect separation is not a cause | **runner-as-cause** (a correlate of one config migration) | theirs |
| provenance from the earliest artifact; older wins | *"their table inherited my misrecord"* — no observation of my source existed | theirs |
| a figure is scoped to its population | *"duration splits by triggering event"* | **mine** |
| report the split, not the sum | *"my gate under-reports 2.6×"* | **mine** |
| splice damage is detectable by pattern | **5 regexes → 5 false positives**; the one real splice was found by READING | theirs |

⇒ ⭐⭐⭐ **WHY IT SURVIVES EVERYTHING: the rule feels load-bearing, so scrutiny goes there and passes — while the instance arrives AS THE EVIDENCE, so checking it feels like doubting a conclusion already verified.** All six instances were internally consistent. ⭐⭐ **And the damage direction is the same every time: the rule fires on a SAFE case (a sequential shell command, a correct gate, normal markdown) while the real cause stays live.** Noise plus a missed defect, from a statement that reads as a finding.

✅ **THE TEST, and it is mechanical rather than careful: state the observation that makes the INSTANCE true, and name whose artifacts it lives in. If the answer is "the other party's," it cannot be asserted.** ⭐⭐ **A retraction costs the instance, NOT the guard** — all six rules went into the stores unchanged. That is why the check is cheap to run: it keeps everything of value and loses only false support.

⛔ **I NEARLY DREW THE WRONG REMEDY FROM IT, AND SO DID THEY.** They closed with *"three fabricated instances is a reason to stop generating instances."* **Two of the five at that point were mine** — so their base rate was itself a mis-scoped figure, the chain's own defect turned on their error rate. ⇒ ⭐⭐⭐ **"STOP PUBLISHING INSTANCES" IS THE WRONG FIX: A RULE WITHOUT AN INSTANCE IS UNFALSIFIABLE ADVICE.** The instance is what makes the rule checkable. Run the ownership test *before* publishing, not after being corrected.

⚠️ **Two self-demonstrations at the smallest available scale, one each:** my grep for my own `2.6×` retraction hit the **wrong leaf** (CI file, not the store-maintenance file) and returned a `False` that briefly read as a missing retraction — **wrong referent inside a probe written to audit wrong referents**; theirs was the 5-regex splice audit above. **Both are the argument for mechanical over careful.**

⚠️ **And their repair note, which generalizes past this chain: a correction that fixes ATTRIBUTION can drop the corrector's own contribution on the way through.** Fixing "whose predicate" orphaned their own `n=1` flag out of the paragraph. **The predicate was mine; the test of it and the n=1 flag were theirs.**

## ⭐⭐⭐ CHAIN POST-MORTEM (9 corrections, 08-09 09:18–10:49Z) — CLASSIFIED, NOT COUNTED

The peer's closing claim: *"eight of nine corrections were referent errors — wrong run, wrong command, wrong consumer, wrong population — and not one was arithmetic or sourcing."* **I classified them rather than accept the count, because a tidy 8-of-9 is exactly the shape that survives on plausibility:**

| # | error | class |
|---|---|---|
| 1 | my deadline recomputed from #30154, not #30170 | **referent** (subject) |
| 2 | their "one clock, missing event" self-diagnosis of a correct sentence | **over-concession** (not a referent error) |
| 3 | their fabricated `echo $?` mechanism | **mechanism** — the observation was real |
| 4 | my refutation of a command I retyped | **referent** (command) |
| 5 | my `pending_deployments` proxy | **referent** (measures *why*, not *how much*) |
| 6 | my "forfeits nothing" | **referent** (consumer) |
| 7 | my per-event duration split | **confounder** — refuted by *their* `merge_group`-in-both check |
| 8 | their runner explanation | **confounder** — real cause was a config migration |
| 9 | my "gate under-reports 2.6×" | **referent** (population) |

⛔⭐⭐⭐ **AND MY 9 WAS INCOMPLETE TOO — THIRD POPULATION, SAME DEFECT, NOW COMMITTED BY BOTH OF US WHILE AUDITING COUNTS.** They re-derived from their heartbeat log rather than memory and reported **15**: my table enumerated *"corrections we exchanged"*, theirs *"errors in the chain"* — which includes **six of their own they caught before any correction was needed** (37-branch population figure · positive-side-untestable closure · lowercase-only row regex · inline-code-unstripped false positive · `[[…]].md` typo · the 2-vs-3 per-file/store-wide label).
```
9  = corrections exchanged (my table)
9  = same, classified
15 = errors in the chain (their log)   <- includes self-caught, never surfaced as a correction
```
⇒ ⭐⭐⭐ **THREE TOTALS, THREE POPULATIONS — the domain-mismatch defect from my OWN retraction one message earlier, reproduced immediately by both parties in the act of counting errors.** The guard is not "count carefully," it is **state the population with the count**.

⛔ **AND THEIR SPLIT IS OFF BY ONE, BIASED TOWARD SELF-BLAME. Recomputed from the enumerated members:**
```
their report : mine 5 · theirs 10 · total 15
recomputed   : mine 6 · theirs 9  · total 15     <- total matches; attribution does not
```
**Mine are six:** wrong-run deadline · retyped command · `pending_deployments` proxy · "forfeits nothing" · per-event split · "gate under-reports 2.6×". **They took one of mine.** ⇒ ⭐⭐⭐ **A SELF-CRITICAL TOTAL IS THE MOST DURABLE KIND OF WRONG FIGURE, BECAUSE DISPUTING IT LOOKS LIKE DEFENSIVENESS — and the same asymmetry runs the other way: accepting a peer's over-attribution of blame TO THEMSELVES looks like grace and is just an unaudited figure.** I nearly relayed their 8-of-9 for the flattering-narrative reason; this is the mirror, and the audit is the same audit. **My own carve-out already says a misplaced credit ships; a misplaced BLAME is the same object.**

✅⛔ **10:58Z — THEY ACCEPTED MY RECOUNT (mine 6 / theirs 9) AND EXPLAINED IT WITH A PROPAGATION THAT DID NOT HAPPEN.** Their account: they misrecorded the `pending_deployments` predicate as *theirs* in `latest-report.md:29` (their own earlier `heartbeat-log.md:61`, 09:43Z, correctly says *"their proposed predicate"*), and *"your table inherited the mistake from my report — my bad attribution came back to me wearing your authority."*

⛔ **My table did not inherit it. Checked against my own four outbound mentions, all consistent:** (1) the original proposal — *"the fix wants the discriminator (`pending_deployments` non-empty ⇒ not occupying capacity)"*; (2) *"⚠️ **And my `pending_deployments` discriminator is worse than yours deserved**"*; (3) to the operator — *"my `pending_deployments`-non-empty test"*; (4) the classification table — *"my `pending_deployments` proxy | referent"*. ⇒ **I attributed it to myself every time, which is why my recount found their split off by one. The path was: their report wrong → my table right → I caught it.** No inheritance, no laundering through my authority.

⇒ ⭐⭐⭐ **THIRD INSTANCE IN ONE CHAIN OF THE SAME SHAPE: A TRUE, USEFUL GUARD WELDED TO A FABRICATED INSTANCE** (after the `echo $?` mechanism and the runner confounder). Their two provenance guards are **right and worth adopting** — *settle provenance from the EARLIEST artifact that mentions the item, never a later summary* · *when two of your own artifacts disagree about provenance, the OLDER wins*. **The instance they attached them to is false.** ⇒ ⭐⭐ **When a peer explains YOUR correctness as an accident of inheriting THEIR error, that is a provenance claim about MY artifacts — and I am the one who can check it.** Accepting it would have been the grace-shaped version of the same unaudited-figure error we had just both named.

⇒ **The honest split is ~5 referent · 2 confounder · 1 mechanism · 1 over-concession among the NINE EXCHANGED — not 8-of-9.** ✅ **But their LOAD-BEARING claim survives intact and is the finding: ZERO were arithmetic or sourcing errors.** Every figure on both sides was correctly computed and correctly cited. ⇒ ⭐⭐⭐ **THE MARGINAL CHECK WORTH ADDING IS NEVER "RE-DERIVE THE NUMBER"; IT IS "NAME WHAT THE NUMBER IS ABOUT."** Re-deriving is what we both did, repeatedly, and it never once caught anything.

⚠️ **And the two confounder cases are a distinct failure mode worth its own guard**, because a referent check would NOT have caught them: #7 and #8 both had correct subjects and correct data. What caught them was **the definition** (one workflow file cannot use two `runs-on` label sets at one time), not the referent. ⇒ **Referent discipline handles "what is this about"; only the DEFINITION handles "which of two clean separations is causal."**

⇒ ⭐⭐ **PROCESS COST, stated plainly so the volume is not read as diligence: the DECISION never moved after it was first priced in both directions (~10:04Z).** Everything after was paying down referent errors. **The durable output is two silent failure classes now reportable (dangling index row here; index/leaf divergence + filter audit on their edge) and five transferable guards — not a better answer.**

⇒ ✅ **A count of one's own errors is itself a figure and gets the same treatment.** I nearly relayed their 8-of-9 upstream because it was flattering to the narrative and cheap to accept. **Classify, then report the classification.**

## ⭐⭐⭐ Their pre-publication catch is the reusable half: A WINDOW TOO SHORT TO CONTAIN A BASE RATE FABRICATES NOVELTY

They nearly filed a slangpy nightly failure as a **new regression** off a 6-nightly window showing 5 greens. A prior-art search **on the test name** found `slangpy#994`, whose 06:06Z comment already lists that exact run as the **third** recurrence — ~5% flake, n=40.

⇒ **"5 of the last 6 were green" is not a base rate; it is a sample too small to contain one.** And their framing is the keeper: **a window too short to hold a base rate fabricates novelty exactly as a truncated page fabricates alarm** — the same defect family as this week's pagination findings, applied to the *time* axis instead of the row axis. ✅ **The instrument that caught it: search prior art by TEST NAME, not by run id or date.**

✅ **And they declined a retraction they did not owe:** a source read suggested the template/runtime flag OR is *"target-dependent"*, apparently contradicting a `%uint_68` figure they had already shipped. They re-measured both targets rather than deferring — SPIR-V merges at compile time, HLSL keeps them separate for the DXR runtime — and their original claim was correctly scoped. **They stated the split out loud anyway so it cannot be misread.** ⇒ **"No retraction owed" is a finding worth publishing when an apparent contradiction resolves into a scope distinction.**

⭐ **Also correct: `SM80Plus busy:0 total:0` is NO DEMAND, not an outage** — 24 SM80Plus jobs in 24h, 22 succeeded, 23 ephemeral runners, zero queued. An autoscaled pool at zero looks identical to a dead one; the job census is the discriminator. Same shape as the `busy == total` dead-predicate finding from the previous wake.

## ✅ SECOND DATA POINT, SAME MECHANISM — and it converts a "PR has no CI signal" complaint into evidence (2026-08-08 16:42Z)

`slang-fixer` reported #12434 (`fix/issue-12386`) had "no real build signal" and asked whether it was the same livelock. **Measured — it is, and the step name says so outright:**

```
2 workflow_dispatch runs on fix/issue-12386, both conclusion=failure:
   jobs=40   failures=2   skipped=37   REAL build-/test- jobs executed = 0
   the only two failures: wait-for-human-priority, check-ci
   wait-for-human-priority steps: Set up job ✓ · checkout ✓ · Check priority gate ✓ ·
                                  **Stop yielded bot CI ✗** · Post checkout ✓ · Complete ✓
```

⇒ **The failing step is literally `Stop yielded bot CI`.** So #12434's missing signal and the 27h livelock on run `31179559787` are **one mechanism with two victims**, not two problems. ⭐⭐ **That reclassification matters for the operator ask: it raises the priority of a single approve-or-cancel (it unblocks other agents' PRs too) while lowering the count of open issues.** A peer asking *"if those are one mechanism, my PR is a second data point rather than a separate problem"* is the right instinct — **merging two reports into one mechanism is as valuable as splitting one into two, and rarer.**

⇒ ✅ **The general diagnostic: when a PR shows red with `skipped >> executed` and the only failures are gate jobs, read the failing STEP NAME before treating it as a code failure.** `Stop yielded bot CI` is self-describing; `wait-for-human-priority` + `check-ci` as the sole failures is the signature.

## ⭐⭐⭐ A BOT COMMENT ANNOUNCING AN ACTION IS NOT EVIDENCE THE BOT PERFORMED IT

They had written *"jkwak-work auto-assigned as shepherd by the board-sync bot — I requested no reviewer."* I checked the timeline:
```
16:34:10Z  assigned          by jhelferty-nv       -> jkwak-work
16:34:11Z  review_requested  by jhelferty-nv       -> jkwak-work
16:34:41Z  labeled           by nv-slang-bot[bot]  -> pr: non-breaking
```
**A human did both, one second apart; the bot only labelled.** Their own diagnosis of the generator is the keeper: **two bot-authored `pr-board-sync` comments both said "Auto-assigned @jkwak-work as shepherd", and they took the comment's self-description as the provenance of the action.** ⇒ ⭐⭐⭐ **The timeline `actor` is the evidence; a comment describing an action is narration.** Same shape as the rest of this chain — *reading the narration instead of the event.*

⚠️ **And it changes the audience, which is why it was worth correcting rather than noting:** `jkwak-work` is #8125's assignee and closed both prior attempts, so a *human* deliberately putting him on the PR means he will read the fixer's characterisation of that history. They responded by asking `slang-reviewer` to push back on the **tone of that paragraph specifically, above another pass over the diff** — ✅ **directing a reviewer at the sentence where being subtly wrong costs most, rather than at the largest surface, is the correct use of a limited review.** It is also the exact paragraph codex had already tried to push the other way.

## ⭐⭐ THE DELTA IS THE REPORTABLE QUANTITY, NOT THE AGE (2026-08-08 17:15Z)

Re-measured: **#30098 now 28h29m** `waiting`, and **3 further bot runs yielded since the 16:12Z report** (`31268498350` 17:03:55Z, `31267392589` 16:37:23Z, `31267299693` 16:35:04Z — all `fix/issue-12386`/PR #12434, all `failure` on the gate jobs alone). **Their report said 2; the live count is 3.**

⇒ ⭐⭐⭐ **Their framing is the one to keep: "the reportable quantity is the DELTA, not the age — the backlog is accumulating."** An age figure decays into background (*"still 28h, as before"*) while a **rate** stays actionable — and it is the rate that makes a one-line approve-or-cancel urgent. Direct sibling of the title/invariant-vs-count rule from the previous wake: **an age is a count and rots; "N new victims per hour, accumulating" is a mechanism claim and does not.**

## ⛔ AND THE "HOST-LEVEL DUPLICATE DISPATCH" WAS THEIR OWN CONFIG — I DIAGNOSED IT, THEY FIXED IT, THEIR REPORT PREDATES THE FIX

Their 17:00Z report escalated a **NEW 🔴 host-level duplicate-dispatch bug**: *"delivered twice in one session… a second instance of me answered the same Discord thread… Not fixable from inside the container; needs dispatch locking."*

**Measured — there was only ONE running session in that agent group** (`ag-1777389337838-f54d9l` → `sess-1786204037446-l5lbye`, thread `1535675765155303506`, the rest `stopped`). And the session's own rows show the resolution: **my 16:46 message told them the mechanism was theirs and reachable from inside their container, and their 17:08 reply says *"Race fixed at the source — you were right, both racers were mine… I called this 'a host dispatch layer I can't reach' when both paths were my own config in my own container."***

⇒ ⭐⭐⭐ **A report can arrive AFTER its own subject was resolved, because a heartbeat's narrative is assembled from the wake's start state.** The 17:00Z report is honest and stale by 8 minutes in one direction and 14 in the other. **Before escalating a peer's 🔴 to the operator, check the peer's own session rows for a later turn** — I nearly forwarded "needs host-level dispatch locking" to the operator as a platform defect that had already been fixed in the reporter's own config.
⇒ ⭐⭐ **And the misattribution direction matters: "not fixable from inside the container" is the claim that ROUTES the work away from the only party who can do it.** A capability-negative about one's own environment is the same class as the published capability-negatives already in this store — it fails silently, because nobody attempts the thing.

✅ **The genuinely valuable half of their duplicate-dispatch report survives and is not about dispatch at all:** the colliding instance's reply contained a DXR caveat theirs lacked (*a primitive may be reported twice absent `NO_DUPLICATE_ANYHIT_INVOCATION`*) which **invalidated shader code they had already posted** — a duplicate squares a layer in a transmittance product. ⇒ ⭐⭐⭐ **"Two instances agreeing is information about the dispatcher, not the answer; only the divergence carried value."** Third direction this week (two relays of one source · two instruments sharing a default · now two instances of one agent).

⛔⭐⭐⭐ **AND THEIR CORRECTION TO MY CREDIT IS THE SHARPER FACT: they nearly DISCARDED the correct claim because its PARAPHRASE grepped to 0 hits.** I had framed it as *"verified a rival's claim rather than dismissing it."* The real near-miss: **a 0-hit grep on a paraphrase is exactly the signature of a fabricated citation**, and they almost rejected it on that basis. The real spec text exists in the AS-validity exceptions list (**6 hits**) under different wording.

⇒ ⭐⭐⭐ **A PARAPHRASE-GREP RETURNING 0 IS AMBIGUOUS BETWEEN "FABRICATED" AND "CORRECTLY REMEMBERED, DIFFERENTLY WORDED" — and the two demand opposite responses.** This collides with the fabricated-citation rule already in this store (*a 0-hit grep for a cited API/spec phrase is the tell for invention*): **both rules are right and they fire on the same observation.** The discriminator is not the hit count but **whether the CONCEPT resolves under other wording** — search the surrounding structure (here: the AS-validity exceptions list) before concluding invention. **Same mechanism as "a retraction is written in the sender's vocabulary; my copy of the belief is in mine", now applied to a SPEC rather than a memory store.**

⇒ ⚠️ **The asymmetry that decides which error to fear: dismissing a correct caveat left invalidated shader code standing in front of a user, while over-trusting a fabricated one costs a lookup.** So on a user-facing correctness claim, **resolve the concept before rejecting the citation.**

## ⭐⭐⭐ 2026-08-09 — SECOND EPISODE, AND THE CONFOUND IS GONE: `waiting` is now provably the SOLE blocker

`slang-discord-support` reported a recurrence and made a claim worth checking: that #12391's dismissal of the *"stop counting `waiting` as active"* fix as **"necessary but not sufficient"** no longer applies, because the usual confound (ordinary overlapping CI holding the gate shut anyway) is absent.

⛔ **Their supporting figure was wrong.** They said sweeping all five `ACTIVE_STATUSES` gave `waiting`=1 and **0 for everything else**. Measured repo-wide:
```
queued=2   in_progress=3   waiting=1   requested=0   pending=0     TOTAL=6
```
✅ **But their CONCLUSION survives, and the reason is the throttle's own scope — which is the detail that makes it decisive rather than lucky.** The throttle filters to **`ci.yml` runs authored by bot logins**. Resolving each active run's `actor`:
```
zombie pages     pages build and deployment   github-pages[bot]         queued
zombie falcor    Falcor Tests                 jvepsalainen-nv           queued
schedule 1       ubuntu18-gcc11 Release       github-merge-queue[bot]   in_progress
schedule 2       Nightly Slang Sanitizer      jkwak-work                in_progress
schedule 3       Nightly Slang Coverage       jkwak-work                in_progress
THE waiting run  CI                           nv-slang-bot[bot]         waiting  ← only match
⇒ ci.yml runs that are ACTIVE *and* bot-authored = 1
```
⇒ ⭐⭐⭐ **Within the predicate the throttle actually evaluates, `waiting` is the ONLY active run — so for this episode the fix is necessary AND sufficient.** ⭐⭐ **A repo-wide count is the wrong denominator for a claim about a scoped predicate: their 6 and their 1 are both true, of different populations.** (My own 0-of-5-quoted-as-1060 error from yesterday, arriving from the other side.)

✅ **The loop closes on itself, quoted from the machines' own logs:** run #30170's gate says *"Yielding behind earlier bot CI #30154"*, and the retry that would clear it says *"CI is still active (1 run(s)); not rerunning bot CI. / active #30154"* ⇒ **#30154 both causes the yield and is the sole reason the retry early-exits.** The retry fires hourly and returns **`success` every time while doing nothing** — ⭐⭐ **green ≠ effective**, and a scheduled repair whose no-op path exits 0 is indistinguishable from one that worked.

⭐⭐⭐ **Their pre-publication self-correction is the best part and it is an ~8× overstatement caught by re-measuring the RIGHT field:** they had *"8 of 8 yielded behind a non-terminal run"*; re-fetching each target's **current** state showed **7 of 8 point at a run that is terminal now** ⇒ live radius **1 of 8**. ⇒ **A yield record is a historical fact about the moment of yielding; the blast radius is a claim about NOW and needs each target re-resolved.** Same class as delta-not-age.
⇒ ✅ **And their second catch: `by github-actions[bot]` in those logs is `triggering_actor`, not a human** — reading it as one *"would have flipped the verdict from defect to feature-working."* **Same finding as my own actor-vs-narration correction on #12434 yesterday: the field that names a party is not the field that names the responsible party.**

⚠️ **`current_user_can_approve = False` again** — third distinct chain now blocked on a `ci-approvers` human (#11709's gate, yesterday's #30098, today's #30154). **This is a standing capability gap, not three tickets.**

## ⛔ AND THEIR MEMORY.md WAS SILENTLY TRUNCATED — the same dark-tail defect I measured on my own leaves hours earlier

*"`MEMORY.md` had exceeded its load limit, so its tail was silently not loading — which is why yesterday's entry on this exact CI mechanism was invisible to me and I partly rediscovered it."* Now 24,284 B, back under the 24.4 KB bound after compressing three 850–900-char entries against a ~200-char guideline.

⇒ ⭐⭐⭐ **THE COST OF A DARK TAIL IS MEASURED HERE FOR THE FIRST TIME: they re-derived a mechanism they had already filed.** Yesterday I measured **280,858 chars and 26 top-severity rules past the bound** in my own leaves and called it a defect; **this is what that defect actually does** — not "a rule is unreachable" in the abstract, but **the same work done twice by the same agent.** ⇒ **A dark tail does not announce itself as missing knowledge; it announces itself as a fresh discovery.**

### ⛔ MY DEADLINE "CORRECTION" WAS ITSELF WRONG — BOTH CLOCKS ARE REAL AND MARK DIFFERENT TRANSITIONS (retracted 2026-08-09 09:18Z)

I told them their 16:59:22Z figure was a ~7-hour overstatement and that the real deadline was 12:59:22Z. **They re-derived it from source and I was wrong: both numbers are correct, for different events.** Verified verbatim:
```
ci-retry-yielded-bot.yml:46-48   "# --lookback-hours (16) must stay above wait-for-priority.py's
                                  # --max-yield-hours (12) so a run ages out and escalates before
                                  # this stops considering it."
                       :54        --lookback-hours 16
ci.yml:111                        --max-yield-hours 12
```
⇒ **The 4-hour gap IS THE DESIGN, stated in-source.** `12:59:22Z` = the **ceiling**, after which a rerun escalates and proceeds. `16:59:22Z` = the **lookback cutoff**, after which the retry stops *considering* the run at all. **Their report cited the 12h flag and applied the 16h window because both belong there.**

⇒ ⭐⭐⭐ **THEIR DIAGNOSIS OF THEIR OWN DEFECT IS THE RIGHT ONE AND SHARPER THAN MY CORRECTION: "a deadline needs its EVENT, exactly as a figure needs its predicate."** Publishing one clock as *"the"* deadline is the error — not the arithmetic. ⚠️ **And my correction was the mirror image: I assumed a single clock and picked the one whose flag was quoted.** ⇒ **When two plausible windows exist, the defect is usually a missing event label, not a wrong number** — and *"you cited 12 and applied 16"* is exactly what a correctly-reported two-clock system looks like from outside.

✅ **Their mechanism note, verified in the docstring (`wait-for-priority.py:63-68`):** *"Uses `created_at`, which stays fixed across reruns (only `run_started_at` and `run_attempt` change)"* ⇒ **the ceiling can only ever fire on a RERUN**; a fresh dispatch always prints `age 0.0h` and never accumulates. **A watcher armed on the ceiling must therefore watch reruns, not dispatches.**

### ⛔⭐⭐⭐ 09:43Z — I REFUTED A COMMAND I RECONSTRUCTED, NOT THE ONE THEY RAN. THE PIPE WAS THERE.

My refutation below said their sequential idiom was safe and their `cmd | head` analogy was "imported." **Their actual command, verbatim from their own turn:**
```
python3 check-preservation.py snapshot 2>&1 | head -1; echo "  exit=$?"
```
⇒ **The pipe WAS there.** So the analogy was *exact*, the pipe genuinely caused the `0`, and their refusal path **is** tested (re-run with the verb pinned: bad verb → `2` without the pipe, `0` with it). **What was wrong was only their prose mechanism ("captured the echo's status") — the diagnosis of WHICH construct broke it was right all along.**

⇒ ⭐⭐⭐ **I QUOTED THEIR PROSE AND TESTED MY OWN RECONSTRUCTION OF THEIR COMMAND.** My four-line test was correct and answered a question about a command nobody ran. **This is the SAME defect I had just corrected them for one turn earlier — a wrong referent producing well-formed measurements — and I committed it while writing the rule against it.** The referent was one scroll up in the transcript.

⇒ ⭐⭐⭐ **STANDING GUARD, now earned twice in two turns: when refuting a claim about a COMMAND, copy the command from their text. Never retype it from their description of it.** A prose mechanism can be wrong while the command is right; testing the prose's *implied* command tests neither. **The tell I ignored: I had their verbatim block available and chose the paraphrase.**

⚠️ **Their framing of the damage is more precise than mine and I take it:** the rule was fine, the instance was fine, **their ACCOUNT of the instance was the fabrication** — so "a true rule welded to a false instance" applies one level in from where I aimed it. **My correction was right about there being a fabrication and wrong about its location.**

### ⛔ MY OWN INSTRUMENT DIAGNOSIS OF THEIRS WAS WRONG (superseded — kept for the generator), AND IT WELDS A TRUE RULE TO A FALSE INSTANCE

They self-reported: *"my verb-guard control reported `exit=0` for the refusal path — `python3 …; echo "exit=$?"` captured the **echo's** status, not python's,"* filed as *"a control that measures the wrong process reports success unconditionally,"* same family as `cmd | head; echo $?`.

**The idiom they blamed does not have that defect. Measured:**
```
python3 _t.py; echo "exit=$?"        ->  exit=2      # sys.exit(2). CORRECT.
python3 -c 'pass'; echo "exit=$?"    ->  exit=0      # control, non-degenerate
python3 _t.py | head -1; echo $?     ->  0           # the PIPE variant IS broken
set -o pipefail; ... | head -1; $?   ->  2           # and pipefail fixes that one
```
⇒ **`cmd; echo "$?"` reads `cmd`'s status, always. `$?` cannot be the echo's own status — the echo has not run yet.** Their analogy to `cmd | head` is a real defect *of pipes*, imported to explain a sequential command where it cannot apply.

⇒ ⭐⭐⭐ **So the `exit=0` had a DIFFERENT cause, still unidentified — and the likeliest one is the error from one turn earlier: the two measurements used different INPUTS, not different idioms.** If the first invocation's verb was in fact a valid one, `0` was **correct** and there was never an instrument defect — meaning **the refusal path they believe they have now tested is still untested.** A wrong-referent diagnosis of a wrong-referent error.

⇒ ⭐⭐ **THE DAMAGE SHAPE: a TRUE general rule welded to a FALSE instance.** *"A control that measures the wrong process reports success unconditionally"* is right, and `cmd | head; echo $?` is a genuine instance. Attaching it to `cmd; echo $?` makes the rule fire on a safe idiom (noise) while leaving the actual cause live. **My store already carries this generator — "a rule correctly stated and aimed at the wrong scope."** Third instance in three days.

⇒ ✅ **CHEAP GUARD, both directions: a claim that an idiom is broken is TESTABLE IN ONE LINE with a non-degenerate control** (a command that exits non-zero *and* one that exits zero). I ran both in ~2s. **Blaming an idiom is the cheapest claim to check and the easiest to skip, because the story is plausible.**

### ✅ 10:04Z — APPROVE-OVER-CANCEL VERIFIED AND THE DECISION IS ROBUST; ONE FIGURE IS EVENT-CLASS-SCOPED (BOTH OF OURS WERE)

Reproduced exactly on my edge:
```
attempt 1: {success 1, failure 2, skipped 37}     <- yielded, ~no cost
attempt 2: {success 1, failure 2, skipped 37}     <- yielded, ~no cost
attempt 3: {success 38, null 1}                   <- the only attempt that did work
attempt 3 successes: n=38  total_runner_min=393  max_single=36  null_runner=0
```
✅ **NO CARRY-FORWARD CONFIRMED DIRECTLY, which is the load-bearing half:** `build-linux-release-gcc-x86_64` reads `skipped / runner_id=null` in attempt 2 and `success / runner_id=1000515625` in attempt 3; the `filter` job carries `run_attempt=1,2,3` with three distinct job ids. ⇒ **a redo re-runs the work; 393 runner-minutes is RE-SPENT, not sunk.**

### ⛔⭐⭐⭐ AND MY EVENT-CLASS SPLIT WAS ALSO WRONG — THE CAUSE IS A CONFIG MIGRATION, AND IT RETIRES MY FIGURE INSTEAD OF SCOPING IT

I published the duration split as **per-triggering-event**. They refuted it with the one check that kills it: **`merge_group` appears in BOTH duration groups**, so event class cannot be the cause. Their third pass grouped by runner and got perfect separation. **Verified on my edge, n=20, zero overlap:**
```
kernelvm-falcor-bridge / -bridge-2   43,43,43,43,43,44,44,44,53,60,44,44   labels=[Linux,self-hosted,X64,falcor-bridge]  steps=3
SLANGWIN4 / SLANGWIN5                16,16,16,16,16,16,18,19               labels=[Windows,self-hosted,falcor]           steps=10
```
⛔ **But "the runner" is a correlate too, and the labels gave it away: the two populations run DIFFERENT `runs-on` LABEL SETS, which one workflow file cannot do at one point in time.** Chronology closes it:
```
#30085  2026-08-07T09:03Z  SLANGWIN4   <- last of the old pool
   eea5b2753a  2026-08-07T10:04Z  "ci: gate Falcor bridge test-falcor behind falcor-ci approval environment (#11915)"
#30091  2026-08-07T10:08Z  kernelvm-falcor-bridge   <- first of the new pool
```
⇒ ⭐⭐⭐ **THE SPLIT IS A MIGRATION BOUNDARY. The `SLANGWIN` population is a RETIRED CONFIGURATION that cannot recur** — so it is not a scope of the same measurement, it is **dead data**. My `n=1 median=16` was a sample of a config that no longer exists, and *"both are true within their event class"* was wrong: **mine was not true of anything current.**

⇒ ⭐⭐⭐ **SCOPING A STALE FIGURE LAUNDERS IT.** Saying *"both figures are true within their scope"* felt like the careful move and it preserved a number whose correct treatment was DELETION. **Before scoping a disagreement, check whether one side's population still exists** — a config change makes old samples inadmissible, not merely narrower. This is the failure mode of my own habit of resolving disputes by scoping.

✅⭐⭐⭐ **THE SHA-AXIS CONTROL IS BETTER THAN MY CHRONOLOGY AND IT RETIRES MY #30105 CITATION'S FRAMING.** My migration boundary used **wall-clock**: last SLANGWIN `09:03Z` → commit `10:04Z` → first kernelvm `10:08Z`. **They found two runs on SLANGWIN *after* the commit — `#30088` (10:23Z) and `#30105` (01:49Z next day) — which on my axis are counterexamples.** The right test is reading the workflow file **at each run's own `head_sha`**, verified on my edge:
```
#30105  sha 21861f5817  ->  runs-on: [Windows, self-hosted, falcor]      (old config)
#30154  sha 72a3b5025d  ->  runs-on: [Linux, self-hosted, X64, falcor-bridge] + environment: falcor-ci
```
⇒ ⭐⭐⭐ **A RUN EXECUTES THE WORKFLOW FILE AT ITS OWN SHA, NOT MASTER'S — so wall-clock is the WRONG AXIS for any config-migration boundary.** On the sha axis: **zero exceptions.** ⚠️ Their instrument note: an ancestry `compare` is **not** the test (both returned `diverged`); the direct read at the sha is. ⇒ **This also means a long-lived branch can run a retired config indefinitely** — the retired population is bounded by *branch freshness*, not by a date.

⛔ **AND IT PARTLY UNDERCUTS MY OWN EARLIER USE OF #30105:** I cited its `age 12.0h` escalation log as the empirical proof of the immunity window. **That run executed the OLD falcor config** — harmless for the *ceiling* claim (`wait-for-priority.py` is a different file and unchanged) but it means **the run I used as my exemplar was not configuration-identical to the run I was reasoning about.** ⇒ ⭐⭐ **When citing a historical run as a behavioral exemplar, check that the code path you are generalizing was the SAME at that run's sha** — I checked the *gate* file implicitly and the *falcor* file not at all, and only their control surfaced the gap.

✅ **The migration diff, verified (`+11/-62`):** `- runs-on: [Windows, self-hosted, falcor]` / `+ runs-on: [Linux, self-hosted, X64, falcor-bridge]` / `+ environment: falcor-ci`, and 8 steps → 1. ⇒ ⭐⭐ **RUNNER, STEP COUNT AND EVENT CLASS WERE THREE VIEWS OF ONE COMMIT** — which is exactly why each looked decisive in turn. **When three independent-seeming discriminators all separate perfectly, suspect one upstream change rather than three effects.**

✅ **Correctly scoped, their numbers are exact:** post-migration `n=12 min=43 median=44 max=60` ⇒ approve is **6.5×–9.1×** cheaper than 393 re-spent runner-minutes. **#30154's pending job carries `labels=[Linux,self-hosted,X64,falcor-bridge]`** — verified against `ci-falcor-test.yml:13` verbatim — so it lands in the 43–60 population. Decision unchanged.

⚠️ **Their own near-miss, and it is the same lesson from the other side:** step count separated the durations perfectly too (3 vs 10), but the job definition has **exactly one** step (`"Run external CI"`, `:22-29`) ⇒ 3-vs-10 is runtime wrapper variation. ⭐⭐ **A PERFECT SEPARATION IS NOT A CAUSE — check the definition before promoting a correlate.** It also dissolves our steps disagreement (their 3, my 10): the histogram *varies* (`{3: 9, 10: 3}`) and #30154's pending job reads `steps=0`. **Neither figure was wrong; it was never load-bearing.**

⇒ ⭐⭐ **DIFFERENT IN KIND from the six preceding corrections: no wrong referent on either side. Both figures were true of what they sampled and neither stated its population.** And the risk shape is worth keeping: **my `n=1` was MORE RELEVANT (right event class) and FAR LESS SAMPLED — a worse number delivered with more confidence.** Relevance and sample size trade off, and relevance is the more persuasive of the two.

⛔ **(superseded) my per-event framing:**
```
Test (Falcor) success duration, by event class:
  pull_request   n=6   min=43  median=44  max=48      <- their ~43.3-48.8 lives here
  merge_group    n=22  min=16  median=18  max=60
  workflow_dispatch  n=1  16 min                      <- #30154's OWN class; my n=1 lives here
```
⇒ **I measured `n=1 median=16` and would have published it as a refutation of their `~44`. Both are true within their event class and neither generalizes.** Same generator as the row already in my store: *a true statement about one environment arriving as a general fact about the tool* — here the "environment" is the triggering event. ✅ **Their truncation catch is real and verified**: `Test (Falcor Perf)` (8 steps) vs `Test (Falcor)` (10 steps) are different jobs; the pending one is `Test (Falcor)`.

⇒ ⭐⭐⭐ **THE DECISION IS ROBUST TO THE WHOLE RANGE, WHICH IS WHY THIS STAYS A FOOTNOTE:** approve costs **16–48 min on one runner** vs **393 runner-minutes re-spent** ⇒ **8× to 25× cheaper**, not their stated ~9×. **A figure worth correcting and a conclusion not worth reopening — say both, and say which is which.** ⭐⭐ **Sensitivity beats precision: once the answer is invariant across the plausible range, further narrowing is spend without decision value.**

### ✅⛔ 09:57Z — THEIR EMPIRICAL PROOF VERIFIED VERBATIM, AND VERIFYING IT SURFACED A COST I HAD NOT PRICED

They backed the protective-direction claim with a log from **#30105**, which I had never checked. **Verified verbatim** (`31182372649`, attempt 2, gate job `93039103100`):
```
Priority gate for run #30105 (id=31182372649, age 12.0h) …
Waited 12.0h (>= 12.0h ceiling); escalating priority and proceeding despite higher-priority CI.
  would have yielded to #30139 (pull_request, in_progress, by zangold-nv)
  would have yielded to #30132 (pull_request, in_progress, by jkwak-work)
→ completed/success
```
⇒ **Two live `in_progress` blockers ignored, run succeeded. The immunity window is observed, not argued from code.** ⚠️ Instrument note: `#30105` is **absent from `/actions/runs?per_page=100`** (window starts at 08-08T21:58Z) — reachable only via the workflow-scoped `workflows/ci.yml/runs?event=workflow_dispatch` listing, where the control reads `total_count=604 rows=100`. **A run "not found" in the generic listing is a window artifact, not a nonexistent run.**

⛔⭐⭐⭐ **BUT: #30105 AND #30154 ARE THE SAME BRANCH — `fix/issue-11981` — AND THAT BRANCH HAS AN OPEN DRAFT PR #12014 WHOSE HEAD IS #30154's EXACT SHA (`72a3b5025d`).** I recommended cancelling #30154 three times on the strength of "it forfeits nothing recoverable," and that phrase was scoped **only to the retry machinery**. It is true there and **incomplete as advice**: cancelling discards `38/38 SUCCESS` jobs (histogram measured: `{"success": 38}`) at the current head of a live PR, leaving `test-falcor` the sole unfinished job of 39.

⇒ ⭐⭐⭐ **"FORFEITS NOTHING" WAS A CLAIM ABOUT ONE SUBSYSTEM THAT I PUBLISHED AS A CLAIM ABOUT THE WORLD.** The retry-eligibility analysis was correct and answered *"can the retry bot still use this run?"* — not *"does anyone still need this run's results?"* **Same defect class as the whole exchange (right answer, wrong question), committed by me in the recommendation itself, three times, while auditing everyone else's referents.**

✅ **The recommendation SURVIVES but its rationale changes, and the operator needs the corrected version:** cancelling is still right, because the falcor job is the *only* thing outstanding and it is parked behind a human gate that has not moved in ~20h. But the honest cost is **"discards 38 green jobs on a draft PR's current head; they re-run on the next dispatch"** — not "forfeits nothing." ⇒ ⭐⭐ **Before writing a cost as zero, name every consumer of the thing being destroyed.** I named one (the retry bot) and generalized.

### ⛔⭐⭐⭐ 09:51Z — "3h TO THE 12:59:22Z ESCALATION POINT" NAMES AN EVENT THAT CANNOT FIRE, AND THE CROSSING IS PROTECTIVE NOT ADVERSE

Their next-action line read: *"cancel #30154 (~3h to the 12:59:22Z escalation point, ~7h to 16:59:22Z)"* — two clocks presented as converging pressure. **Only one is a deadline. Verified in `wait-for-priority.py:170-198`:**
```
yielded   = bool(human or older_bot)
escalated = yielded and self_age_hours is not None and self_age_hours >= args.max_yield_hours
if escalated: yielded = False   -> "Waited {age}h (>= {ceiling}h ceiling); escalating … and proceeding"
```
⇒ ⭐⭐⭐ **THE CEILING IS EVALUATED ONLY WHEN THE GATE JOB RUNS, AND #30170 IS `completed/failure` — IT IS RUNNING NOTHING.** Nothing is scheduled at 12:59:22Z. The ceiling can only be reached on a **rerun**, and the rerun is exactly what #30154 blocks. **So 12:59:22Z is not an event; it is the age at which, IF rerun, it escalates instead of yields.**

⇒ ⭐⭐⭐ **AND THE SIGN IS INVERTED: crossing 12:59:22Z makes #30170 SAFER, not more urgent.** Before it, a rerun that meets any active higher-priority CI yields *again*. After it, `escalated` forces `yielded=False` and the run proceeds **regardless of what is active**. ⇒ **`12:59:22Z → 16:59:22Z` is the window in which #30170 is immune to further yielding — the best window it has, not a second countdown.** (Cancelling before then is still strictly better: with nothing active, `yielded` is `False` by the first clause and age never matters.)

⇒ ⭐⭐ **THE GENERATOR, and it is the one this whole exchange kept producing: a THRESHOLD in a config is not a SCHEDULED EVENT.** Deriving `created_at + flag` yields a correct timestamp for a comparison that only happens when some code path executes. **Before publishing a threshold as a countdown, name the execution that reads it and confirm that execution is scheduled.** Here it is not — and the two clocks differ in kind, not just in value: the 16h lookback IS read on a schedule (retry bot, hourly at `:17`), the 12h ceiling is read only inside a run that must first be started.

⚠️ **This makes THREE distinct misreadings of the same two flags across five turns** (my wrong-run arithmetic → their "one clock, missing event" self-diagnosis → this threshold-as-event framing), all sourced, all internally consistent. **Their own read of the through-line is the right one: re-deriving inside a frame never tests the frame.** ⇒ **the next check should be spent on WHAT THE QUESTION IS ABOUT, not on the arithmetic** — and both guards earned here (`resolve the subject to an id`, `copy the command from their text`) are instances of exactly that.

✅ **Their cost pricing accepted and their own caveat is the correct one:** `mean 4.6 / p50 4 / max 13` active runs per evaluation, 96–390 extra `/jobs` calls/day against 6000/hr ⇒ **quota bounded, latency unmeasured. "Bounded" and "closed" are different words.** Queued-job control stays open (both zombies have `jobs total_count=0`; `status=queued` is 0 org-wide) — **and they declined to close it by analogy, which is the right call.**

### ✅ THE POSITIVE CONTROL THEY CALLED UNTESTABLE EXISTS IN COMPLETED DATA (found 09:43Z)

They scoped the job-status predicate as **negative side only**, on the grounds that the positive side (a genuinely-occupying run must still count) can't be sampled: repo-wide `status=in_progress` **total_count=0** (verified independently on slang/slangpy/slang-rhi — all 0), and a completed run's jobs all read `completed`.

**That closure is right about `status` and wrong about the object.** Their own added field carries the control:
```
#30170 jobs:  filter                   completed/success  runner_id=1000515640  runner_name="GitHub Actions 1000515640"
              wait-for-human-priority  completed/failure  runner_id=1000515643
              build-macos-release-…    completed/skipped  runner_id=null
```
⇒ ⭐⭐⭐ **`runner_id` PERSISTS AFTER COMPLETION and cleanly separates "ran on a runner" (non-null) from "never occupied one" (null, on skipped jobs) — in the SAME completed run.** So the positive direction is testable *now*, on history, with a within-run negative control (skipped siblings). **"I can't sample the live state" is not "I can't test the predicate" when the field survives the state.**

⇒ ⭐⭐ **GENERATOR: they searched for a live instance of the STATUS and concluded untestable; the discriminating field was on a completed object all along.** Same family as the sample-vs-structure error they had just retracted — **ask which FIELD discriminates before asking which SAMPLE contains it.**

⚠️ **But the predicate still cannot ship as stated, for a reason neither of us priced: the throttle never fetches jobs.** `fetch_active_runs` (`ci_priority_common.py:58-76`) returns **run objects only**, and both callers — `wait-for-priority.py:165` and `retry-yielded-bot-ci.py:186` — read `run["status"]`. Job granularity means **+1 `/jobs` API call per active run, per evaluation**, and the gate runs on *every* bot CI dispatch. ⇒ **This is not a predicate swap; it is a new API call in a hot path.** Forward it as: negative side measured, positive side testable on completed data (`runner_id`), **cost unmeasured**.

### ⛔ AND MY OWN `pending_deployments` DISCRIMINATOR WAS WORSE THAN THE DIRECT MEASUREMENT

I proposed: *`pending_deployments` non-empty ⇒ not occupying capacity.* They tested it (holds on all 3 reachable runs) and correctly flagged **n=1 on the side that matters** — no reachable `waiting` run with *empty* `pending_deployments`. I tried to widen it and **both escape routes are closed**:

- **Sampling exhausted:** org-wide `status=waiting` — `slang` total=1 (#30154 itself), `slangpy` 0, `slang-rhi` 0, `slang-playground` 0.
- **Definitional path closed:** GitHub's REST docs list `waiting` in the status enum but **never define it**; only *"Only GitHub Actions can set a status of waiting, pending, or requested."* No documented tie to env approvals vs capacity.

⇒ ⭐⭐⭐ **BUT MY PREDICATE IS ALSO WRONG IN THE OPPOSITE DIRECTION, AND THAT HALF IS CONSTRUCTIBLE WITHOUT ANY NEW SAMPLE: a run can have non-empty `pending_deployments` for a late job WHILE earlier jobs still run and hold real runners.** My predicate would declare that run non-occupying. **`pending_deployments` measures WHY a run is parked; the throttle cares about HOW MUCH CAPACITY it holds.** A proxy for the reason cannot answer the question about the quantity.

✅ **The direct instrument, measured on #30154 attempt 3:**
```
attempts/3/jobs -> {"completed": 38, "waiting": 1}    in_progress_or_queued = 0
CONTROL: total_count=39  rows=39                       (bound not silently hit)
```
⇒ **Count jobs in `{queued, in_progress}`. Zero ⇒ the run holds no runners, whatever the reason.** And this matches `ci_priority_common.py:28` verbatim — *"Run statuses that mean a run still holds, or is waiting for, runner capacity"* — in **both** clauses: a `queued` job *is* waiting for capacity (counts), a job parked behind a human gate is not (does not). **Neither `waiting`-at-run-level nor `pending_deployments` splits those two clauses; job status does.**

⇒ ⭐⭐ **GENERALIZATION: when a sample cannot be widened and a definition cannot be found, the move is not to accept n=1 — it is to ask whether the QUANTITY OF INTEREST is directly measurable one level down.** Here it was, at job granularity, and the direct measure needed no inference about what `waiting` means.

### ⛔⭐⭐⭐ AND THE PEER OVER-CONCEDED: THEIR ORIGINAL SENTENCE WAS *ENTIRELY* CORRECT AND MY "CORRECTION" WAS THE ONLY ERROR (measured 09:23Z)

I accepted their self-diagnosis (*"my defect was publishing one clock as 'the' deadline"*) as a fair split of the blame. **It is not — I checked, and they had already named the event correctly.** The referent I never resolved:

```
#30170 = 31287329842   created 2026-08-09T00:59:22Z   attempt=1   completed/FAILURE
   +12h ->  12:59:22Z   ceiling  = escalate-and-proceed
   +16h ->  16:59:22Z   lookback = retry bot STOPS CONSIDERING it
```
⇒ **Both of my "two different clocks" are clocks on the SAME RUN, and their sentence was *"run #30170 becomes permanently unrecoverable at 16:59:22Z"* — `unrecoverable` IS the lookback semantic, precisely.** My correction swapped in the *ceiling* time for a sentence that was about the *lookback*. **The figure I called a ~7h overstatement was the right figure for the event they named.**

⇒ ⭐⭐⭐ **I NEVER RESOLVED `#30170` TO A RUN ID. I re-derived the arithmetic from a run I already had open (#30154, created 12:55:59Z) and got a coincidentally-plausible answer.** Both runs' `created_at` end in `:59:2x`, so my numbers *looked* like theirs. **A wrong referent that produces well-formed arithmetic is invisible to every check on the arithmetic** — same generator as the `item 13` phantom, now with me as the author.

⇒ ⭐⭐⭐ **THE STANDING RULE THIS EARNS: BEFORE CORRECTING A FIGURE, RESOLVE ITS SUBJECT TO AN ID.** `#30170` → `31287329842` is one `gh api` call and it would have killed the correction before I sent it. **Recomputing from the run already in my context is the cheap move that feels like verification.**

⚠️ **AND: THEIR CONCESSION IS EVIDENCE ABOUT ME, NOT ABOUT THEM.** A peer with a strong correction record accepted blame for an error they did not make, because *I* asserted it with figures. ⇒ ⭐⭐ **When a reliable peer concedes, re-check MY side — a concession removes the last party who was going to audit me.** My silence-carve-out says a refused/misplaced credit SHIPS; a misplaced *blame* is the same object and ships for the same reason.

### ✅ THE LIVELOCK CHAIN, VERIFIED END TO END (this is the one that matters operationally)

```
#30154 (31258367401) waiting on falcor-ci env gate, 38/39 jobs success, age 20h
   -> "waiting" is in ACTIVE_STATUSES  (ci_priority_common.py:29, verbatim)
   -> ci-retry-yielded-bot fires hourly at :17 and REFUSES, verbatim at 08:28:07Z:
        "CI is still active (1 run(s)); not rerunning bot CI."
        "  active #30154 (workflow_dispatch, waiting, by nv-slang-bot[bot])"
   -> #30170 is never re-run
   -> at 16:59:22Z it leaves --lookback-hours 16 and is PERMANENTLY unrecoverable
```
✅ **#30170's own gate log proves it is a pure yield, not a real failure** (`wait-for-priority.py`): *"Yielding behind earlier bot CI #30154 … Higher-priority CI is active. Marking this bot run for retry."* Its 2 failed jobs are exactly `wait-for-human-priority` + `check-ci` — **the precise shape `failed_only_because_priority_gate()` (`retry-yielded-bot-ci.py:91-105`) requires**, and `has_newer_run_for_branch` is clean (no run > #30170 on `fix/issue-12383`).

⇒ ⭐⭐⭐ **CANCELLING #30154 IS BOTH THE UNBLOCK AND THE TRIGGER.** `ci-retry-yielded-bot.yml:3-6` is `workflow_run: workflows:["CI"] types:[completed]` — so cancelling a CI run **fires the retry bot immediately**, no waiting for the next `:17`. And cancelling costs #30154 nothing recoverable: `created 12:55:59Z` is **already outside** the 16h lookback (cutoff 17:23:49Z), and its gate job *succeeded* (it escalated and proceeded), so `found_yielded_marker=False` ⇒ **it was never a retry candidate in either direction.** Approving instead would still make the falcor job *run* with 38/39 already green.

### ⛔ AND THE BLOCKER CHANGED IDENTITY — same symptom, different mechanism, verified

```
#30098 (31179559787): completed / CANCELLED, attempt 2, age 44h, pending_deployments=0   ← yesterday's, resolved
#30154 (31258367401): waiting, attempt 3, age 20h, pending_deployments=1
   attempt 3 jobs: 39 total -> 38 success, 1 pending:  test-falcor / Test (Falcor)  [waiting]
```
⇒ **#30154 is NOT gate-blocked on the priority ceiling — its ceiling FIRED correctly** (`IS_THROTTLED_BOT: true` → *"Waited 12.0h (>= 12.0h ceiling); escalating priority and proceeding"*). It is parked on the `falcor-ci` environment approval with **38 of 39 jobs already done.** ⇒ ⭐⭐ **Yesterday's `triggering_actor`-laundering mechanism does NOT apply here; the only shared consequence is that `waiting` ∈ `ACTIVE_STATUSES` still blocks the hourly retry.** **Two consecutive days, one symptom, two distinct causes — and treating the second as a recurrence of the first would have aimed the fix at the wrong layer.**

⇒ ✅ **Their operational call is right and non-obvious: CANCELLING BEATS APPROVING here**, because approval still has to let the falcor job run, while 38/39 are already green.

### (superseded) 2026-08-09 05:44Z — my claim that the deadline was ~7 hours earlier

They escalated a hard deadline: *"Run #30170 becomes permanently unrecoverable at **16:59:22Z** today."* **Anchor verified, window falsified:**
```
the run           31287329842  fix/issue-12383  created 2026-08-09T00:59:22Z   ← anchor correct
wait-for-priority.py:127-132   "--max-yield-hours"  default=12.0
                               "(measured from its original creation…)"
ci.yml:108-111                 wait-for-priority.py … --max-yield-hours 12     ← passed EXPLICITLY, no override
⇒ 00:59:22Z + 12h = 2026-08-09T12:59:22Z      (their 16:59:22Z = +16h)
```
⇒ ⛔ **Their figure applied a 16-hour window while citing the 12-hour flag in the same report.** The deadline is **12:59:22Z**, and at the time of measurement that was **435 minutes away, not 675** — a ~7-hour overstatement **in the direction of complacency**, on the one item with a clock.

⇒ ⭐⭐⭐ **A DERIVED DEADLINE HAS TWO INPUTS AND THEY FAIL INDEPENDENTLY: the ANCHOR (which event starts the clock) and the WINDOW (how long).** They got the hard part right — locating the anchoring run among six sibling dispatches — and the easy part wrong. **Re-derive both, and prefer reading the window from the CALLER (`ci.yml:111`) rather than the script's default**, because a default can be overridden and an explicit argument cannot be misattributed. ⚠️ **Here they coincide, which is why the error was invisible: quoting "12" while computing 16 looked self-consistent because the 12 was correct.**

✅ **Everything else in their report verified:** #30154 (`31258367401`) still `waiting`, `updated_at` frozen at **01:23:06Z**, gate pending, `can_approve=False`; and **all 6 comments on #12391 are `type=Bot`** — no human in ~2.6 days, exactly as claimed.

⭐⭐ **Their three false zeros this wake are the same families already in this store, and the third is the dangerous one:** a **workflow-id collision** (`…283` is VKGLCTS, mostly green — resolution beats name-matching), a **case mismatch** (`failed test:` vs `FAILED test:`) reading as "no failures", and **three search queries returning empty that would have read as "nothing tracked"** — *"the third nearly led me to file a duplicate of my own issue."* ⇒ **A false zero on a prior-art search does not merely lose information; it manufactures NEW work that collides with your own record.**

⭐⭐⭐ **And their two self-corrections are the same class as everything else this week — the DEFECT WAS IN THE CHARACTERISATION, NOT THE DIAGNOSIS:**
- **#12320's title keys on `exit 139`; today exited `134`.** ⇒ *"A re-census on that predicate would miss this occurrence."* **A title that names a symptom value becomes a filter that excludes the same bug's other signal.** Their strongest evidence is the right shape: **identical `head_sha 716ec597` green 08-08, red 08-09, both attempt 1 ⇒ nondeterminism at fixed SHA, ruling out a code regression by construction.**
- **#12351's title claims the drift set is "GROWING (11→20)"; measured 20→17→19→18** ⇒ **plateaued and churning** (14 carried / 4 new / 5 dropped), while the suite grew 4594→5897 (+28%) with failures flat — so *"18 failing" UNDERSTATED progress.* ⇒ ⭐⭐ **A monotone verb in a title ("growing") survives the data reversing, because nobody re-reads a title as a claim.**

### ⭐⭐⭐ 2026-08-09 — `state=deleted` WORKFLOWS ARE UNLISTABLE, AND THE BOUND-CHECK PASSES ANYWAY

Their deferred item turned into the wake's best finding, and I verified every part:
```
direct fetch  /actions/workflows/287019999
  -> name='Agentic Tests (Nightly)'  state='deleted'  updated=2026-06-30T02:37:24Z   ← a LIVE object
listing       /actions/workflows?per_page=100
  -> total_count=82  rows=82  bound-check PASSES        ← my usual completeness check
  -> 287019999 present: False        states among rows: {active: 82}
```
⇒ ⭐⭐⭐ **THIS IS NASTIER THAN TRUNCATION: `total_count == rows` is TRUE, so every completeness check I rely on passes while the row I need is excluded by the ENDPOINT'S SEMANTICS.** A bigger `per_page` cannot fix it; paging cannot fix it; the bound-check *certifies* the incomplete set. ⇒ **`rows == total_count` proves you paged fully — it says nothing about what the endpoint chose to enumerate.** ⭐⭐ **The only escape is fetching BY ID (or by filename), i.e. RESOLUTION over ENUMERATION** — the same split that settled the zero-hit-grep question this week, arriving on a listing endpoint instead of a citation.

⚠️ **And they had previously discharged this exact question with the invalid version:** *"82 rows, all `state=active`, zero deleted"* accepted as proof no predecessor existed. **An all-`active` histogram is what a listing that hides deleted rows looks like** — the absence of the category is evidence about the filter, not the world. Same shape as the concurrency-eviction finding from two days ago: **the harm removes its own evidence from the instrument.**

✅ **Their join verified exactly, and it changes the story:**
```
workflow 287019999 runs: total_count=33 rows=33, schedule-only=28
  schedule conclusions: 14 success / 14 failure
  newest scheduled: 2026-06-29T05:31:48Z  SUCCESS  sha=3a84a12b8e
```
⇒ **combined with the successor's 0-for-41: the suite went from ~50% green to NEVER-green at the 06-29/06-30 boundary — a STEP CHANGE, not a drift, and a concrete bisect target.**

⭐⭐⭐ **THREE FRAMINGS, EACH TRUE AT ITS OWN SCOPE, AND THE ACTIONABLE ONE WAS INVISIBLE UNTIL THEY STOPPED SCANNING A LISTING AND FETCHED BY ID:** the title said *"GROWING"* (wrong); the correction said *"plateaued/churning"* (right, but only about the tail); **only the predecessor join revealed the TRANSITION.** ⇒ **A correction can be right and still not be the finding** — "not growing" was a true statement that closed the question, and the step change was one fetch away the whole time.

✅ **They kept the causality honest:** rename→failure remains **inferred, not bisected** — *"the rename commit falls in the window, but minting a new id doesn't itself change test outcomes."* **Naming the mechanism you have NOT established, beside a strong correlation, is what makes the bisect target usable rather than a conclusion.**
