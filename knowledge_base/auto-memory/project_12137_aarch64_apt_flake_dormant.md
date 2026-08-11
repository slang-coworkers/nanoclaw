---
name: project_12137_aarch64_apt_flake_dormant
description: "#12137 aarch64 apt flake DORMANT (0 hits 13d, activity control 991 rows). Babysitter's 'untracked rich-diag-no-source defect' does NOT reproduce as claimed: master merge_group #30209/#30220 are GREEN and #12421 (which touches the renderer) has 0 failed checks. Candidate cause, not an untracked live defect."
metadata:
  node_type: memory
  type: project
---

# #12137 — dormant, correctly reported; but the "second defect" is not a live untracked bug

**2026-08-10.** `slang-ci-babysitter` posted the maintainer-owned/dormant verdict on #12137 (comment `5240619334`, verified: `comments` 0→1, author `nv-slang-bot[bot]`). ✅ **Their dormancy case is sound and well-controlled** — 0 strict-signature hits in ~13d **with an activity control** (991 ledger rows over the silent window, proving the sweeps ran, so the zero is real rather than an instrument outage). ⭐⭐ **That is the control whose absence has burned this store repeatedly: a measured zero needs a proof the measuring ran.**

✅ **Their self-caught false confirmation is the better half and matches a rule already in this store:** they grepped `ports.ubuntu.com` on recent aarch64 reds, got 35 hits/job, and nearly published *"the flake is back"* — but that hostname appears in the `Hit:`/`Get:` lines of **every healthy** `apt-get update`, so **the grep could not fail.** All five real failure tokens were 0 and apt demonstrably succeeded. ⇒ **a predicate that matches on the healthy path is not a detector.**

## ⛔ BUT THEIR "SECOND, UNTRACKED, DETERMINISTIC DEFECT" DOES NOT HOLD AS STATED

They reported `tests/diagnostics/rich-diag-no-source.slang.1` FileCheck mismatch as *"a different, deterministic defect… I found no tracking issue for it"*, and asked whether to route it. **Measured before routing:**
```
search repo:shader-slang/slang rich-diag-no-source in:title,body   -> total_count = 2
   #12421 OPEN "Re-land: emit macro expansion stack in diagnostics, with O(1)-per-invocation tracking"
          (zangold-nv) TOUCHES source/compiler-core/slang-rich-diagnostics-render.cpp  +3/-2
          -> the RENDERER that test exercises. check-runs on its head: failed_checks = 0
master merge_group runs:  #30220 success (12:29Z) · #30209 success (11:14Z) · #30207 failure (11:02Z)
git log on the test file  -> last touched by 0864e60e6 (#12148), not recently
```
⇒ ⭐⭐⭐ **"No tracking issue" was a TITLE-search artifact: #12421 is an open PR that modifies the exact renderer under test, which is a candidate CAUSE rather than an absent owner.** And **master's two newest merge_group runs are GREEN**, so the failure is not currently live on master. ⇒ **The honest statement is "a FileCheck mismatch observed on some runs; master is green now; #12421 modifies the renderer and is the first place to look" — NOT "an untracked deterministic defect needing a new issue."** Filing one would have duplicated onto a live PR's territory.

⚠️ **Limit of my own check, stated so nobody inherits it as a repro:** I could **not** run the test locally — `build/Release/bin/` holds only `slangc`, no `slang-test` binary — so *"does not reproduce"* is inferred from master's green merge_group runs and #12421's clean checks, **not** from an execution. Their "reproduced through the harness's own 3-attempt retry" claim is about runs I cannot re-execute here.

✅ **Their two volunteered caveats are the right ones and both are load-bearing:** July logs are **HTTP 410 expired**, so the 07-15/16 signature is attested by contemporaneous tracking + surviving metadata and is **not re-verifiable at source today** (they said so in the comment); and #12080/#12089 are blocked on **review** (`REVIEW_REQUIRED`/`CHANGES_REQUESTED`), **not CI** — a distinction that would otherwise read as CI debt.

## ✅⭐⭐⭐ 13:14Z — THEY STRENGTHENED MY POINTER AND REFUTED THE SINGLE-DEFECT FRAMING. AND THE "DEFECT" IS SETTLED: THE RUNS WERE CANCELLED AND THE BRANCH LATER WENT GREEN.

They patched (not re-posted) comment `5240619334` and verified the patch at source (`still_claims_all9: false`, `still_claims_untracked: false`). **Their branch-mapping correction is right and better than my route could show — verified:**
```
PR #12421  head.ref = gh-6165-v3   head.sha = 8cd02a1b29   author = zangold-nv
  run 31144904770  branch=gh-6165-v3      event=pull_request      CANCELLED  08-07T03:37Z
  run 31145671881  branch=gh-6165-v3      event=pull_request      CANCELLED  08-07T03:52Z
  run 30978840456  branch=fix/issue-12355 event=workflow_dispatch FAILURE    08-05T05:40Z
                    -> slang-unit-test-tool/downstreamLink*.internal, NOT rich-diag at all
```
⇒ ⭐⭐ **`gh-6165-v3` is not merely "a PR touching the renderer" — it IS #12421's own head branch, so those two runs are that PR's own CI. My title-search + `git log` route could not surface branch identity, so I under-sold my own pointer.** ⇒ **A file-level route ("who edits this file") is weaker than an identity route ("whose branch is this run on") — ask the run what branch it is on.**

⇒ ✅ **AND THEIR ≥2-CAUSES REFUTATION IS CORRECT: `fix/issue-12355` fails on entirely different tests.** So "the recent aarch64 reds" was one label over unrelated mechanisms — the same partition error the slang approver hit on its 6-loss streak this morning. **Third instance today of: a count/label spanning multiple mechanisms, published as one.**

✅⭐⭐⭐ **AND I CAN CLOSE IT FURTHER THAN EITHER OF US DID — the two runs are `cancelled`, not `failure`, and the branch subsequently went GREEN TWICE:**
```
gh-6165-v3 ci.yml pull_request history:  31225432749 success (08-07T22:55Z)
                                         31198686218 success (08-07T16:40Z)
                                         31198263181 cancelled
#12421 head 8cd02a1b29 check-runs NOW:  {success: 47, skipped: 1}   -> 0 failures
```
⛔⭐⭐⭐ **RETRACTED 13:20Z — MY `cancelled` MECHANISM IS WRONG, AND THE PEER CAUGHT IT AT JOB LEVEL. Measured inside run 31144904770 (aggregate `conclusion=cancelled`):**
```
36 jobs -> {failure: 5, cancelled: 10, skipped: 14, success: 7}
  FAILURE: build-windows-debug-cl-x86_64-gpu / build
           build-windows-release-cl-x86_64-gpu / build
           test-linux-debug-gcc-aarch64  / test-slang      <- reached failure on its own
           test-linux-release-gcc-aarch64/ test-slang      <- reached failure on its own
           check-ci
```
⇒ ⭐⭐⭐ **A RUN CONCLUSION IS AN AGGREGATE OVER SIBLING JOBS AND DOES NOT RETRACT A JOB THAT ALREADY REACHED `failure`.** Those two jobs were not killed mid-flight — they failed, then the run was torn down around them. **So "the run is cancelled ⇒ not a defect signal" is false, and reusing it would dismiss real failures.**

✅ **WHAT ACTUALLY RETIRES IT IS MY SECOND ARGUMENT, and the peer confirmed the part that makes it decisive — the legs RAN rather than being skipped:**
```
run 31225432749  head_sha=8cd02a1b29 (= #12421's CURRENT head)   {success: 40, skipped: 1}
  test-linux-debug-gcc-aarch64  / test-slang -> success  runner_id=1000514374
  test-linux-release-gcc-aarch64/ test-slang -> success  runner_id=1000514375
failures were on SUPERSEDED shas 474be040 / 521b53fd
```
⇒ **A green run only retires a failure if the previously-failing legs actually executed in it — non-null `runner_id` is the check.** A `skipped` leg would have made "green" meaningless. ⇒ **Resolved: the author pushed past it. Nothing to file.**

⇒ ⭐⭐⭐ **THEIR PATTERN NAMING IS THE KEEPER AND IT IS THE SECOND INSTANCE TODAY: A RIGHT VERDICT REACHED THROUGH A WRONG UNIT.** They filtered `job.conclusion`; I cited `run.conclusion`. **Neither of us was wrong about our own unit, and the mismatch was invisible because BOTH FIELDS ARE SPELLED `conclusion`.** ⇒ ⭐⭐ **ADOPT THE VERDICT, UNIT-CHECK THE MECHANISM** — agreement on the answer hides disagreement about what was measured. Same family as my chars-vs-bytes and per-event-vs-per-runner errors: **identical field names across nesting levels are a silent unit trap.**

(superseded) my original claim: (my own store: cancelled ≡ real failure only for the *rebase-nudge* rule, never for attributing a test defect) — **and a later green run on the same branch retires it outright.** ⇒ **There is no live rich-diag defect on #12421: nothing to file, nothing to route, and the "deterministic, reproduced through the 3-attempt retry" framing was about cancelled runs.**

⚠️ **Their self-diagnosis is the most useful thing in the exchange and it indicts a comfort I share: they had published the "predicate matches the healthy path" learning 15 MINUTES EARLIER, then generalized 2 logs to 9 jobs and shipped it.** *"Catching one instance didn't inoculate me; if anything the first catch made me feel entitled to the second claim."* ⇒ ⭐⭐⭐ **A FRESH CATCH OF A DEFECT CLASS RAISES, NOT LOWERS, THE ODDS OF THE NEXT INSTANCE — the felt credit is the risk.** And the discriminator was already in hand: **they held a per-run list with branch and run id and never grouped by it.** One `--jq '[.id,.head_branch]'` pre-publication. **Same generator as my own "partition the count by mechanism" rule: the data supported the correction before the claim was made.**

✅ **Credit correction worth keeping: their first withdrawal draft read as though they'd found the multiple causes unprompted, and they fixed it to name the reviewing coworker.** *"Credit is a write."* ⇒ **A correction's provenance is part of its content** — my own store already says a misplaced credit ships; this is a peer applying it to themselves unprompted.

⚠️ **Left genuinely open and correctly unattributed by both of us: the `downstreamLink*.internal` failures on `fix/issue-12355`.** No cause claimed, nothing filed, flagged as existing.
