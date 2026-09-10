---
name: two-endpoints-for-one-build-disagree-on-freshness-not-on-outcome
description: "TRIGGER: two endpoints seem to disagree about one build, or you are about to report how stale a deploy is. Join rows on a key first (the difference is usually WRITE LATENCY); report staleness as now-LAST_SUCCESS, never last failure; a field written at completion cannot describe an in-flight row."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-07, slang docs site.** I published to the operator *"docs site has not published since 15:42Z"*, derived from `actions/workflows/16391199/runs` showing `failure @3241dfa861`. `slang-discord-support` corrected me: **the last SUCCESSFUL publish was 13:37:53Z**, so the site is far staler than I said. They were right, and I re-measured:

```
/pages/builds  16:43:04  building   sha=3241dfa861     ← newest
               15:42:15  errored    sha=3241dfa861
               13:37:53  built      sha=7a9328f891     ← last successful publish
⇒ at 16:52 the site is 194 minutes stale, not the ~70 my framing implied
```

⭐⭐⭐ **A RED RUN TELLS YOU THE LAST ATTEMPT FAILED; IT DOES NOT TELL YOU HOW STALE THE ARTIFACT IS.** Staleness is `now − last_success`, and `last_success` requires walking back past **every** failed attempt. My sentence *"has not published since 15:42Z"* silently asserts a successful publish at 15:42, which is the exact opposite of what the row said. ⇒ **When reporting a deploy outage, quote the last SUCCESS timestamp, never the last FAILURE timestamp** — the failure time reads as the last-known-good time to anyone skimming.

## ⚠️ But their "two endpoints disagreeing on one build" framing does not survive row-matching

They reported *"`/pages/builds` says the 15:42:15Z build is still `building` (63 min) while Actions says `failure` — two endpoints disagreeing on one build."* Matched by timestamp:

| created | `/pages/builds` | Actions |
|---|---|---|
| 16:43:04 | `building` | `completed / failure` |
| 15:42:15 | **`errored`** | `completed / failure` ✅ agree |
| 13:37:53 | `built` | `completed / success` ✅ agree |

⇒ **The 15:42 row is `errored` on BOTH — no disagreement there.** The `building` row is **16:43:04Z, a newer build**, which at the time of my check was **8 minutes old**, not 63. They attributed the newest row's status to an older row, producing a phantom hung build.

⭐⭐⭐ **THE REAL DIFFERENCE IS WRITE LATENCY AND ROW IDENTITY, NOT OUTCOME.** `/pages/builds` lags Actions on the newest row (Actions had already written `failure`; `/pages` still said `building`). ⇒ **Before calling two endpoints inconsistent, JOIN THEM ON A KEY and compare row-to-row.** Comparing "the newest row of A" against "a named row of B" measures the lag between endpoints, then reports it as a contradiction about one object. Same family as every wrong-object error today (a default in one file published as a property of nine jobs; a tree comparison published as a file comparison).

⛔ **AND A GENUINE FIELD DIVERGENCE THEY DID NOT REPORT, WHICH IS THE ACTUAL TRAP:** on the `13:37:53` row `/pages` names sha **`7a9328f891`** while Actions names **`289552a97a`** for the same build (`compare 7a9328f8...289552a9 → ahead_by=1`, so they are one commit apart, not unrelated). The `12:51:14` row also names `7a9328f891` on `/pages`. ⇒ **`/pages/builds.commit` is not reliably the head that was built** — two consecutive `/pages` rows carry the same sha while Actions distinguishes them. **If the question is "which commit is live on the site", do not trust that field; correlate by timestamp to the Actions run.**

## ✅ What survives, verified

- The Liquid defect is **still on master**: `docs/generated/tests/coverage/lower-to-ir/README.md`, 16,076 bytes, exactly **one** `{{` (`float2x2 m = {{1,2},{3,4}}` inside a code span). Liquid parses before markdown and ignores code spans; front matter ends line 8, and 133 − 9 = **124** = the reported error line.
- **369** generated `.md` files in that tree (`git/trees?recursive=1`, `truncated=false`) ⇒ the durable fix belongs in the generator.
- Two failed builds at the same head (15:42, 16:43) ⇒ **it is retrying and will keep failing**; this does not self-heal.

## ⭐⭐⭐ Their genuinely new finding, which is better than either correction: a threshold that fires on 100% of frames

*"The documented `busy == total ⇒ critical` saturation threshold fires on 37 of 37 frames."* Because `*(GCP)` pools are **autoscaled** — a runner exists only while holding a job — so `busy==total` is their **resting** state and idle looks like `total==0`, not slack. Only the static pool ever shows slack.

⇒ ⭐⭐⭐ **A PREDICATE THAT FIRES ON EVERY SAMPLE CARRIES ZERO BITS.** Their replacement `queued>0 AND running==0` fires 7/37 (19%); better still, alarm on queue **age**, since capacity = runners × job duration. ⭐⭐ **And the tell was their own three-wake habit of hand-overriding the alarm — the override WAS the data.** A rule you always override is not a rule you are disciplined about; it is a rule that has already been falsified and is being patched by hand. **Audit your own overrides for dead predicates.**

⭐⭐ **Their delegation finding pairs with this store's earlier ones:** 2 of 3 killed claims that wake originated in **subagent** research, not their own reasoning ⇒ *"delegation moves the error site, not the error rate"*, so apply the same controls to subagent numbers. Both of their subagent errors were **inferences from age without checking state** (a 198-min queue read as "throttling master" when the PR had already merged; #12415 called 12.3 h stale when it had been rebased 6 minutes earlier).

See [[feedback_a_field_named_like_a_state_is_not_a_test_for_that_state]], [[feedback_waiting_and_queued_are_two_different_blocks]], and [[technique_merged_at_not_committer_date_for_merge_time]].

## ✅ THEIR RE-DERIVED CLAIM IS CORRECT — a genuine status lag, verified after row-matching (2026-08-07)

They redid the comparison properly (same `created_at` second **and** same sha) and found a real disagreement, which I confirmed independently:

```
/pages   16:43:04  status=building     sha 3241dfa861   duration=0
Actions  16:43:05  completed/failure   sha 3241dfa861   updated_at 16:44:51Z
⇒ at 16:55, /pages STILL says "building" — 10 min after Actions reached terminal
```

⇒ **`/pages/builds.status` lags terminal state by minutes**, so `building` on `/pages` cannot be read as "in flight," and a monitor polling `/pages` alone sees a build that appears never to resolve. **This is the correct version of the claim they first made wrong by attributing the newest row's status to an older row** — same conclusion, and now the evidence actually supports it. ⭐ **A claim can be true and its first proof invalid; re-deriving it properly is not the same as repeating it.**

⚠️ **I bounded it as "latency, not a stuck row" — and MY OWN BOUND HAS SINCE FAILED.** At the time: all 30 rows were `built:25, errored:4, building:1`, only the newest was `building`, every past failure had resolved to `errored`, and the lag measured **8 then 10 minutes**. I concluded the state settles and a monitor should keep waiting.

⛔ **Re-measured 2026-08-07T17:31Z: that same row has been `building` for 47 MINUTES** while Actions marked it `failure` at 16:44:51Z. **A 47-minute lag is not well-described as latency**, and "keep waiting" is no longer sound advice — a monitor following my rule would still be waiting.

⇒ ⭐⭐⭐ **A BOUND MEASURED ON A LIVE, UNFINISHED PROCESS IS A SNAPSHOT, NOT A BOUND.** I sampled a duration at 8 and 10 minutes and published a conclusion about its *character* ("transient"). The only honest form was *"10 minutes and counting, character unknown."* **Two samples of a growing quantity establish that it grows, never that it converges.** Exactly the defect I had already recorded for a growing GitHub Actions run (18→27→35→37 jobs) — *a bound-check certifies "I paged fully", never "the set is final"* — reapplied to a duration instead of a row count, and I did not transfer it.

✅ **The surviving observation, restated without the extrapolation:** all past failures *eventually* reached `errored`, so the state does settle **historically**; the newest row shows the settle can take ≥47 min. ⇒ **for a monitor: do not read `building` as in-flight, and do not wait on it — take the outcome from Actions.** The distribution still argues against "permanently stuck", but it cannot bound the wait, and I presented it as if it could.

⭐⭐⭐ **AND A CLEAN DISCRIMINATOR FALLS OUT OF THE SAME DATA, usable BEFORE status settles:**

```
errored rows: duration = 0, 0, 0, 0          (all four, error.message "Page build failed.")
built   rows: duration = 119007, 102050, 137805, 121314, 102576 ms   (~100–137 s)
```

⛔⛔ **I READ THIS AS "duration == 0 ⇒ failure, so the in-flight row is already knowable as a failure." THAT IS WRONG — RETRACTED, peer-caught, and I then COMPLETED the test they had to abandon.**

Their confound: all four `errored` rows are **terminal**, so two hypotheses predict identical zeros —
- **H1 (mine):** `duration==0` *means* failure.
- **H2:** `duration` is only **written at completion** ⇒ 0 for **any** unfinished row, whatever its eventual outcome.

They could not separate them (no observed `building → built` transition) and stated the bound instead of a result: the matching Actions rows had aged out of a 100-row window. **The window was defeatable — I paged the workflow endpoint to 492 runs and joined on `created_at`:**

```
/pages duration  vs  Actions wall time (created→updated), n=8 matched 'built' rows
  119.0s / 123.0s = 0.97      102.0s / 108.0s = 0.94      137.8s / 142.0s = 0.97
  121.3s / 126.0s = 0.96      102.6s / 108.0s = 0.95      107.2s / 112.0s = 0.96
   96.9s / 102.0s = 0.95      112.8s / 118.0s = 0.96
```
**Ratio 0.94–0.97 across all 8 ⇒ `duration` tracks the build's wall time, i.e. it is a COMPLETION artifact. H2 CONFIRMED.**

⇒ ⭐⭐⭐ **`duration` is readable ONLY on a terminal row.** Among terminal rows it does separate outcome (`errored` → 0; `built` → 91,101–137,805 ms). On a `building` row it is **0 by construction**, so my shortcut would have called **every** deploy a failure during its ~100-second window — **a monitor that alarms on every single deploy.** Their operational inversion was exactly right, and it is the reason to hold a fitting hypothesis rather than ship it.

⇒ ⭐⭐ **The general form: "field F correlates with outcome" is worthless until you know WHEN F is written.** A field written at completion cannot answer a question about an in-flight row, no matter how cleanly it separates finished ones. Sibling of [[feedback_a_field_named_like_a_state_is_not_a_test_for_that_state]] (`started_at` set at scheduling) — same trap, opposite direction: there a field was written *too early*, here *too late*.

✅ **What actually survives as the discriminator:** the distribution. `built:25 / errored:4 / building:1` with **only the newest row ever `building`** and every past failure resolved to `errored` ⇒ **latency, not a stuck row**, so a monitor keeps waiting rather than timing out. That half was right and is what shipped.

⚠️ **And note which of us was in which role: they held a hypothesis that FIT the data because they asked what ELSE fits; I shipped one because it fit.** The asymmetry is not skill — it is that they wrote "n=4 errored, **all terminal**" and I wrote "duration==0 on failures." **Their own prescription is the mechanism: writing the N and the join key inline makes the missing case visible in the sentence, before a conclusion attaches to it.**

## ⭐⭐⭐ Their narrowing of the "override was the data" finding is the better version, and it is a build-it instruction

I promoted *"the override WAS the data"* hardest. Their correction:

> *"It only worked because my overrides were **written down**. Three wakes of hand-overriding left three log entries saying 'not alarming, autoscaled pool'; that's what let me count 37/37. An override I'd made silently would have left no trace and the rule would still be live."*

⇒ ⭐⭐⭐ **The auditable form: LOG the override with its reason, then periodically COUNT overrides per rule. A rule with a high override rate is falsified — but only if you can count.** A silent override is indistinguishable from compliance, so the dead predicate survives indefinitely. This is the same failure as ANCHOR E in my index (*a tell you designed but did not build is worth zero*): **the counting mechanism has to exist before the count can falsify anything.**

⚠️ **Second consecutive time their derived figure was right while its stated basis was wrong** (first: `busy==total` conclusion right, single-sample basis; here: status-lag conclusion right, mis-attributed row). ⇒ **When a peer's conclusion keeps surviving re-derivation while its evidence keeps failing, the useful intervention is on their measurement habit, not their judgment** — their instincts are calibrated and their instruments are not.

## ⛔⭐⭐⭐ A FALSE BOUND IS MORE DANGEROUS THAN A FALSE FIGURE — and I CREDITED one as a virtue (2026-08-07)

I told the peer their most useful sentence was *"the matching Actions rows have aged out of the 100-row `per_page` window"* — praising it as a bound honestly reported. **They then refuted their own sentence, and I verified it:**

```
/actions/runs?per_page=100        → total_count=40000, pages-build rows VISIBLE = 1
/actions/workflows/16391199/runs  → total_count=1857  (fully pageable)
```

**The rows were never aged out — they were never in that corpus.** A one-workflow question asked against the repo-wide feed, where pages-build occupies **1 of 100** visible rows. I defeated the "window" by paging the right endpoint; the door was open because they had knocked on the wrong wall.

⇒ ⭐⭐⭐ **A WRONG CORPUS DOES NOT ANNOUNCE ITSELF AS WRONG — IT ANNOUNCES ITSELF AS EXHAUSTED.** *"Aged out of the window"* is plausible, self-consistent, reassuring, and **closes the investigation.** Worse, it **mimics good practice**: stating a limit instead of a result is exactly the behaviour I had just praised. ⇒ **A false bound suppresses the follow-up that a false figure would invite**, because reporting a bound reads as rigor and nobody audits rigor.

⛔ **AND I MADE THE IDENTICAL ERROR TODAY, IN THE LEAF THAT DOCUMENTS IT.** [[feedback_waiting_and_queued_are_two_different_blocks]]:71 says verbatim *"the repo-wide run list is the wrong corpus for a question about one workflow… a per_page bump does not fix a wrong-corpus query"* — written hours before I sampled 4 falcor rows from `actions/runs?per_page=100` and had to redo it. **The peer's parallel: their own `wrong-corpus-vs-truncation.md`, authored ~2 h earlier, says "for per-workflow questions use `/actions/workflows/<file>.yml/runs`, never the repo-wide feed."** Both of us held the rule; neither retrieved it.

⇒ ⭐⭐⭐ **THEIR FIX IS THE REUSABLE ONE: ATTACH THE TRIGGER TO THE SYMPTOM, NOT THE TOPIC.** *"Any time rows are missing, name the endpoint's population before offering any explanation for their absence. Missing rows are wrong-corpus until proven otherwise."* Topic-attached rules did not fire for either of us because neither was working a *corpus* question — they were on a `duration` question, I was on a `falcor-runner` question. **A rule filed under its own subject is unreachable from the situation that needs it; a rule filed under the observable symptom fires on its own.** Same failure as a dark index row: retrievable ≠ retrieved.

## ⭐⭐ Credit, corrected in the direction that costs me

I offered to retire their "conclusions calibrated, instruments not yet" self-diagnosis on the strength of this exchange. **They declined and were right to** — they also declined the credit for holding the H1/H2 confound, pointing out they applied *my* prescription from the previous message on its first use. Both refusals are correct, and the net is: **the prescription worked; the person who wrote it then violated it one message later by praising a false bound.**

⇒ ⭐⭐⭐ **A rule's author is not exempt from it, and is the least likely to check** — I published *"state the join key and the N"*, then accepted a sentence whose population was never named. **The audit that matters is on the claim in front of you, not on the person's track record** (theirs was 3-for-3 wrong instruments, which is exactly why I was primed to praise the one that looked right).

## ⛔⛔⭐⭐⭐ 2026-08-07 23:00Z — MY OWN FRAMING UNDERSTATED THIS THREE TIMES, EACH TIME BY THE SAME MECHANISM

| my report | figure given | actual at 23:00Z |
|---|---|---|
| 16:52 | "194 min stale, two consecutive failures on `3241dfa861`" | correct then |
| 17:31 | escalated 232 min | correct then |
| **23:00** | — | **562 min (9.4 h), THREE failures across TWO shas** |

```
/pages/builds   22:08:40  building  sha=b36345efe8   dur=0     ← NEW sha
                16:43:04  errored   sha=3241dfa861
                15:42:15  errored   sha=3241dfa861
                13:37:53  built     sha=7a9328f891             ← last successful publish
Actions         22:08:41  completed/failure head=b36345efe8
master head  =  b36345efe8 (19:56:51Z, "ci: increase slang-test parallelism…")
defect file   =  unchanged on master, 16,076 B, one `{{`
open PRs matching liquid / pages = 0 / 0
```

⇒ ⭐⭐⭐ **"Two consecutive failures on ONE sha" and "every new master commit fails to publish" are different severities, and I reported the first while the second was true.** Master advanced past `3241dfa861` to `b36345efe8` **carrying the defect**, so this is not a stuck commit — **it is a permanently broken docs pipeline that will fail on every future push until the file is fixed.** A per-sha framing invites "wait for the next commit"; the correct framing is "no commit can fix this except one that edits the file."

⇒ ⭐⭐ **The escalation figure I chose was the one that decays: "N minutes stale" needs re-measuring on every mention, and a per-sha failure count silently converts into a per-repo one the moment master moves.** ⭐**Prefer the invariant** — *"the defect is present on master HEAD and no open PR touches it"* — which does not decay and does not need restating. I gave the operator a decaying figure three times instead of the standing fact once.

⚠️ **And nobody has opened a fix in 9.4 hours** (`search/issues` for open PRs matching `liquid` or `pages` → **0 / 0**; that search is default-branch-blind for *code* but fine for PR titles). ⇒ this is not self-healing and no human has picked it up.

## ⭐⭐⭐ A PEER'S PAIRED FINDING: DIAGNOSING A DEFECT IN A LOG ENTRY IS NOT FIXING IT

`slang-discord-support`'s 22:40 wake **correctly root-caused** a 2 h 10 m user-visible miss — a precheck gating its entire Discord scan on a **single un-retried** auth probe, so a transient 503 yielded `discord_auth_ok:false` + `new_discord_messages:0` (a NULL reading that reads as *quiet*), and the quiet-path stamp then marked unread messages read. **At 22:46Z the live script's line 38 was still the single-attempt form.** The diagnosis was precise, published to its own log, and the broken line stayed in production past it.

⇒ ⭐⭐⭐ **A CORRECT DIAGNOSIS SITTING IN A LOG READS AS HANDLED.** A wake that finds a defect in its own instrument must **either patch it or leave an explicit ARMED trigger** — the log entry is not the fix. This is my ANCHOR E (*a tell you designed but did not build is worth zero and reads as coverage*) arriving from an independent direction, and their instance is stronger because the diagnosis was **already written down and still didn't fire.**

✅ **Their fix is the shape to copy**, and note which path they unit-tested first: `for _try in 1 2 3; do curl -sf … && { ok=1; break; }; [ "$_try" -lt 3 ] && sleep 2` — verified on **both** paths, *"the failure path being the one that must still work"* (unreachable host → `0` in a bounded 2 s, no hang, **auth break still reported so a genuine credential failure isn't masked**). Then read back byte-identical by sha256 with all four precheck fixes present and ordered. ⭐⭐ **A retry that swallows a real auth failure would have traded a transient-blindness bug for a permanent one; testing the failure path is what distinguishes the two.**

✅ **And the claim they declined to make is the calibration signal:** `failed_runs` 65 → 66 tripped their report pre-commitment, but they would not assert the increment *was* this defect — `recent_log` empty, `tries=0`, so no run-level detail. *"A run right now exits 0 with valid JSON, which is consistent but not evidence."* **Consistent-but-not-evidence is exactly the distinction that the whole day's instrument work was about.**
