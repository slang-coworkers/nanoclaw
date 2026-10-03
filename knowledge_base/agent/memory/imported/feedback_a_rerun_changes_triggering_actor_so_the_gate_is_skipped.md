---
name: feedback_a_rerun_changes_triggering_actor_so_the_gate_is_skipped
description: "RETRACTS my own published 'the 12h age-out is bounded, self-healing, no human action owed'. Measured: escalation is unreachable on BOTH arms — attempt 1 has age~0.3min (gate starts <30s after creation), and on a rerun github.triggering_actor becomes github-actions[bot] so IS_THROTTLED_BOT=false and wait-for-priority.py is never called (5 of 5, complete population). The rerun IS the working escape hatch, by BYPASSING the gate, not by aging."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: de399eac-1a9d-4047-90ad-7b81aca21579
---

Measured 2026-08-06 at `d7d59f374` while verifying shader-slang/slang#12391 (the anti-starvation
bound in `extras/ci/wait-for-priority.py` cannot be reached under sustained contention), plus a
second instance 08-08.

## What I published, and what is true

I wrote in [[feedback_a_pushing_draft_starves_its_own_ci_retry]] (propagated into
[[feedback_absence_of_an_effect_is_not_absence_of_the_actor]]) that `--max-yield-hours 12`,
measured from the fixed `created_at`, makes bot-dispatch starvation *"bounded, self-healing — no
human action owed"*. **Every code citation was right; the behavioural conclusion is false.** The
escalation branch (`wait-for-priority.py:176-182`,
`escalated = yielded and self_age_hours >= args.max_yield_hours`) is unreachable on both arms:

| arm | `IS_THROTTLED_BOT` | gate script called? | age when evaluated |
|---|---|---|---|
| attempt 1 (bot dispatch) | `true` | yes | **~0.2–0.4 min** (6/6; triager: 40 runs, 0.18–0.65 min) |
| attempt ≥2 (rerun) | **`false`** | **no — exits at `ci.yml:101`** | never computed |

- **Attempt 1 can never be old.** The gate job (`wait-for-human-priority`, which `needs: [filter]`
  at `ci.yml:66-67` — I first misstated it as the run's first job without reading the graph) starts
  within a minute of creation, so the `>= 12h` compare is always false.
- **A rerun does not re-enter the gate.** `IS_THROTTLED_BOT` (`ci.yml:99`) is
  `event_name == 'workflow_dispatch' && github.triggering_actor == 'nv-slang-bot[bot]'`.
  `retry-yielded-bot-ci.py:144-152` reruns under the retry workflow's token, so
  **`triggering_actor` flips to `github-actions[bot]`** while `actor` stays `nv-slang-bot[bot]`.
  5 of 5 bot `workflow_dispatch` reruns in the 200 most recent CI runs: `IS_THROTTLED_BOT: false`.

The docstring's load-bearing sentence (*"the age keeps growing each time the retry workflow reruns"*,
`:65-68`) describes a computation that never happens. The rerun **does** rescue the run — #29837,
#29753, #29790 all att1 failure → att2 success — but by **bypassing** the gate, not by aging. This
also refutes #12391's fix direction 2 (let the retry escalate an aged run): the rerun never consults
aging. The honest bound: bot starvation ends only when `any_active_ci` goes quiet, which #12391
correctly calls unbounded.

## Second instance (08-08): the same flip produced a 31h deadlock

Run #30098 (`31179559787`, branch `fix/issue-12383`): attempt 2, `triggering_actor=github-actions[bot]`,
`status=waiting` on the falcor-ci / ci-approvers environment gate, `wait_timer: 0`,
`current_user_can_approve: false` ⇒ no elapsed-time exit at any duration.

**Exempt as a subject, blocking as an object.** `ci.yml:101` reads `triggering_actor`, so #30098
skips the gate and its ceiling. But `run_actor_login()` (`ci_priority_common.py:48-55`) also prefers
`triggering_actor`, and `is_bot()` (`:40-45`) matches any `…[bot]` suffix — so it still classifies as
`older_bot`, and 9 later dispatches across 4 branches yielded behind it.

Paired control — two attempt-2 reruns, one field apart:

| run | `actor` | `triggering_actor` | outcome |
|---|---|---|---|
| #30105 | `nv-slang-bot[bot]` | `nv-slang-bot[bot]` | **escalated at +12h00m55s**, then success |
| #30098 | `nv-slang-bot[bot]` | `github-actions[bot]` | exempt, waiting 31h+ |

The ceiling works when reached; this run was unreachable by it. Meanwhile `ci-retry-yielded-bot.yml`
ran 16 consecutive hourly times, all `conclusion=success`, each logging *"CI is still active …
not rerunning bot CI — active #30098 (waiting)"*.

**Fix:** `ci.yml:101` should key on `actor`, not `triggering_actor`, so a rerun cannot launder a run
out of its own throttle class. Human unblock: approve **or cancel** the stuck run — cancelling also
frees the retry path. (`#30098` is a `run_number`, not a PR; branch names carry the *issue* number —
`fix/issue-12307` → PR #12310.)

## Stale doc sites (claim-keyed sweep of `extras/ci/` + `.github/workflows/`)

| # | site | asserts |
|---|---|---|
| 1 | `wait-for-priority.py:26-28` | "guarantees every bot run completes … even during sustained contention" |
| 2 | `wait-for-priority.py:65-67` | "the age keeps growing each time the retry workflow reruns" |
| 3 | `wait-for-priority.py:173-174` | "a continuous stream … cannot starve this bot run indefinitely" |
| 4 | `wait-for-priority.py:130-135` | `--max-yield-hours` `--help`: "measured from its original creation, across reruns" — the only site visible without reading code |
| 5 | `retry-yielded-bot-ci.py:167-173` | aging is "the real terminator" — inverted |
| 6 | `ci-retry-yielded-bot.yml:46-50` | 16h > 12h ordering load-bearing — inert |

Excluded on inspection: `ci.yml:80-81` (a different starvation — the cap monitor), `ci.yml:109` (the
flag), `wait-for-priority.py:189` (the escalation's runtime `print`, not doc prose). The comparison
itself is sound given a true age — don't change it, but do expect to edit the file.

## How to apply (slang CI priority gate)

1. Read the gate job's `IS_THROTTLED_BOT` env line first — it decides whether the script ran at all.
2. `run_attempt > 1` ⇒ assume the gate was skipped until the log says otherwise.
3. Never cite the 12h ceiling as a guarantee.
4. **Grepping CI job logs:** GitHub echoes the whole `run:` block (prefixed `^[[36;1m` / inside
   `##[group]`), so any string that also appears in the workflow source — e.g. `Not a throttled bot
   run` — matches every log. Use a string only the script prints (`Priority gate for run`: 1 on
   #29837 att1, 0 on att2) or the resolved env value (`IS_THROTTLED_BOT: (true|false)`), and report
   each instrument's count separately with the decisive one named.
5. Alarm on a monitor's **decision line**, never its conclusion — correctly-declining and
   successfully-acting are the same green
   ([[feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun]]).

## Lessons

- ⭐**A bound evaluated only when the measured quantity is structurally ~0 is decorative and reads as
  a guarantee.** For any threshold, ask what the left-hand side IS at the instants the compare runs.
  Same class as [[feedback_a_guard_can_be_inert_and_read_as_passing]].
- ⭐**`actor` and `triggering_actor` diverge on a rerun.** Any condition keyed on `triggering_actor`
  silently changes meaning on attempt ≥2 — and can change differently in two places (exempt here,
  classified-as-blocker there).
- **Enumerate the arms, then measure the quantity in each** — three errors in this claim-space
  (`has_newer_run_for_branch`, single-arm "ready-flip is the only path", this) shared the shape of
  reasoning about code instead of listing execution contexts.
- **A defect report needs the instance where the mechanism succeeds** (#30105), or it indicts the
  design instead of the state ([[feedback_mechanism_must_predict_observed_coordinates]]).
- **Enumerate stale docs by the claim across the whole surface, not by the files in the
  conversation** — the count went 3 → 5 → 6, each "complete", every miss in a file already quoted.
  Rank doc sites by reader reach (`--help` first). Search for the claim, not your memory of its
  wording; inspect and exclude, never count raw grep hits.
- **A reconciliation that concludes "nobody erred" is the weakest evidence** — the peer's tidy
  "unit difference" rested on a line set I never displayed and absorbed a real miscount of mine.
  Re-derive your own number first ([[feedback_a_reconciling_instrument_must_report_the_censused_unit]]).
- **A verb names an action; the pathology is a property of its object.** 3 of 12 "yielding behind
  earlier bot CI" lines pointed at bots already `success` — correct behaviour. Resolve the referent
  and check its state before counting the radius.
