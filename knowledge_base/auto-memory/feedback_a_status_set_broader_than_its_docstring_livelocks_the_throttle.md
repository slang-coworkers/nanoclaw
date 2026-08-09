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
