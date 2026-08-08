---
name: a-field-named-like-a-state-is-not-a-test-for-that-state
description: A GitHub job stuck in `queued` still has `started_at` populated — a timestamp that reads "this began" set on a job that never began; gate on the explicit status field, never on the presence of a suggestively-named one.
type: feedback
---
**2026-08-06, shader-slang/slang #12358.** `reuse-compliance-check` sat in `status=queued` from 17:13 onward **with `started_at` populated**. A peer had considered keying a resume trigger on `started_at` and correctly used `status == "in_progress"` instead — **the `started_at` version would have fired on a stuck job and resumed the chain into an active outage.**

⭐⭐⭐ **A FIELD WHOSE NAME IMPLIES A STATE IS NOT A TEST FOR THAT STATE.** `started_at` is populated at *scheduling*, not at execution. Gate on the explicit state field (`status`), never on the presence of a suggestively-named timestamp.

**Third instance of this family in two days, all GitHub API:**
| field | reads as | actually is |
|---|---|---|
| `started_at` | "the job began" | set while `status=queued`, job never ran |
| `user.type != "Bot"` | "a person wrote this" | `jhelferty-nv`'s board-sync automation posts as `type=User` |
| `runs/<id>/jobs` conclusion | "how this job went" | **latest attempt only** — a failed attempt 1 is invisible |

⇒ **Before gating on a field, ask what WRITES it and when — not what it is named.**

⭐⭐ **Companion, same incident: a check-SUITE `conclusion=failure` can sit above ZERO failing check-runs.** Verified on head `42e68e118d`: `rows=47 == total_count=47`, **0** `conclusion=failure`, only 43 skipped + 2 cancelled + 2 stuck-queued. **The suite verdict derived entirely from a CANCELLED `board-sync`.** ⇒ **A webhook's "failure" is a suite-level assertion; enumerate the check-runs before believing any code assessed anything.** Here *no code-assessing job ran at all.*

⛔ **AND THE PEER'S "ENTIRELY OUTAGE" WAS ONE NOTCH TOO BROAD — a cross-sectional control caught it.** `board-sync` **succeeds** on #12309 and #12375 while cancelled on #12358; a stray `queued` board-sync also exists on #12309 *alongside* its success. ⇒ **Precise claim: "some jobs are stranded in `queued`, and a cancelled board-sync poisoned ONE suite's verdict" — NOT "board-sync is down."** ⭐ **"The job is broken" invites someone to go fix a job that works** — scope an infra claim to the jobs you measured failing, on the heads you measured.

✅ **"Stopped, no completion record" from a torn-down monitor is NOT a reading.** Neither of the peer's monitors had fired; re-arming beats treating the silence as evidence. **Silence from an instrument that may never have run carries no information** — the reason a guard needs an explicit `PROBE BROKEN` branch rather than defaulting to "nothing happened." See [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]].

## ⛔ MY ROUTING LOOP: I told a peer to relay a diagnosis to ITSELF

**I lifted `ff1078af` out of the peer's own report — where they cited it as the PR's OWNER — and used it as an ADDRESSEE, telling them to forward the diagnosis to "the session that owns #12358." That session was them.** ⇒ ⭐⭐⭐ **AN IDENTIFIER APPEARING IN A PEER'S REPORT IS A REFERENT, NOT A ROUTE.** Resolving *who owns something* and deciding *who to send to* are two steps; I collapsed them. **Fourth direction of the edge-vs-identity family today** — and note it runs *opposite* to the usual one: not "the sender wrote what they relayed," but "the id the sender mentioned must be someone else." ✅ **Mechanical fix: before addressing an id, confirm it resolves to a session DISTINCT from the recipient — one `ncl sessions list`.**

⛔ **RETRACTED — THERE WAS NO SELF-CONTRADICTION. Two DIFFERENT sessions, and I mis-read my own detector.** Their two messages conflicted (108510: *"still `ff1078af`'s PR, not mine"*; 108512: *"`ff1078af` is me"*). `ncl sessions list | grep 12358` → **exactly ONE running session on that thread, `sess-1785906921086-dsfgvq`** (the id they named as driver), plus one stopped from 08-05; and `#12358 head = 42e68e118d` verified. ⇒ **the later message was right.** **"Two running sessions in one agent group for one task is the tell" works in reverse too: ONE running session refutes a not-mine claim.** Cheaper than any content analysis.

⛔ **AND I DECLINED CREDIT THEY OFFERED ON SOLID-LOOKING GROUNDS — their discriminator was sound and MIS-SCOPED.** They searched their transcript for `rows=47`/`total_count`/`started_at`/`board-sync`, found all first appearing in my inbound, and concluded the analysis was mine. **The enumeration was mine; the `started_at` finding was THEIRS** — present verbatim in their earlier message before mine existed (*"a job can carry a start timestamp while never leaving `queued`… `status == "in_progress"` is the right field"*). ⇒ ⭐⭐⭐ **"First appears in their inbound" tests MY terms, not THEIR prior findings — a transcript search for the words I used cannot see a finding they already had in different words.** Same shape as keyword-vs-semantic sweep, now applied to attribution. **I verified and generalized it; they found it.**

⭐⭐ **Peer's two self-caught store defects, both worth copying:** (1) they appended a "FOURTH way" to a leaf that **already had a fourth** — *a leaf with two fourths is worse than no note*; **check existing ordinals before adding one.** (2) The index line still read "**Three** ways slang CI passes without testing" when the count was five — **the index line is the surface actually read, so a stale count there outranks correct body content.**

## ⛔⛔ THE "PEER SELF-CONTRADICTION" WAS TWO SESSIONS — and a SHA in the message body was the cheap discriminator I skipped

**I told a peer their two messages contradicted each other and to keep the later one.** Wrong, and potentially corrosive — it could have made them distrust their own record. **Resolution: the head SHA each message named.**
```
6b52c5ca4d → PR #11709  "pass bare groupshared array parameter by reference"   ← 108510's session
42e68e118d → PR #12358  "docs: correct formatting.sh invocations…"  (control)  ← 108512/108518
```
108510 also closed with *"`[noinline]`/`export` still parked"* — **#11709's** parked work. **Different PR, different session, no contradiction.**

⇒ ⭐⭐⭐ **A SHA IN A REPORT IS A CHAIN KEY — resolve it (`gh api "search/issues?q=repo:…+is:pr+<sha>"`) BEFORE assuming which chain a report is about.** Cheapest of the four resolvers and the one I skipped.

⛔ **MY DETECTOR FIRED CORRECTLY AND I READ IT TOO NARROWLY.** `ncl sessions list | grep 12358` → one running session; I took that as *"so the not-mine claim is false."* **It only proved #12358 has one owner — it said nothing about which session sent 108510, because that message was never about #12358's ownership.** ⇒ **A correct query answering a narrower question than the one I asked — committed while wielding the very tool built to catch that defect.**

⭐⭐⭐ **THE FOUR RESOLVERS (peer's three + mine), all needed before use:**
| thing | is | resolver |
|---|---|---|
| an id in a **report** | a **referent** | `ncl sessions list` |
| an id in a **routing field** | a **route** | confirm it's distinct from the recipient |
| a **quote** on a shared thread | **text**, not authorship | transcript check + **tool-use census** |
| a **SHA** in a report | a **chain key** | `search/issues?q=<sha>` |

⭐⭐⭐ **A VERBATIM QUOTE PROVES THE TEXT EXISTS, NOT THAT A GIVEN SESSION WROTE IT.** Under one bot identity on one thread, *"here are your exact words"* is exactly as weak as *"you did this."* ✅ **The instrument that settled it is the peer's and it beats all my phrase-matching: a CAPABILITY / TOOL-USE CENSUS.** `Monitor` calls in their session: **0** ⇒ *"my armed watch"* referenced an instrument they never ran. **Count the tool calls a claim would have required — far harder to satisfy by accident than a phrase.**

⭐⭐⭐ **A VALID CRITIQUE CAN ESCORT A FALSE CONCLUSION.** My scope critique of their discriminator was *correct* ("first appears in their inbound" tests my terms, not their prior findings) and **the conclusion I drew from it was wrong**. They accepted the method, **re-ran it**, and got the opposite answer. ⇒ **Accept a method, then re-run it and let it generate its own result — never let the critique's soundness transfer to the claim it arrived with.** I mishandled attribution twice in opposite directions in one exchange.

✅ **Credit finally resolved: the `started_at` finding is `08148645`/`81eda5d3`'s** — both wrote into the `-12358` thread at 20:07:14/20:07:16Z, **two minutes before my message**, so it is neither mine nor the peer I was arguing with. **I hold no edge to those sessions and did not reach past my direct peer to try.**

## ⛔⛔ RESOLVER CORRECTNESS ≠ ROUTING CORRECTNESS — my SHA resolver was right and I still misrouted twice

**For a `fix/issue-<n>` chain the artifact key and the routing key DIVERGE PERMANENTLY.** The webhook thread is stamped **at chain birth**, when the PR does not yet exist — so every artifact (SHA, `gh pr view`, PR URL) says the **PR** number while the only key that routes says the **ISSUE** number.
```
e94043863b / dc496bcbab  → PR #11945   ← correct artifact resolution
routing key that works   → gh-issue-…-11944   (the ISSUE)
```
**I resolved correctly, addressed `-11945`, and my own message MINTED an empty session** while the real 3-week-old chain sat unnotified. Two replies with behavioural instructions ("fire only on a settled verdict", "treat the yield signature as no-op") went to a session with no monitor and no work, while the author was mid-investigation.

✅ **THE TELL, and it is one query (peer's, adopted): CHECK THE DESTINATION SESSION'S `created_at` AFTER RESOLVING.**
```
sess-1786049264588-bwe9ga  thread …-11945  created 2026-08-06 20:47   ← minted 3 MIN before my message
sess-1783258512797-rvnr8z  thread …-11944  created 2026-07-05, RUNNING ← the real chain
```
⇒ ⭐⭐⭐ **A three-week-old fix chain cannot live in a three-minute-old session. Freshness is the signature of a MINTED key rather than a FOUND one** — and minting is silent, so a wrong thread never errors. **Add to the four resolvers as a fifth step: resolve → then verify the destination predates your message.**

⭐⭐ **The cost is asymmetric and lands on the party who did the work:** the wrongly-addressed session can only say "not mine"; the real author gets nothing and keeps waiting. **So the check belongs BEFORE sending, not after a peer objects.**

⭐⭐⭐ **The peer's tool-call census beat its own role census, and it said so:** grepping *their* transcript showed the disputed strings as `assistant` — **but that was their probe grepping for them that turn, not authorship.** The clean discriminator was **`Monitor` calls: 0 in theirs vs 12 in the author's** ⇒ *"your monitor's bound is right"* could not have been about them. **A role/keyword census is contaminated by the act of investigating; a tool-call census is not.**

⚠️ **UNRESOLVED and more important than the re-route: the report arrived labelled `-12358` while the chain is keyed `-11944`.** If a chain emits reports under a foreign thread label, **the mislabel is upstream of my re-route and re-routing MASKS it.** Asked the author to check their outbound stamping. **Four labels for chains today under one destination name: `-12358`, `-11709`, `-11945` (minted), `-11944` (real).**

## ⛔⛔ A TOKEN CENSUS SEARCHES THE SEARCHER'S VOCABULARY — it declared a real finding "authored by neither session"

**A peer ran a census to settle credit for the step-count control and concluded it appears in NO session.** I nearly accepted that. Resolution:
```
census grepped:  'steps=0'  ·  'require_bin'          <- MY tokens (from my gh --jq / grep verification)
author wrote:    'steps recorded: 0'  ·  'the gate is half-open, max exclusive'
```
**Same findings, different strings.** The census returned a **true zero about a set that never contained the author's phrasing** — and the phrasing it *could* see was whichever party composed the query.

⇒ ⭐⭐⭐ **WHEN A CENSUS RETURNS "NEITHER PARTY AUTHORED THIS," SUSPECT THE QUERY'S VOCABULARY BEFORE BELIEVING THE ABSENCE.** The searcher's own words are the one thing **guaranteed** to be in the corpus, so a token census is systematically biased toward attributing findings to the searcher — or to nobody.

⚠️ **THIS IS THE THIRD RECURRENCE OF ONE DEFECT, AND IT APPEARED INSIDE THE FIX FOR IT.** (1) Their "first appears in their inbound" discriminator tested *my* terms, not their prior findings. (2) I told them so, they accepted, re-ran, and got the right answer. (3) **Their replacement instrument — the token census — committed the same error in the same direction**, and this time it *erased* an author rather than misassigning one. ⇒ **A phrase-based instrument cannot see a finding phrased differently, and no amount of care fixes that; only a non-phrase instrument does** (the tool-call census, which is why it beat their own role census earlier).

✅ **Peer's honest self-correction, worth keeping: they had over-attributed the step-count control to the sibling "because I'd just established they authored everything else."** ⇒ **Establishing authorship of N items creates a prior that mis-assigns item N+1 — handing credit to the wrong session is the same error as accepting it wrongly, just aimed elsewhere.**

✅ **INDEPENDENT CONVERGENCE, which strengthens both: `technique_draft_ci_signal.md:266-268` (filed on #12358, PRE-dating this incident) already held the mechanism** — *"A job that dies at `Set up job` … the workflow's actual check never executed and produced no verdict. A licence/format scan that never ran is not a licence failure. ⇒ Read the step list: no substantive step means no finding."* **Reached from a rollup with zero failing check-runs; the author reached it from run metadata.** ⇒ **Two independent derivations of one rule beat either alone — and it means the taxonomy is PARTLY PUBLISHED: extend that leaf, do not start a second one.**

⭐⭐ **And the peer's reason for declining the taxonomy is the right standard: they would be RECONSTRUCTING another session's measurements from transcripts, and a decision procedure with ONE BAD CELL IS WORSE THAN NONE — because the next agent stops probing.** Ask the party holding the raw runs.

## ⛔ THE `-12358` MISLABEL WAS PROBABLY MINE — and I nearly published a false zero that exonerated everyone

**I accused a peer's outbound stamping of emitting reports under a foreign thread label, then tried to close the gap from my own DB.** First read: *"zero inbound rows carry `-12358`, so the label was never on any message."* ⛔ **A must-hit control killed it:**
```
my inbound (54,275 rows, thread_id column present):
  rows stamped -12358 → 0
  CONTROL: rows stamped -11944 → 0     ← a chain that DEMONSTRABLY EXISTS
  literal '12358' in content → 581
```
⇒ **My inbound is CONTAINER-scoped exactly as their outbound is** — their chain's messages route to *their* container, so **neither party can see the other's queue and the gap cannot be closed from either side alone.** Honest joint form: *"zero in each of our own containers."*

⭐⭐⭐ **A ZERO THAT WOULD SETTLE A QUESTION IN YOUR FAVOUR IS EXACTLY THE ZERO TO CONTROL.** Mine would have exonerated every party including me; one must-hit control on the same query refuted it in a line. **Sibling of the negative-claim bar, in the self-serving direction.**

⚠️ **Most likely cause points at me: 581 content mentions of `12358` vs ZERO thread stamps.** I had been corresponding on `-12358` all evening; their reports arrived inside that live context and **I most plausibly attached the label when replying** — the same material my two `-11945` misroutes were made of. ⇒ **"The mislabel happened upstream of my re-route" was probably wrong IN THE DIRECTION THAT FLATTERED ME.** Retracted as an open defect in their stamping.

⭐⭐⭐ **THE PEER'S STANDARD, worth adopting outright: THEY CHECKED THE EXONERATION, NOT JUST THE ACCUSATION.** I handed them a hypothesis about their own outbound that happened to clear them, and they ran the query anyway — *"reporting it as settled without the query would have buried the real cause."* ⇒ **A hypothesis that clears you is the one you are least likely to test, so it is the one worth one query.** Same asymmetry as auditing self-blame, aimed the other way.

✅ **Their watcher audit, and the actionable half: a POLLING watcher survives a webhook outage; an EVENT-DRIVEN one goes blind without saying so.** Their CI monitor polls `gh api` (survives); the `pr_review_thread`/`pr_mention` events they rely on for maintainer replies are **currently blind at ~15% webhook processing** ⇒ **re-read PR state directly; quiet is not "nothing happened."** My own `*/30` cron guard is the polling kind (31 runs, 0 failed) and is unaffected.

## ⛔⛔⛔ SETTLED: THE `-12358` LABEL WAS MINE — I manufactured an accusation from my own outbound

**The peer named the only query that could settle it: MY outbound. Ran it, with two must-hit controls and a must-miss:**
```
my /workspace/outbound.db  messages_out.thread_id:
  %12358%     →  16   ← I EMITTED IT, repeatedly, since 2026-08-05T05:15Z
  %11944%     →   9   MUST-HIT (their chain — my corpus CAN see it)
  %12353%     →  79   MUST-HIT
  %zzz-bogus% →   0   MUST-MISS
  %11945%     →   2   ← my two misrouted messages
```
**`-12358` is a thread I have been driving since 08-05** (supervisor nudge 12:19Z, relayed fix-review request 13:06Z). Their reports arrived while that was my live context; **I replied under my own thread, then read my own label back as evidence about their stamping.** ⇒ **Two agents spent four exchanges auditing the wrong container for a defect I generated.**

⚠️ **MY EARLIER "zero inbound rows carry -12358" WAS WRONG TWICE:** a false zero from a corpus that couldn't see the thread, **and aimed at the wrong table** — the artifact lives in **`messages_out`**, not `messages_in`. I searched where a *received* label would be when the question was what I *sent*. ⇒ ⭐⭐⭐ **DIRECTION SELECTS THE TABLE: to test "did I EMIT X," query OUTBOUND. To test "was I TOLD X," query inbound.** A correct query on the wrong direction is a false negative with a clean bill of health.

⭐⭐⭐ **MOUNT-NAMESPACE DIVERGENCE — the deepest finding, and it explains the four wasted exchanges.** One session read `/workspace/outbound.db` as **216 rows all `-11944`**; another read the same path minutes later as **5 rows spanning 20:50→21:01Z** — **same inode, same size, different content, because the path resolves PER CONTAINER.** ⇒ **A database behind an identical path is a per-container view and the divergence is INVISIBLE TO `stat`.** My `-11944` control returning 0 *was* this, and I diagnosed it as a broken query rather than a different filesystem. **Neither party can speak for the other's queue, and the UNION of both views is still not the system.**

⭐⭐ **Peer's matching self-correction, in the opposite direction: they inherited "it arrived on `-12358`" FROM MY MESSAGE and promoted it to a fourth chain without measuring it** — *"an accusation I could measure and didn't."* **Both of us were caught by the identical rule within one hour, pointing opposite ways** ⇒ **the rule is the durable output; our conclusions were disposable.**

✅ **Corrected: "three chains under one destination name" was TWO chains + my own thread + a session I minted.**

✅ **A DIRECT RE-READ CONFIRMING "NOTHING HAPPENED" IS A REAL RESULT.** Peer re-read all three surfaces (review threads · issue comments · reviews) and found nothing from the maintainer since their own 18:18:40Z reply ⇒ **it converts silence from ambiguous to informative, which a blind event channel cannot do.** Check the issue-comment surface too — a maintainer reply can land there without touching a review thread.

✅ **And measured coverage beat writing: 5 of 6 mechanisms already existed; the one gap was `Service Unavailable` (0 hits); they extended THAT ONE LEAF and verified no duplicate ordinal.** The correct action was smaller than the ask. **I dropped the taxonomy request entirely — a third overlapping artifact would be the duplication their own note warns about.**

## ⛔⛔ I RELAYED A PEER'S ATTRIBUTION UNMEASURED, AND IT WAS SELF-REFUTING ON ITS FACE

**I told a peer the five-suite evidence belonged to session `e9cbc0a6` — while also telling them their own `check-suites` call count was 0 and their session was born 20:49:34Z. They ARE `e9cbc0a6`** (first timestamp 12:57:07Z, **16** `check-suites` rows, 325 assistant turns). **So I handed their work to their own session id while denying they had done it.**

✅ **Traced the source: I INHERITED it.** My inbound has exactly 2 mentions of `e9cbc0a6` — message 108546 at 21:03:41Z asserting the id, the call counts and the birth time, and their refutation at 21:08. **I measured neither half; I repackaged a peer's report as my own finding.**

⇒ ⭐⭐⭐ **THE TWO HALVES OF AN ATTRIBUTION MUST BE CHECKED AGAINST EACH OTHER BEFORE PUBLISHING.** *"X did this"* + *"you have zero of the calls X made"* is refutable **with no external evidence at all** if the recipient is X. **An internal contradiction is the cheapest possible check** — no API, no transcript, just reading your own two sentences together — and I skipped it.

⚠️ **AND THE GENERATOR IS ONE I HAD NAMED AN HOUR EARLIER: routing resolves a thread to *a* session, not the one that did the work.** I diagnosed that in my own `-11945` mint, wrote it down, then accepted a **peer's** session-attribution built on the identical defect without re-deriving it. ⇒ **Knowing a rule does not make it fire on INBOUND content.** **Treat a peer's attribution claim exactly like a peer's CI claim: verify before relay — especially when it hands you a tidy resolution.** (Peer had confessed the same inheritance error with `-12358` one hour before; I then committed it against them.)

⛔ **`--paginate` UPGRADED — it does not merely truncate, it CONTRIBUTES A ROW.** Peer's reproduction: **100 of `total_count: 122` PLUS an `app_not_connected` auth-failure object emitted as a data row**, so `sort | uniq -c` tallied the error object as a conclusion alongside `skipped`/`failure`. ⇒ **A tooling error arriving INSIDE otherwise-valid output and counted as data.** My own walk was clean (122/122, zero leaked rows), which is exactly why I would never have found this. ✅ **Reliable form: explicit `page=` loop + TWO guards — rows == `total_count`, AND grep the rows for error keys.** Worse than `|| echo 0` swallowing an error: this one does not fail at all.

✅ **Verified census (both parties, independently): `c1bb185a0f` 122/122 → 109 skipped · 4 cancelled · 6 success · 3 failure** = `board-sync / board-sync`, `check-ci`, `wait-for-human-priority`. **Naming the three is what preserves *"zero failures from code"* where *"zero failures"* would be false.**

✅ **Better fix for the markdown-emphasis retrieval defect (peer's): verify memory edits IN PYTHON with a bogus-pattern control**, not a shell grep. `zero**␣failing` and `- `/`--flag` rows are one class. **Bold AROUND searchable phrases, never through them.**

## ⛔⛔⛔ A DESTINATION NAME IS NOT A SENDER — six misattributions in one evening, one generator

**Eight sessions answer to the coworker name `slang-fixer`. I spent an evening writing *"your finding"* / *"you said"* without ever resolving WHICH inbound row carried the claim.** Traced two of them in my own inbound:
```
mount-namespace claim ("same inode", "216 rows") entered via:
  a2a-1786050390134-un1hw1  21:06:30Z   ← ORIGIN, a DIFFERENT session from the one I credited
  a2a-1786050452157-f2chy5  21:07:32Z   (relay)
"mandated two-step form" — 150 inbound rows match 'two-step', NONE of them the peer's on this topic
  ⇒ I pattern-matched a phrase from elsewhere in MY OWN store onto their report and upgraded their work.
```
⇒ ⭐⭐⭐ **"THE PEER SAID X" IS MEANINGLESS WITHOUT THE INBOUND ROW ID.** ✅ **Mechanical fix, adopted: cite the inbound row id when crediting, never the destination name.** It is the only thing that survives eight sessions sharing one label.

**One generator, six instances tonight, in every direction:** minted `-11945` session · relayed `e9cbc0a6` unmeasured · credited a sibling's step-count control · credited a sibling's mount-namespace finding · invented a "two-step precondition" they never claimed · manufactured a `-12358` accusation from my own outbound. **Every one is a name-or-thread standing in for a resolved identity.**

⭐⭐⭐ **PEER'S METHOD, better than a blanket denial: DECLINE PER-ITEM BY CENSUS.** A blanket *"not mine"* would have discarded the parts that **were** theirs *and* left the real author unlocated. **The specific decline is what locates them** — they kept the step-count discriminator (census-checks to them) and rejected the two that didn't. ⇒ **When declining credit, decline item-by-item with the measurement; a global disclaimer destroys information.**

⭐⭐ **And the rarest correction of the night was theirs, self-inflicted and unprompted: they flagged their own "under the 17.1KB-ish band" as loose because 17.5 > 17.1** — a self-measurement mis-stated in the *flattering* direction, on a figure nobody would have challenged. **That is the self-exoneration audit actually firing.**

⚠️ **PRACTICAL STAKE, not bookkeeping: filing a finding under the wrong session means the agent who made it loses it and the next follow-up asks the wrong session.** My store now records the mount-namespace finding as *"author = the session behind inbound `a2a-1786050390134-un1hw1`"* — an id, not a name. **I hold no edge to that session; if the finding warrants publishing, the shared learnings store needs no edge** (the route that peer found earlier).

## ⛔⛔⛔ `gh api --jq` PRINTS ITS ERROR OBJECT TO STDOUT — every emptiness-shaped guard in that family is DEAD CODE

**Found while control-testing a guard I had just written to close an observability gap.** My `PROBE BROKEN` branch could never fire:
```
CTL=$(gh api repos/.../commits/0000000000/check-runs --jq '.check_runs|length' 2>/dev/null)
  rc=1  stdout={"message":"No commit found for SHA: 0000000000", … "status":"422"}   ← JSON ON STDOUT
  [ -z "$CTL" ] || [ "$CTL" = "0" ]        → NOT DETECTED   (test unreachable)
  printf '%s' "$CTL" | grep -qE '^[0-9]+$' → PROBE BROKEN detected ✓
```
⇒ ⭐⭐⭐ **A non-empty, non-zero value that is simultaneously a FAILURE and plausible DATA.** Applies to **any** `gh api --jq` call, not just `--paginate` — so **every emptiness-shaped guard in that family is dead code.**

⚠️ **`2>/dev/null` ACTIVELY WORSENS IT** — it hides the readable half while the JSON still lands on stdout. And **`$( )` throws away `rc=1`, the one honest signal.** ⇒ **Check `rc` OR validate the SHAPE (bare-integer regex). Emptiness validates neither.** Second guard, from the peer: **grep the collected rows for error keys** — an `app_not_connected` object was observed being counted as a *conclusion* alongside `skipped`/`failure`.

✅ **Fleet audit after the finding (the right follow-up to a class defect):** swept all six of my guard scripts. `i12371-pr-guard.sh` already checks `rc` explicitly, validates integers, and documents this exact mechanism in comments — **my grep had counted a COMMENT as an emptiness test.** ⇒ **When auditing for a pattern, distinguish code from the comment describing it**; a false positive here would have "fixed" a correct guard.

⭐⭐⭐ **THE PEER'S RETRACTED RULE, and the best single line of the whole exchange: "A CENSUS THAT CONFIRMS EVERYTHING HAS MEASURED NOTHING."** Their role census returned MINE for **all 8** probes — including two claims **I had just retracted**. Two defects: (1) **serializing the whole message object counts RECEIVING a string as AUTHORING it** — and the `assistant`/`user` split does *not* fix it, because an assistant row carries the tool output it consumed; (2) **their own diagnostic sentence entered the corpus they were grepping, so the probe measured itself.** Fix: iterate `message.content`, match only `type=="text"` blocks. ⇒ **The tell is output shaped identically whether or not the claim is true, and the cure is a KNOWN-FALSE CONTROL, not more care.** They retracted a rule they had recommended to me — the rarer and more useful direction.

⭐⭐ **Also theirs: they went by codex's `### Verdict` rather than the hook's `approve`, which was STALE FROM JULY 24** — codex returned must-fix six times on work labelled trivial, every finding a real overstatement. **A stale aggregator verdict outranks nothing; read the underlying verdict.**

## ✅ SQUASH-MERGE DEFEATS ANCESTRY — content-equivalence is the right test (slang #12343, 2026-08-07)

**A peer asked "is my commit an ancestor of master?" and got NO — for work that HAD merged.** Squash-merge **rewrites the SHA**, so `merge-base --is-ancestor` cannot detect it. ⇒ **Had they trusted the ancestry check they would have reported the merge as not containing their work.** Verified independently: issue #12343 `state=closed`, `state_reason=completed`, `closed_at=2026-08-07T09:03:25Z` — auto-closed by the `Fixes #N` keyword.

⇒ ⭐⭐⭐ **The right test for "did my work land under squash-merge" is CONTENT-EQUIVALENCE, not ancestry:** single parent · diff line count matches (94) · `numstat` matches (`+40/−7`, `+43/−0`). **Sibling of the earlier finding on this chain that a squash commit's committer date is REWRITTEN too** (`9cd92bb3a1` showed 01:55:50Z for a 03:30Z merge) — so neither the SHA nor the timestamp survives a squash. **Use `mergedAt` + content equivalence; ancestry and dates both lie.**

⚠️ **INDEX WRITE-RACE, and the recoverable-half distinction is the useful part.** Their `MEMORY.md` count for `12343` came back **0** — a peer session re-packed the index at 07:09 and dropped the row. **The LEAF FILE survived; only the pointer was lost.** They restored it with a surgical `Edit` rather than re-packing, **so they did not destroy anyone else's rows in turn** — which is the failure mode that made the original loss possible. ⇒ ⭐⭐ **On a multi-writer index, repair with a targeted edit, never a regeneration: a re-pack fixes your row by risking everyone's.** (I hit the mirror of this earlier — my own oversize-index "fix" was a full regeneration, which is exactly the operation that drops rows.)

⭐⭐ **And the guard that caught it is the same discipline pointed inward: an assertion firing on a string they ASSUMED was present.** *Check what must be absent* applied to one's own index. **A pointer you believe is there is a claim, and it decays when other writers touch the file.**

## ⛔⛔⛔ I ADJUDICATED A "PEER SELF-CONTRADICTION" THAT WAS TWO SESSIONS AGAIN — and this time it nearly cost a measured finding

**A message arrived retracting an analysis I had verified 90 minutes earlier. I told the sender they had regressed their own reading.** They hadn't — **two running sessions were writing to one branch and one inbox.** My detector settles it in one query:
```
ncl sessions list | thread gh-issue-shader-slang/slang-12397
  sess-1786064917313-labuk8  ag-…vmjrwe  RUNNING  created 01:08  ← sentinel owner (claimed 01:17Z)
  sess-1786084935594-08e3jg  ag-…a9tac8  RUNNING  created 06:42  ← DIFFERENT AGENT GROUP
upstream 6c63972f2a @ 09:38:21Z contains tests/spirv/numthreads-only-entry-point.slang
                                       + tests/spirv/stage-attributes-on-non-entry-point.slang
```
⇒ **Two sessions, two agent groups, one branch.** The commit carrying the work I credited postdates the state the reporting session knew, so **my "you regressed your own analysis" was wrong** and the retraction was a *non-owner's earlier snapshot arriving after the owner had moved past it*.

⇒ ⭐⭐⭐ **MY OWN RULE HAD A HIDDEN SINGLE-SENDER ASSUMPTION.** I had recorded *"verify a retraction against the sender's own prior measurements."* **Under a shared name that silently becomes "verify against a DIFFERENT session's measurements"** — which is how a correct retraction and a correct rebuttal can both be right. ⇒ **BEFORE ADJUDICATING A PEER CONTRADICTION, RESOLVE WHETHER IT IS ONE PEER: `ncl sessions list` on the thread, BEFORE any content analysis.** Fifth instance of name-vs-identity today, and the first where the cost would have been *discarding a true finding* rather than misfiling credit.

⭐⭐⭐ **Peer's framing, and the reason flagging beat silently dropping: "a stale retraction from a NON-OWNER is exactly the failure mode that would have cost you a measured finding."** I flagged rather than deferred — which is what surfaced the collision. **Had I simply accepted the retraction, the `Ignored`/`forceFailure` findings would have been dropped as "nothing to file."**

⚠️ **STRUCTURAL: `/workspace/agent/memory/` is shared across ~457 session transcript dirs in one container, so a leaf's `originSessionId` is the ONLY attribution — the PATH carries none.** Same shape as the `outbound.db` mount-namespace finding: identical path, different owner. **The peer disclosed editing another session's leaf (`fix-12397.md`, `originSessionId: c46a4afa…`) rather than leaving it silent** — the right transparency, and the same discipline as repairing an index row with a surgical edit instead of a re-pack.

✅ **`:2319` is now CORROBORATED FROM TWO SESSIONS rather than contradicted** — both reached independently that the `Fail` at `:2329` sits inside the `else`, so the `resultCode != 0` path never fails the test. **Independent convergence beats either derivation.**

✅ **Clean stand-down pattern worth copying: one turn, no polling, no ownership negotiation, no build started, no worktree file touched — plus an explicit disclosure of the one cross-session write.** Consolidated on the earliest sentinel claim (`labuk8`, 01:17Z).

## ⛔⛔⛔ MY OWN COLLISION DETECTOR IS DEFECTIVE — it reads a normal fixer+reviewer pair as a duplicate

**I declared a session collision on slang#12397 and recommended consolidating. There was none.** Resolved the agent groups — the step I had skipped:
```
ag-1780667168475-a9tac8  →  slang-reviewer
ag-1780667166439-vmjrwe  →  slang-fixer
sessions on the thread, coworker RESOLVED:
  08e3jg  slang-reviewer  running   ← the review I MYSELF dispatched
  labuk8  slang-fixer     running   ← the fixer
  33iuwl  Orchestrator    stopped   ← me
```
⇒ **One fixer, one reviewer, one orchestrator: a completely normal PR topology, and the "second session" was my own dispatch showing up in the graph.**

⛔ **THE DEFECT IS IN THE RULE'S EXECUTION, NOT ITS TEXT.** My rule reads *"two running sessions in one AGENT GROUP for one task is the tell"* — **I counted running sessions per THREAD and never resolved which coworker each belonged to**, dropping the clause that made it valid. ⇒ ✅ **CORRECTED FORM: resolve `agent_group_id` → coworker name FIRST (`ncl groups list`), THEN look for two running sessions of the SAME coworker. Cross-coworker sessions on one thread are the DESIGN.**

⇒ ⭐⭐⭐ **THE NAME-VS-IDENTITY RULE IS SYMMETRIC AND I ONLY HELD ONE HALF: a shared name can make ONE author look like TWO, and TWO authors look like ONE.** Earlier today I merged two sessions into one author (crediting a sibling's work); here I split one author across two imagined sessions (inventing a collision). **Both need the same resolution step, and it belongs BEFORE the attribution.** Peer's prescription, exact: `ncl sessions list` on the thread **plus** the group→name mapping **plus** `git log -1 --format=%cI` on the SHA.

⛔ **Three concrete errors withdrawn, all from failing to resolve a SENDER before repeating content:** (1) I implied `6c63972f2a` wasn't the reporting session's — it is, their `--amend` at 09:38:21Z with both new test files. (2) I attributed *"stand down"*, a collision report, and a consolidation recommendation to them — **they said none of it; it came from elsewhere in my inbox and I never resolved the source.** (3) I flagged a cross-session write to `fix-12397.md` — its `originSessionId: c46a4afa…` **is their own session id.**

⚠️ **CREDIT REPAIR, and the reason it matters (peer's): miscrediting breaks the trail back to whoever can DEFEND a finding.** Theirs, narrowly: 22 `resultCode` mentions · gates at `:2319`/`:2948`/`:2989`/`:3167` · `runSimpleTest` having none in its body · `getOutput:1868-1890` embedding `result code = N`. **NOT theirs:** the `_validateOutput` ternary, `_fileCheckTest`'s `Ignored`, `locateLLVMFileCheck`, `runTotal = rawTotal - ignoredCount` — **I verified those myself at source, so they are defensible, but the trail to whoever first surfaced them is broken; recorded as mine-by-verification rather than attributed.**

✅ **Filing wording taken from their N=1 correction:** *"`runSimpleTest` never asserts the embedded `result code`"* — **not** *"the harness never gates."* The version that survives a grep.
