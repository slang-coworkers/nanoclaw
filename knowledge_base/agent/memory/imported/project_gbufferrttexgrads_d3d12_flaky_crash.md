---
name: gbufferrttexgrads-d3d12-flaky-crash
description: "test_GBufferRTTexGrads_d3d12 crashes 0xC0000005 (109 PASSED/1 FAILED) intermittently across shader-slang/slang PRs — ESTABLISHED flaky by a SAME-SHA pass/fail pair on 98083f9d5e. Never attribute it to a diff; do not spend a re-run."
type: project
---
**Repo-wide flaky GPU image test in shader-slang/slang. Three independent occurrences, one signature.**

```
renderpasses/test_GBufferRTTexGrads_d3d12 : FAILED (~6.7-7.0 s)
Mogwai.exe exited with return code 3221225477   == 0xC0000005 (Windows access violation)
Image tests FAILED   —   109 PASSED / 1 FAILED   (a CRASH, not a golden-image mismatch)
```

| PR | head | runner | date |
|---|---|---|---|
| #12353 | `2c9cf98fb0` | SLANGWIN4 | 2026-08-05 |
| #12127 | `51df4602` | SLANGWIN5 | 2026-08-05 |
| #12309 | `98083f9d5e` | — | 2026-08-06 |

⭐⭐⭐ **THE DECISIVE CONTROL (`slang-fixer`'s, Main-verified): THE SAME SHA PASSED AND FAILED.** Head `98083f9d5e` — check-suite `83197820592` `conclusion=success` (2026-08-01T01:09:55Z) vs suite `84258146520` `conclusion=failure` (2026-08-06T01:39:04Z). **Identical code, two outcomes, five days apart.** ⇒ **No property of any diff is implicated, and this closes the ANCESTRY objection that a cross-branch reproduction cannot** — see [[feedback_a_valid_control_compatible_with_both_hypotheses_settles_nothing]], where I had to write *"not introduced by this PR; pre-existing not established"* because a different-branch failure says nothing about ancestry. A same-SHA pair says it directly. **"Known flake" is ESTABLISHED, not merely supported.**

**Corroborating only — do NOT lead with these:** two different runners (kills single-box explanations); crash profile is a host access violation, not a diff-detected regression (Falcor reports mismatches distinctly); 1-of-110 isolation; and on #12309 a comment-only diff (4 `///` lines + regenerated markdown). ⚠️ **The comment-only leg argues from what a diff *plausibly* can't reach and a regenerated artifact can still change a build ⇒ corroborating.** **Stacking a weak leg beside a decisive one invites a reviewer to attack the weak one.**

⛔ **DO NOT SPEND A RE-RUN.** A green re-run adds one more pass to a code path already proven to pass; a red one adds nothing either. **The evidence on disk beats the experiment**, and a re-run on a maintainer's APPROVED non-draft PR is also a write we are not authorized to make. Declined on #12353 and on #12309 for these reasons.

⛔ **`BEHIND` on an APPROVED head is the maintainer's to resolve** — the approval attaches to the SHA, so no update-branch, rebase, or force-push. Applies to #12309 (`98083f9d5e`) exactly as to #12353 (`2c9cf98fb0`). See [[feedback_drafts_only_guardrail]].

⭐⭐ **Method note worth copying: the fixer went after the objection nobody raised.** `test_GBufferRTTexGrads` touches texture *gradients*, and its own merged #12248 re-pointed capability atoms — so it verified #12353's head **contains** `be27d078` (#12248) and that head's Falcor passed, clearing the atom re-point. **That is "what would I go find if I wanted to be WRONG?" executed unprompted** — the question three agents failed to ask on #12353. It also explicitly refused the easy dismissal: it checked whether Falcor was ambiently red (it was not — #12353's Falcor is `success`), so "everything is broken" was *unavailable* as an excuse.

**NEXT:** a filable flaky-test report would stop the next chain re-deriving this (three occurrences + a same-SHA proof). **Maintainer-facing write ⇒ needs operator authorization; offered, not done.**

## ⛔ THE `runs/<id>/jobs` ENDPOINT HIDES FAILED ATTEMPTS — and it caused a peer to OVER-RETRACT a true report

**A peer swept `runs/31047790392/jobs`, saw `test-falcor / Test (Falcor) = success`, and retracted its own (correct) report that Falcor had failed on `2c9cf98fb0`.** Measured both jobs:
```
id=92467419265  SUCCESS  runner=SLANGWIN4  run_attempt=2  started 23:03:41Z   ← what /jobs returns
id=92454170957  FAILURE  runner=SLANGWIN4  run_attempt=1  started 21:53:39Z   ← the log I actually read
```
**Same run, same job name, same runner, different `run_attempt`. `runs/<id>/jobs` returns ONLY THE LATEST ATTEMPT**, so a first-attempt failure later re-run green is invisible to it. ⇒ **Use `?attempt_number=N` or `runs/<id>/attempts/<n>/jobs`; the tell that a re-run happened is `run_attempt > 1` on the returned job.**

⭐⭐⭐ **A RETRACTION NEEDS ITS OWN INSTRUMENT CHECK, EXACTLY LIKE THE CLAIM IT RETRACTS.** The peer did the right thing — sought disconfirmation of its own report — but the probe **could not represent the state it was looking for**, so the negative result was structurally guaranteed regardless of truth. ⇒ **An over-retraction costs as much as an over-claim and is harder to catch, because retracting READS AS RIGOUR and nobody argues you into keeping a claim.** (Companion to the self-blame rule in [[feedback_verified_fragments_do_not_verify_the_conclusion]]: the directions nobody contests are the ones that skip verification.)

✅ **SECOND SAME-SHA PASS/FAIL PAIR — JOINTLY derived, claimed by NEITHER party alone.** Head `2c9cf98fb0` **failed attempt 1, passed attempt 2**. ⚠️ **Provenance, precisely: attempt-1 FAILURE is mine (I fetched job `92454170957`'s log); attempt-2 SUCCESS came from the PEER'S sweep.** Neither of us held both halves, and neither assembled the pair — ⭐⭐⭐ **it existed only because our two partial measurements CONFLICTED and resolving the disagreement forced both onto the table. The disagreement was the instrument.** ⇒ **When a peer's measurement contradicts yours, the reconciliation may contain evidence neither measurement contained — do not stop at "who was right".** (Peer then credited the pair to me; declined, per the same audit-credit-as-rigorously-as-blame rule that caught the earlier misattributions.) Independent of the `98083f9d5e` pair (suite `83197820592` success / `84258146520` failure). ⇒ **Two heads now give the categorical "code constant, outcome changed" proof.** ⛔ **I recorded attempt 1's failure and never asked whether a later attempt passed** — the pair was inside my own measurement.

⚠️ **ATTRIBUTION: the `98083f9d5e` pair is session `92665dc6`'s, NOT the reporting peer's** — established by transcript discriminator (peer had 4 hits, all inbound-or-checking; a control term unambiguously theirs scored 29 in their session and 0 elsewhere; `92665dc6` had 16). **Third time I bound authorship to the edge a report arrived on.** ⇒ **Do not write "your X" about anything you did not watch a session produce; write "the measurement in message N".**

## ⛔⛔ WITHDRAWN: "our same-SHA pair is the one thing #12145 doesn't have" — IT HAS FOUR (2026-08-06 07:0xZ)

**I quoted #12145's "8 occurrences across 8 PRs" and its lack of a same-SHA pair. Both came from the issue BODY (filed 07-17). The THREAD had moved three weeks past it.** Verified myself — 5 comments:
```
07-23T20:10Z  nv-slang-bot   → count updated to 44 attributed occurrences across 16 PRs
08-06T00:58Z  jkwak-work     → ASSIGNED to @jkiviluoto-nv: "add a retry logic just for this specific test"
08-06T01:25Z  nv-slang-bot   → 7.7 KB, per-attempt Falcor outcomes for FOUR runs (every row a re-run)
08-06T01:32Z / 01:37Z        → further per-attempt analysis + proposed ci-falcor-test.yml retry gate
```
⇒ **"8 across 8" was three weeks stale, and the thread already contained four same-SHA pass/fail pairs — one of them `51df4602`, i.e. #12127, one of "our three occurrences."** Our table overlapped the thread, not just the body.

⭐⭐⭐ **THE NEXT QUESTION AFTER "DOES THIS ISSUE EXIST?" IS "DOES THIS THREAD ALREADY CONTAIN WHAT I AM ABOUT TO ADD?"** I asked the first and stopped. **An issue's BODY is a filing-day snapshot; the THREAD is its state** — the same body-vs-thread error as `git log -1` vs a range, and as reading a memo's summary row instead of its status line. My withdrawal of the *filing* offer was right and did not go far enough: the *comment* offer dies too.

⭐⭐⭐ **AND THE DEEPER ERROR: A SAME-SHA PASS/FAIL PAIR IS SIMPLY WHAT `run_attempt > 1` IS.** We treated it as categorical and rare; it is the **ordinary artifact of any re-run**, and this issue had four before we started. ⇒ **Claimed NOVELTY deserves the same audit as claimed evidence — ask "what routine operation would already have produced this?"** Posting it would have re-committed the duplicate-work error the withdrawal was correcting, one level down.

⛔ **AND MY CITED PAIR DECAYED WHILE WE DISCUSSED IT.** I recorded suite `84258146520` as `conclusion=FAILURE`; re-measured it now: **`conclusion=success`, updated 04:29:42Z** — someone re-ran it (att 2, PASS). **The attempt-1 failure still exists under `attempts/1`, but the top-level conclusion shows only the latest attempt** — the exact trap that caused the peer's bad retraction, now biting the citation I built on it. ⇒ **A CITED CI CONCLUSION IS A STATE CLAIM AND EXPIRES. Cite `run/suite + attempt_number`, never a bare top-level conclusion.**

✅ **LIVE STATE, and it changes the ask entirely: #12145 is assigned (@jkiviluoto-nv), has a maintainer decision (add per-test retry), and has a ready `ci-falcor-test.yml` diff from a peer session pending a human with `workflows` permission.** ⇒ **NOTHING is owed on #12145 from us; no comment, no authorization request.** Our contribution would be a fifth posting of evidence already posted four times.
