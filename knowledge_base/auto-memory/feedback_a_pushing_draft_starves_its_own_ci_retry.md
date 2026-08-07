---
name: feedback_a_pushing_draft_starves_its_own_ci_retry
description: "TWO self-corrections in one claim-space. (1) I blamed has_newer_run_for_branch for a draft PR's CI blackout — that branch never executed (0 of 100 retry fires); the constraint is any_active_ci. (2) I then published 'the ready-flip is the ONLY path' from ONE positive cell — a universal negative from a single arm. #12382 already had 4 dispatch runs. Read a tool's DECISION, not its source; count your arms before quantifying."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f17c5aef-b8a2-4844-b2d1-4d8df2e3a2bd
---

Measured 2026-08-06 on shader-slang/slang#12382 (draft, `fix/issue-12371`), while checking
`slang-reviewer`'s reported blocker *"zero CI build/test signal at both heads."*

## What is true (unchanged, verified)

⛔ **Read item 1 with its limit attached: "no `pull_request` CI" is NOT "no CI."** #12382 had **four**
`workflow_dispatch` runs while a draft. Stopping here yields the exact wrong inference — the one I
published twice. The correction is the second `⛔` section below; **do not act on this section alone.**

1. **A draft PR has no `pull_request` CI at all, by design.** `.github/workflows/ci.yml:15` —
   `filter` is `if: github.event_name != 'pull_request' || github.event.pull_request.draft != true`,
   and every build/test job requires it. All 5 `pull_request` runs on this branch are
   `completed/skipped`. **The skips are expected, not evidence.**
2. **So the bot dispatches CI manually, and only those runs can yield.** `ci.yml:99` —
   `IS_THROTTLED_BOT` is `event_name == 'workflow_dispatch' && triggering_actor ==
   'nv-slang-bot[bot]'`; anything else prints *"Not a throttled bot run; proceeding without
   yielding"* and never calls the gate script. So the yield applies to bot dispatches **only** —
   ⛔ note **both** conjuncts: event type **and** bot identity. Never restate this as a property of
   draft-ness (I did; see below).
3. **`ci-retry-yielded-bot` is meant to requeue them** — hourly at `:17`, plus on every CI
   `workflow_run` completion.

Census at `b52dba91` (paged explicitly, 82 rows): 2 failure, 5 success, 74 skipped, 1 in_progress.
The 5 successes are `board-sync`, `filter`, `reuse-compliance-check` — **zero build, zero test.**

## ⛔ What I got wrong, and how wrong

I published this as the cause: `retry-yielded-bot-ci.py:105-118`, `has_newer_run_for_branch` skips
any candidate with a higher `run_number` on the same branch ⇒ *"every push permanently disqualifies
the prior yielded run; responding to review resets the retry clock."*

**Every clause about the code is true. The causal claim is false**, and one query kills it: the
check compares candidates *within a branch*, so a branch's **newest** dispatch always survives it.
Enumerated over all 27 branches with yielded dispatches in the window — including 7-dispatch
branches — **every one retains exactly one survivor.** The function eliminates stale runs; it cannot
produce zero. On `fix/issue-12371` the survivor is `29917` at `f93eb4f7`, and it was eligible the
whole time.

**The actual binding constraint is one function earlier.** `main()` calls
`any_active_ci(fetch_active_runs(...))` and returns before candidate selection ever runs. Measured
over **100 consecutive retry fires** (2026-08-05T15:23Z → 08-06T07:14Z):

| outcome | fires |
|---|---|
| `CI is still active (N run(s)); not rerunning bot CI.` | **98** |
| `Rerunning yielded bot CI run #…` | 2 |
| `No yielded bot CI runs are eligible` (the check I blamed) | **0** |

⇒ **The branch I accused was never reached in 100 fires.** And `ACTIVE_STATUSES` includes
`waiting`, so 20 consecutive fires (05:08Z→07:14Z) were blocked by **one** run — `#29902`,
`falcor-vet-approve-gate`, parked **2.45 h** in `waiting` on a manual `falcor-ci` environment
approval held by the `ci-approvers` team. A run awaiting a human click counts as "CI is active" and
suppresses every bot retry repo-wide.

⭐⭐⭐ **A mechanism that is real, file:line-verified, and consistent with the symptom can still not
be the cause.** I read the code correctly, quoted it correctly, and never asked *does this branch
execute?* The discriminator was free — the retry job prints its own verdict — and I reached for
source instead of the log the tool had already written. ⇒ **When a script exists to make a decision,
read its DECISION, not its source. Source tells you what could happen; the log tells you what did.**

⛔ **Blast radius: 3 peers adopted it inside 9 minutes** — reviewer added it as "Addendum 2" to a
56 KB artifact plus a shared learning, triager re-verified my file:line and relayed it, fixer wrote
*"responding promptly to review was starving the CI I kept asking for"* into a public GitHub PR body
and **changed its behavior** (went quiet on the branch). A mechanism from the orchestrator arrives
with authority; peers verified my *citations*, which were accurate, and could not have caught the
unexecuted-branch error by that route. ⇒ **The check a peer cannot run for you is the one you owe
them.** See [[feedback_deference_drifts_to_whoever_corrected_you_last]] for the mirror image.

⛔ Also self-corrected: I wrote **"4 dispatches"** then adopted the triager's **"5 heads, so 5"**.
Both wrong as stated — 5 heads, **4 dispatches**: `3359a638` got a `pull_request` run only, never a
`workflow_dispatch`. So its "retry window reset by the byte-identical amend" never existed. **A
count of X does not license a count of Y just because the objects pair up most of the time.**

## ⛔ SECOND ERROR IN THE SAME CLAIM-SPACE — a universal negative from one positive cell

Hours after the retraction above I published, twice, that *"the ready-flip is the **only** path — no
amount of waiting produces CI while #12382 stays draft."* **Also false**, and the tell was available
before any measurement.

The evidence was **one cell**: a ready bot PR (#12379, run #29896) that *did* get 36 non-skipped jobs.
That establishes **ready ⇒ CI**. The published claim was **draft ⇒ no CI** — the *other* arm, never
measured. ⭐⭐⭐ **A single-arm A/B licenses only the claim in the direction you measured.** The two read
as one finding because they are the same sentence contraposed.

⇒ **The must-fail arm, when the triager ran it, failed:** #12382 **already has four CI runs** —
`workflow_dispatch` #29909/#29911/#29913/#29917. Draft-ness routes you to the dispatch path (`ci.yml:15`
guards `filter` for `pull_request`; `:53-60` documents the bot's manual draft-testing path in as many
words); **it does not deny you CI.** All four resolve identically: `filter: success`,
`wait-for-human-priority: failure`, `check-ci: failure`, 0 build/test.

⛔ **And my mechanism statement was wrong on both exclusions.** `IS_THROTTLED_BOT` (`ci.yml:97-99`) is
`event_name == 'workflow_dispatch' && triggering_actor == 'nv-slang-bot[bot]'` — **bot identity is
literally a conjunct**, and what the gate then evaluates is **queue load**. So the yield is a property
of *event type ∧ bot identity ∧ queue load*; draft-ness only selects the event type. I had said it was
"a property of draft-ness, not of bot identity or queue load" — three claims, three wrong.

✅ **The gate names its own blockers, and I only had to read the log** (job 92543832118, verified on my
edge):
```
Yielding to human/merge CI #29914 (pull_request, in_progress, by jkwak-work)
Yielding to human/merge CI #29902 (pull_request, waiting,     by jkiviluoto-nv)
Yielding behind earlier bot CI #29903 (pull_request, in_progress, by nv-slang-bot[bot])
```
⇒ **#29902 is causally load-bearing, not a cheaper substitute** — it is a *named yield target* as well
as suppressing the retry (`waiting ∈ ACTIVE_STATUSES`). My "the two asks are independent" inversion was
itself wrong.

⛔ **RETRACTED 2026-08-06 — THIRD error in this claim-space. See
[[feedback_a_rerun_changes_triggering_actor_so_the_gate_is_skipped]].** The struck paragraph is FALSE
as a behavioural claim; do not act on it. The escalation branch is unreachable on **both** arms:
attempt 1 evaluates age ~0.2–0.4 min after `created_at` (the gate is the first job; 6/6 measured),
and a rerun flips `github.triggering_actor` to `github-actions[bot]` ⇒ `IS_THROTTLED_BOT=false` ⇒
`wait-for-priority.py` is **never called** (5 of 5 bot dispatch reruns, complete population).
#29909 never aged out — it is `completed/failure`, and a completed run re-evaluates nothing. Reruns
do get full CI, by **bypassing** the gate rather than by aging. Bot starvation is bounded only by
`any_active_ci` going quiet.

~~⇒ **Waiting does produce CI, and it is bounded.** `wait-for-priority.py --max-yield-hours 12`, measured
from `created_at` (fixed across reruns, so age accumulates), stops yielding past the ceiling. Oldest
dispatch #29909 created 05:58:41Z ⇒ **ages out ~17:58Z the same day with zero intervention.**~~

⭐⭐ **The pre-measurement tell: my conclusion contained "no amount of."** A universal negative can never
come out of a single positive cell. **Grep your own conclusion for universal quantifiers and count the
arms you measured** — that check costs nothing and would have caught all three revisions.

## The two exits, corrected

- **Wait for CI to go quiet.** Not "stop pushing" — pushing was never the blocker. What must clear
  is `any_active_ci`, which needs the parked `waiting` run resolved (a human clicking approve on the
  `falcor-ci` environment) plus no queued/in-progress run. ⛔ **This is the ONLY floor** — the
  `--max-yield-hours 12` escalation never fires (retraction above), so there is no 12 h backstop
  under it.
- **Flip draft→ready — the FAST path, not the only one.** A bot ready-for-review PR arrives as
  `pull_request`, so `IS_THROTTLED_BOT` is false and its gate never yields: run `#29896` has
  `wait-for-human-priority: success` and **36 non-skipped jobs** incl. Windows/macOS/aarch64/sanitizer.
  Operator-gated ([[feedback_github_writes_operator_authorized]]). **Sufficient; and with the age-out
  retracted, the only bounded path a coworker can trigger** — the alternative is waiting on a human
  environment approval.

## How to apply

When a coworker reports "no CI signal" on a draft: (1) is it a draft ⇒ `pull_request` skips are
expected; (2) are the only non-skipped failures `wait-for-human-priority` + `check-ci` ⇒ benign
priority-yield; (3) **read `ci-retry-yielded-bot`'s own log** and count outcomes — it names its
blocker by run number; (4) check whether a blocker is parked in `waiting` on a human approval, which
looks like load but is not. Do **not** hand the fixer an action item until step 3 says the retry even
reached candidate selection.

⚠️ Corollary to [[feedback_the_event_you_report_can_invalidate_your_own_ci_measurement]]: a push
invalidates a CI read as surely as a draft→ready flip. The reviewer's read was two heads stale
within 11 minutes. Stamp the head, not just the time.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[feedback_mechanism_must_predict_observed_coordinates]] ·
[[feedback_zero_test_jobs_is_not_zero_failures]] ·
[[feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not]]
