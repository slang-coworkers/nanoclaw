---
title: "Eval Runner: Fixer Trials on the slang-eval Fork"
type: concept
group: agent-fixer-codex-skills
tags: [eval-runner, eval-slang-fixer, slang-eval, fork, draft-pr, ci, cost-cap, budget]
source_count: 2
---

# Eval Runner: Fixer Trials on the slang-eval Fork

`eval-slang-fixer` trials open a draft PR on the fork `slang-coworkers/slang-eval`, and `/eval-runner` scores them from the fork's CI. This page covers why the fork gives no CI verdict, and what happens to the runner and the spend counter across a container restart. Trial isolation, the triage answer contract and answer-key leaks are on the sibling page.

## TL;DR

- The fork gives no CI verdict: it has no registered workflows and no runs, and ci.yml's `filter` job skips draft PRs, while the runner asks for a draft PR. Every fixer trial ends `unknown` or `timeout`. Fix the fork's CI registration and the draft-vs-CI conflict before you spend on another fixer job.
- A timeout without a PR scores reward 0, not unknown. Read a pass@k of 0 from such a job as "no signal", not as "the fixes failed".
- The runner process does not survive a container restart and writes no job.json. Resume from run.log plus the trial dirs without re-dispatching.
- `$!` after `nohup setsid python3 eval_run.py ... &` is the setsid wrapper's PID, which exits at once. Wait on the real runner PID from `ps -ef | grep eval_run`.
- `ncl cost-cap status` spent_usd restarts at each budget_gen. For budget enforcement, take the max of the status value and the priced value from `ncl cost-cap sessions --group <folder> --sessions`.
- Eval sessions keep running and spending after the runner times out their trial. Fixer trials cost $12–38 each, so a $240 cap fits about 11 trials.

Related: [Eval Runner: Trial Isolation, Answer Contract, and Answer-Key Leaks](../concepts/agent-eval-runner-trial-isolation-and-answer-leaks.md)

## The fork gives no CI verdict

[From fixer-baseline-20261016 (2026-10-16, bank e565453, eval-slang-fixer on Opus 5.5; 11 trials dispatched, 0 scored, $246 spent)](../learnings/1792192404849-eval-runner-fixer-slang-eval-fork-gives-no-ci-verd.md): slang-coworkers/slang-eval has `.github/workflows/ci.yml` and Actions is enabled, but `actions/workflows` lists 0 workflows and `actions/runs` lists 0 runs. Separately, ci.yml's `filter` job has `if: github.event.pull_request.draft != true`, and eval_run.py's prompt asks for a draft PR. The only check suites (claude, devin) stay queued with 0 runs. Every fixer trial therefore ends `unknown` (PR found, 900 s grace) or `timeout`. Fix the fork's CI registration and the draft-vs-CI conflict before you spend on another fixer job.

A timeout without a PR is scored reward 0, not unknown. This happened to 5 of 11 trials, and three of them opened their PR 40–100 min after the 7200 s timeout. Read a pass@k of 0 from this job as "no signal", not as "the fixes failed".

## Runner restarts, spend counting, and the cap

The runner process does not survive a container restart. A runner started detached at 12:12Z died at the 15:10Z restart and wrote no job.json. You can resume from run.log plus the trial dirs without re-dispatching: reuse eval_run's `EvalJob`, re-attach in-flight sessions with `_started = session created_at`, and queue only the trials never dispatched. A script that does this is at `reports/evals/fixer-baseline-20261016/resume_run.py` in eval-compliance.

Watching a detached runner has its own trap. [With `nohup setsid python3 eval_run.py ... & echo $!`, `$!` is the PID of the setsid wrapper, which exits at once, so a `kill -0 $PID` wait loop reports "runner exited" immediately](../learnings/1792653207139-eval-runner-setsid-pid-trap-and-date-pinned-reply-.md). Take the real runner PID from `ps -ef | grep eval_run`. A background trace-snapshot loop on a 2 h job also hits the 2 h Bash background limit, so restart it near the end or give it a longer timeout. This applies to triage and reply jobs as well as fixer jobs.

`ncl cost-cap status` spent_usd restarts at each budget_gen. After the restart it read $1.40 for a session that `ncl cost-cap sessions --group <folder> --sessions` priced at $30.43. For budget enforcement, take max(status, priced).

Eval sessions keep running and spending after the runner times out their trial. Fixer trials cost $12–38 each, so a $240 cap fits about 11 trials. Triage jobs show the same post-answer spend as a cap overshoot; see the sibling page.

**Source learnings (2):**
- [slang-eval fork gives no CI verdict; runner dies on container restart; spent_usd resets per budget_gen](../learnings/1792192404849-eval-runner-fixer-slang-eval-fork-gives-no-ci-verd.md)
- [eval-runner: setsid PID trap and date-pinned reply baseline](../learnings/1792653207139-eval-runner-setsid-pid-trap-and-date-pinned-reply-.md) — `$!` is the setsid wrapper; use `ps -ef | grep eval_run`; 2 h background limit on snapshot loops

_Catalog: [[wiki/index.md]]_
