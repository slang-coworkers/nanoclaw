# Phantom red variant 2: SAME-event duplicate check-suites defeat "prefer the pull_request suite" — created_at is the only load-bearing rule

## Extends the earlier phantom-red notes

Two prior notes covered `filter=latest` returning a stale **`workflow_dispatch`** suite that outlives a later green `pull_request` run, with the resolution "key on suite `created_at`, prefer the newest `pull_request`-event suite." Measuring the population turned up a second variant that **breaks the event-preference half of that rule**.

## The pattern is fleet-wide, not CI-specific

At one shader-slang/slang PR head, **eight** workflows were doubled: `PR Maintenance` (×4), `Check Formatting`, `Verify PR Labels`, `Check GitHub Actions Workflows`, `REUSE Compliance Check`, `Claude PR Review`, `CI SlangPy Trigger Test`. So a red **formatting or label gate** can equally be a superseded suite — and those are exactly the reds routinely waved off as "policy gate, author hygiene" without reconciling the suite.

## Variant 2 — same-event duplicates

Swept 29 red PRs across every workflow: **4 more phantoms, all `Verify PR Labels`**, all `pull_request` on both sides:

| PR | chronology (all event=`pull_request`) | label today |
|---|---|---|
| #11373 | skipped 06-01 → **failure 06-03 05:19** → success 06-03 05:49 | `pr: non-breaking` |
| #10885 | **failure 04-20 17:26** → success 18:27 → success 18:27 | `pr: non-breaking` |
| #11087 | **failure 05-08 06:49** → success 07:07 | `pr: non-breaking` |
| #11964 | **failure 07-07 07:07** → success 07:08 | `pr: non-breaking` |

Mechanism: gate fails → author adds the missing label → gate re-runs **green** → the failed suite persists in `filter=latest` indefinitely. All four satisfy the gate now.

## Why this matters for the rule

**Both suites share `event=pull_request`, so "prefer the `pull_request`-event suite" cannot discriminate them.** Only **suite `created_at` recency** resolves this variant.

- **Load-bearing: suite `created_at`.**
- **Tiebreaker only, for the `workflow_dispatch` variant: event preference.**
- Defensive, not load-bearing: filtering to a real conclusion (`success|failure|timed_out`) — measured 0 occurrences of a `skipped` suite winning on recency across 75 PRs, since the `skipped` path-filter no-op is always the oldest.

Any rule phrased as "pick the `pull_request` suite" silently fails on variant 2. Net result: **6 of 29 red PRs carried at least one phantom red.**

## Counter-check worth doing

Not every stale-looking gate is a phantom. A `check-formatting` red on another PR had a **single** suite, `pull_request`, no supersession — genuinely author-owned. Reconciling suites is what distinguishes them; assuming either way is the error.
