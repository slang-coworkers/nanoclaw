---
name: feedback_a_status_set_broader_than_its_docstring_livelocks_the_throttle
type: feedback
title: "A status set broader than its docstring livelocks the throttle"
description: "A throttle/yield mechanism held work behind an 'active' run: ACTIVE_STATUSES included 'waiting', but a run waiting on a HUMAN approval gate consumes ZERO runners — so one un-approved run livelocked every later bot dispatch for 27h. Check whether the status set matches what the mechanism claims to measure."
source: "migrated native-memory; origin session 3a9c1658-b084-4fd9-badf-659d94e701b9; 2026-08-08/09 shader-slang/slang"
---

## The mechanism

The Slang CI throttle yields a bot run behind any run whose status is in a set:

```
extras/ci/ci_priority_common.py:29
  # Run statuses that mean a run still holds, or is waiting for, runner capacity.
  ACTIVE_STATUSES = {"queued", "in_progress", "waiting", "requested", "pending"}
```

`waiting` is overloaded: it means both "queued for capacity" and "gated on a person, holding nothing." Only the first justifies a yield. A run in `waiting` on a HUMAN approval gate consumes zero runners — but the throttle counts it as active, so every later bot dispatch yields behind it.

## The transferable check

Does the status set match what the mechanism claims to measure? The tell is **a set broader than its own documentation** — here the comment says "still holds, or is waiting for, runner capacity," and neither clause covers "blocked on a human, holding nothing." When the artifact is the evidence, quote the artifact, not a peer's summary of it (a peer's docstring paraphrase differed from the in-source comment).

The direct fix, measured on #30154 attempt 3 (`attempts/3/jobs -> {"completed": 38, "waiting": 1}`, `in_progress_or_queued = 0`): **count jobs in `{queued, in_progress}`; zero ⇒ the run holds no runners, whatever the reason.** This matches `ci_priority_common.py:28` in both clauses — a `queued` job is waiting for capacity (counts), a job parked behind a human gate is not (does not). Neither `waiting`-at-run-level nor `pending_deployments` splits those clauses; job status does. Both one-liners also work: clear the run, or drop `"waiting"` from `ACTIVE_STATUSES`.

## Data point 1 — the 27h44m livelock (2026-08-08)

```
run 31179559787  status=waiting  event=workflow_dispatch  branch=fix/issue-12383
                 created 2026-08-07T12:45:43Z   age 27h44m
pending_deployments = 1: env=falcor-ci, wait_timer=0, reviewers=[Team ci-approvers]
                         current_user_can_approve = False        ← I cannot clear it
```

Blast radius across 12 `workflow_dispatch` runs: 10 failure / 1 success / 1 waiting, with the `waiting` run at the root; their live logs read `Yielding behind earlier bot CI #30098`. Repo-wide there was exactly ONE run in `status=waiting`, so a single approve-or-cancel unblocks everything.

**Bounded, not fatal — and the bound is measured, not assumed:** `--max-yield-hours 12` releases the yielders (#30105 ran 13h33m late and then succeeded), so bot CI is ~12h late, not dead. Distinguishing "livelocked" from "throttled with a long release timer" is what keeps this a bug report rather than an outage claim.

Second victim, same mechanism (#12434, `fix/issue-12386`): two `workflow_dispatch` runs, both `conclusion=failure`, 37 skipped, 0 real build/test jobs executed; the only two failures were `wait-for-human-priority` and `check-ci`, with the failing step literally named `Stop yielded bot CI`. **General diagnostic:** when a PR shows red with `skipped >> executed` and the only failures are gate jobs, read the failing STEP NAME before treating it as a code failure. Merging that into "one mechanism, two victims" raises the priority of a single approve-or-cancel (it unblocks other agents' PRs too) while lowering the open-issue count.

## Data point 2 — second episode, `waiting` provably the sole blocker (2026-08-09)

`slang-discord-support` claimed the "stop counting `waiting` as active" fix is now necessary AND sufficient, because the usual confound (ordinary overlapping CI holding the gate shut anyway) is absent. Their supporting figure was wrong — repo-wide the active statuses summed to 6 (`queued=2 in_progress=3 waiting=1`), not `waiting=1` with 0 elsewhere. But their conclusion survives because of the throttle's own scope: it filters to **`ci.yml` runs authored by bot logins**. Resolving each active run's `actor`:

```
zombie pages     pages build and deployment   github-pages[bot]         queued
zombie falcor    Falcor Tests                 jvepsalainen-nv           queued
schedule 1       ubuntu18-gcc11 Release       github-merge-queue[bot]   in_progress
schedule 2       Nightly Slang Sanitizer      jkwak-work                in_progress
schedule 3       Nightly Slang Coverage       jkwak-work                in_progress
THE waiting run  CI                           nv-slang-bot[bot]         waiting  ← only match
⇒ ci.yml runs that are ACTIVE *and* bot-authored = 1
```

Within the predicate the throttle actually evaluates, `waiting` is the ONLY active run — so for this episode the fix is necessary AND sufficient. A repo-wide count is the wrong denominator for a claim about a scoped predicate: the 6 and the 1 are both true, of different populations.

The livelock chain, verified end to end:

```
#30154 (31258367401) waiting on falcor-ci env gate, 38/39 jobs success, age 20h
   -> "waiting" is in ACTIVE_STATUSES  (ci_priority_common.py:29, verbatim)
   -> ci-retry-yielded-bot fires hourly at :17 and REFUSES:
        "CI is still active (1 run(s)); not rerunning bot CI."
        "  active #30154 (workflow_dispatch, waiting, by nv-slang-bot[bot])"
   -> #30170 is never re-run
```

Cancelling #30154 is both the unblock and the trigger: `ci-retry-yielded-bot.yml:3-6` is `workflow_run: workflows:["CI"] types:[completed]`, so cancelling a CI run fires the retry bot immediately. Cancelling beats approving here because approval still has to let the falcor job run, while 38/39 are already green (the honest cost: discards 38 green jobs on a draft PR's current head; they re-run on the next dispatch).

## The monitoring failure (the most reusable part)

53 consecutive `ci-retry-yielded-bot` fires since #30154 began waiting, conclusion histogram `{"success": 53}` — ZERO failures. Every one logged "CI is still active; not rerunning bot CI." **A watchdog that correctly declines to act reports `success`, so its conclusion field is blind to the condition it exists to clear.** A dashboard keyed on run conclusions sees 53/53 green through a 28-hour livelock. Green ≠ effective; a scheduled repair whose no-op path exits 0 is indistinguishable from one that worked.

The signal is in the LOG BODY, not the conclusion: **alert on N consecutive fires that decline, never on a red fire.** And alarm on the BLOCKER'S IDENTITY, never on streak length — the precise predicate: any blocker whose `status == waiting` and whose jobs hold zero runners ⇒ pathological, regardless of streak length or fire conclusion. Same family as "a spent one-shot stays pending forever": ask what a SUCCESSFUL run leaves on the field you monitor; if the answer is "the same thing a failure leaves," that field cannot drive the alert.

## Standing capability gap

`current_user_can_approve = False` recurred across three distinct chains blocked on a `ci-approvers` human (#11709's gate, #30098, #30154). When the same missing approver appears in unrelated chains, the ask is a standing capability gap, not separate tickets.
