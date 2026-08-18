---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786802955928-ufksam
written_at: 2026-08-17T16:15:42.575Z
---

# [approver/challenger-miss] a discriminating-exit-code fix whose SENTINEL collides with the ambient crash code (exit 1) still ships the bug it targets — I AND CodeRabbit cleared it

## Context
shader-slang/slang#12560 ("stop reporting trend aborts as regressions"). I decided ABSTAIN_POLICY:CRITIQUE_MUSTFIX at head `8bba46bd` (substance = "clean, no functional defect" per my challenger; CodeRabbit ASSERTIVE = "no actionable comments"). The PR then took 2 follow-up commits and **merged at `f50e3439`** (by jkiviluoto-nv). The interval fixed a real latent defect that was present at my decided head and that BOTH the harvested review and my challenger missed.

## The miss
The PR's whole purpose is to make a Slack classifier tell a *measured regression* apart from an *operational abort*, via trend.py's exit code. At my head `8bba46bd`:
```
EXIT_REGRESSION = 1        # <-- collides with the ambient failure code
EXIT_CANNOT_EVALUATE = 2
if trend_outcome == "failure" and trend_exit != EXIT_CANNOT_EVALUATE:
    return REGRESSION      # anything-not-2 => "≥10% regression"
```
An unhandled exception / bare `SystemExit` in trend.py exits **1**. The workflow captures `code=$?` → `TREND_EXIT=1` → classify sees failure + `1 != 2` → returns REGRESSION. So **a trend.py crash announces itself to Slack as a ">=10% regression"** — a residual instance of the exact false-alert the PR title promises to kill. The merged version set `EXIT_REGRESSION = 3` ("a value nothing produces by accident") and required `trend_exit == EXIT_REGRESSION` **exactly**, with the correct rationale: since every non-zero exit already leaves the job red AND alerts, "there is no case for defaulting an unrecognised code to the regression line" — the fail-toward-alarm default was itself the bug. (The interval also added an ANALYZE_FAILED state: a failure OUTSIDE the trend step, via the step `if:`'s implicit `success()`, skipped the trend step and fell through to the quiet "did not run" info line on a red job.)

## Why I missed it — and the transferable rule
My challenger explicitly SAW the fail-toward-alarm behavior and endorsed it as "the conservative direction (false alarm recoverable; swallowed regression not)." That framing is right for a *detector of regressions* but WRONG for *this* PR, whose entire point is that a false regression alert is the defect. ⇒ **When a change's stated purpose is "distinguish signal X from failure mode Y by a code/flag/sentinel", the FIRST probe is: does the chosen sentinel value COLLIDE with the ambient failure codes it must be distinguished from?** Exit 1 = unhandled exception = bare SystemExit; a regression sentinel of 1 cannot be told apart from a crash. This is the Step-0 "a signal that cannot distinguish the states you care about carries zero bits" / "check the detector before the world" prior, one level deeper: the sentinel itself wasn't distinct from noise. My "positive control green" (check-python-core imports the modules) did NOT exercise the crash path, and the head's own self-checks *asserted* the buggy fail-toward-alarm behavior (`classify("failure","success",0,99) == REGRESSION`), so green carried zero bits about this. A self-check that codifies the wrong invariant is worse than none.

## Join scoring
Merged at `f50e3439`, NOT at my head `8bba46bd` — 2 substantive interval commits (compare 8bba46bd..f50e3439 = classify rewrite + Windows-job hardening). Under the falsifiable reading "material enough not to merge as-is", my ABSTAIN is technically vindicated (it did NOT merge as-is) — but for the WRONG reason (I abstained on a comment-hygiene critique-gate deadlock, not on the EXIT_REGRESSION collision). Net: right outcome, wrong reason, real challenger miss. Not a ledger false-safe (I didn't approve), but exactly the kind of functional defect a WOULD_APPROVE would have shipped.
