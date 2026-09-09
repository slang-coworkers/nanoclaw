---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787073715089-rgfdiu
written_at: 2026-08-18T20:45:31.116Z
---

# [approver/challenger-miss] A formatting/dispatch fix can redden the very CI check that runs the tool — verify the activated check, not the combined status

## Symptom
PR #12600 (shader-slang/slang) is a one-line fix to `extras/formatting.sh:444`
(`((run_markdown))` → `((run_all || run_markdown))`) so the markdown stage runs
in default/`--modified` runs. Devin and CodeRabbit both cleared the diff. The
Step-1 clause script reported `ci_green_on_sha=pass`. All three signals looked
green.

## Root cause
Two independent traps stacked:
1. **The clause "pass" was on the policy flag, not on CI.** Policy `v0-shadow-wide`
   sets `require_ci_green:false`, so `eval-clauses.py:184` short-circuits to pass
   with evidence "policy does not require CI green" — it NEVER reads status. A
   "pass" here says nothing about CI. (Separately, when the policy DOES require
   green, `:187` reads the combined `/status` endpoint, which folds only legacy
   commit-statuses and is blind to GitHub Actions check-runs — the known
   false-green trap. Here it never even got that far.)
2. **The PR's own change activates the failing check.** The `check-formatting` CI
   job runs `./extras/formatting.sh --check-only` — a default (`run_all`) run.
   Before this PR that run skipped markdown; after it, the run reaches the markdown
   stage and prettier flags `REVIEW.md` (never touched by the PR; byte-identical
   head vs master → head-owned drift) plus residual `CLAUDE.md`/`README.md` drift.
   Run 32131449855 (head_sha = the pinned head, attempt 1, sole run) = failure,
   exit 1. Exactly the caveat linked issue #12368 predicted.

## How to catch it
- **For any PR that changes what a CI check runs (formatter dispatch, lint config,
  test selection), enumerate the check-runs on the pinned head directly** —
  `gh api repos/O/N/commits/<sha>/check-runs --paginate` — and read the run whose
  behavior the PR changes. Never infer CI health from the clause script's
  `ci_green_on_sha` when `require_ci_green:false` (the pass is vacuous), and never
  from the combined `/status` endpoint (blind to Actions check-runs).
- **The positive control for a "make the tool run" fix is: does the tool now run
  clean?** A dispatch fix that activates a stage the tree isn't clean under
  reddens the gate. Ask issue #12368's question: "adding run_all without
  reformatting the drifted files turns the gate red."
- Page discipline: page-1-only `check-runs` missed both red checks here; the full
  `--paginate` sweep found `check-formatting` and `check-pr-label` failing.

## Fix
Decision = ABSTAIN_POLICY (OPEN_GAP): not a 🔴 code bug (the :444 change is
correct and minimal), but the fix is incomplete — it leaves a required check red —
so a human decides whether to require the REVIEW.md reformat before merge.
