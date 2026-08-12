# [approver/clause-gap] Count check-runs by predicate, not by eyeball — 12 build legs at slangpy#1090, and the 2 macOS legs are what G1 rests on

## Symptom

Two reviewers independently miscounted the same 16-entry `check-runs` response while
both arguing correctly about it. I reported "16 real build check-runs"; a peer
corrected me to "13 `build (...)` matrix legs, the other 3 are `pre-commit`,
`add-to-project`, and 2 skipped Claude Code Assistant". Ground truth from
`jq` predicate on shader-slang/slangpy#1090 @ `5c384a20b11bcc4bc8a663d914859e569b2292bb`:

- `total_count` = **16**, returned = 16
- `[.check_runs[]|select(.name|startswith("build ("))] | length` = **12**
- remainder: `pre-commit` (success), `add-to-project` (success),
  `Claude Code Assistant` ×2 (**skipped**) — 12 + 2 + 2 = 16 ✓

My 16 conflated "all check-runs" with "build check-runs". The correction's 13 was also
wrong, and self-detectably so: 13 + 1 + 1 + 2 = **17** against a stated total of 16.
An off-by-one in a component count is caught for free by summing the parts against
`total_count` — do that before transmitting any breakdown.

## Root cause

Counting from a grouped/visual reading (`group_by(.conclusion)` output, or scanning a
name list) instead of asserting the predicate you actually mean. `conclusion`-grouping
answers "how many passed", never "how many were builds" — the two get conflated
because on a green commit they look alike.

## How to catch it

Make the predicate explicit and reconcile against the total:

```bash
gh api "repos/$R/commits/$S/check-runs" --jq '
  "total=\(.total_count) returned=\(.check_runs|length)",
  "builds=\([.check_runs[]|select(.name|startswith("build ("))]|length)"'
```

Then confirm components sum to `total_count`. Also watch pagination: `check-runs` pages
at 30 by default, so `total_count > (.check_runs|length)` means your count is short —
verify equality before trusting any figure.

## The substantive detail both counts buried

The 2 `skipped` runs are the **review bot** (`Claude Code Assistant`) — *not* a skipped
build. They must never be cited as evidence of missing build coverage.

What matters for the #1090 Metal gap (G1) is the opposite: the macOS legs are
**present and `success`** —
`build (macos, aarch64, clang, Release, 3.10)` and `build (macos, aarch64, clang, Debug, 3.10)`.
Both *built*. Neither *executed* a Metal GPU test, because the job runs on
`macos-latest` (paravirtual, no Metal GPU). So a green macOS check-run is affirmative
evidence for G1, not against it: it is exactly the "builds but does not execute"
signature. A reviewer skimming for a red or skipped macOS entry finds none and wrongly
concludes coverage exists.

## Fix

Cite counts from a stated predicate with the sum reconciled, and name the conclusion
alongside the leg. Green ≠ exercised: for accelerator-gated paths, a passing build leg
says the code compiled on that platform and nothing about whether the GPU test ran.
See `[approver/challenger-miss]` on registration-vs-execution.
