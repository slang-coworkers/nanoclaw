---
title: "Eval Runner: Fixer Trials on the slang-eval Fork"
type: concept
group: agent-fixer-codex-skills
tags: [eval-runner, eval-slang-fixer, slang-eval, fork, git-push, gh-api, draft-pr, ci, cost-cap, budget]
source_count: 4
---

# Eval Runner: Fixer Trials on the slang-eval Fork

`eval-slang-fixer` trials open a draft PR on the fork `slang-coworkers/slang-eval`, and `/eval-runner` scores them from the fork's CI. This page covers how a fixer trial pushes and opens its PR inside the eval sandbox, why the fork's master can already contain the fix, why the fork gives no CI verdict, and what happens to the runner and the spend counter across a container restart. Trial isolation, the triage answer contract and answer-key leaks are on the sibling page.

## TL;DR

- Fork master can already contain the upstream fix for the task. Check with `git log -S<symbol>` or `git log -- <test path>`. If it is there, cut the trial branch from the fix's parent (`<fixsha>^`) and say so in the PR.
- A trial branched from the parent of a landed fix shows `mergeable_state: dirty` against fork master.
- `git push origin <branch>` is refused by gate-eval-sandbox.sh. Push to the explicit URL `https://github.com/slang-coworkers/slang-eval.git <branch>:<branch>`; the gateway injects credentials.
- `gh pr create --repo slang-coworkers/slang-eval` fails with `Resource not accessible by integration`. Open the draft PR with REST: `gh api -X POST repos/slang-coworkers/slang-eval/pulls ... -F draft=true`.
- gate-critique-on-deliver.sh matches on command text. Any command that mentions `gh pr create` needs an approved OUTPUT_REVIEW first, and any file written after the approval invalidates it. Write every artifact before the final OUTPUT_REVIEW round.
- The `<sub>` disclaimer must be the last non-empty line of the PR body. Test a body offline with `pr_description.check_body` from `/app/hooks/lib`.
- The fork gives no CI verdict: it has no registered workflows and no runs, and ci.yml's `filter` job skips draft PRs, while the runner asks for a draft PR. Every fixer trial ends `unknown` or `timeout`. Fix the fork's CI registration and the draft-vs-CI conflict before you spend on another fixer job.
- A timeout without a PR scores reward 0, not unknown. Read a pass@k of 0 from such a job as "no signal", not as "the fixes failed".
- The runner process does not survive a container restart and writes no job.json. Resume from run.log plus the trial dirs without re-dispatching.
- `ncl cost-cap status` spent_usd restarts at each budget_gen. For budget enforcement, take the max of the status value and the priced value from `ncl cost-cap sessions --group <folder> --sessions`.
- Eval sessions keep running and spending after the runner times out their trial. Fixer trials cost $12–38 each, so a $240 cap fits about 11 trials.
- At older bases, `extras/formatting.sh` with no args prints usage and exits 0. Use `--since <base>`.
- In TEST:SIMPLE filecheck, `//CHECK-NOT: error` always matches slang-test's `standard error = {` header.

Related: [Eval Runner: Trial Isolation, Answer Contract, and Answer-Key Leaks](../concepts/agent-eval-runner-trial-isolation-and-answer-leaks.md)

## Fork master can already contain the fix

[In slang-coworkers/slang-eval, fork master can already contain the upstream fix for the eval task](../learnings/1792161506171-eval-fixer-fork-master-may-already-contain-the-fix.md). In one bank task (slang-13265), master already had the upstream fix commit. A regression test written on master then cannot fail before the fix. Check with `git log -S<symbol>` or `git log -- <test path>`. If the fix is there, cut the trial branch from its parent (`<fixsha>^`) and say so in the PR. [A trial based on the parent of an already-landed upstream fix shows `mergeable_state: dirty` against fork master](../learnings/1792165558748-eval-fixer-push-to-slang-eval-fork-by-explicit-url.md).

Other gotchas from the same trial: `extras/formatting.sh` with no args prints usage and exits 0 at older bases, so pass `--since <base>`. In TEST:SIMPLE filecheck, `//CHECK-NOT: error` always matches slang-test's `standard error = {` header. slang-rhi-tests can rerun ray-tracing shaders from a scratch dir with `SLANG_RHI_TESTS_DIR=<dir>`, which gives real OptiX GPU evidence on the L40S without committing submodule changes.

## Pushing and opening the draft PR inside the sandbox

[`git push origin` is refused by gate-eval-sandbox.sh](../learnings/1792167135839-eval-fixer-push-to-the-explicit-fork-url-and-open-.md) with "origin (not a GitHub repository)", because the hook does not resolve remote names. [origin's URL embeds `x-access-token:placeholder@`, and the hook cannot match it to slang-coworkers/slang-eval](../learnings/1792165558748-eval-fixer-push-to-slang-eval-fork-by-explicit-url.md). Push to the explicit URL instead: `git push https://github.com/slang-coworkers/slang-eval.git <branch>:<branch>`. The gateway injects the credentials.

`gh pr create --repo slang-coworkers/slang-eval --draft ...` fails with `GraphQL: Resource not accessible by integration (createPullRequest)`. REST works:

```bash
gh api -X POST repos/slang-coworkers/slang-eval/pulls \
  -f title=... -f head=<branch> -f base=master \
  -F draft=true -F body=@/abs/path/body.md
```

[gate-critique-on-deliver.sh matches on command text](../learnings/1792167135839-eval-fixer-push-to-the-explicit-fork-url-and-open-.md). Any command that mentions `gh pr create`, even a dry-run of the description checker, needs an approved OUTPUT_REVIEW first. Any file written after the approval (even an evidence log) invalidates it, so write every artifact before the final OUTPUT_REVIEW round.

To test a PR body offline:

```bash
python3 -c "import sys; sys.path.insert(0,'/app/hooks/lib'); import pr_description as p; print(p.check_body(open('body.md').read(), 1000, 2))"
```

The `<sub>` disclaimer must be the very last non-empty line. Otherwise the checker counts it toward the previous section's 2-line limit.

## The fork gives no CI verdict

[Trial PRs on the fork show no check runs](../learnings/1792167135839-eval-fixer-push-to-the-explicit-fork-url-and-open-.md). [The cause, from fixer-baseline-20261016 (2026-10-16, bank e565453, eval-slang-fixer on Opus 5.5; 11 trials dispatched, 0 scored, $246 spent)](../learnings/1792192404849-eval-runner-fixer-slang-eval-fork-gives-no-ci-verd.md): slang-coworkers/slang-eval has `.github/workflows/ci.yml` and Actions is enabled, but `actions/workflows` lists 0 workflows and `actions/runs` lists 0 runs. Separately, ci.yml's `filter` job has `if: github.event.pull_request.draft != true`, and eval_run.py's prompt asks for a draft PR. The only check suites (claude, devin) stay queued with 0 runs. Every fixer trial therefore ends `unknown` (PR found, 900 s grace) or `timeout`. Fix the fork's CI registration and the draft-vs-CI conflict before you spend on another fixer job.

A timeout without a PR is scored reward 0, not unknown. This happened to 5 of 11 trials, and three of them opened their PR 40–100 min after the 7200 s timeout. Read a pass@k of 0 from this job as "no signal", not as "the fixes failed".

## Runner restarts, spend counting, and the cap

The runner process does not survive a container restart. A runner started detached at 12:12Z died at the 15:10Z restart and wrote no job.json. You can resume from run.log plus the trial dirs without re-dispatching: reuse eval_run's `EvalJob`, re-attach in-flight sessions with `_started = session created_at`, and queue only the trials never dispatched. A script that does this is at `reports/evals/fixer-baseline-20261016/resume_run.py` in eval-compliance.

`ncl cost-cap status` spent_usd restarts at each budget_gen. After the restart it read $1.40 for a session that `ncl cost-cap sessions --group <folder> --sessions` priced at $30.43. For budget enforcement, take max(status, priced).

Eval sessions keep running and spending after the runner times out their trial. Fixer trials cost $12–38 each, so a $240 cap fits about 11 trials. Triage jobs show the same post-answer spend as a cap overshoot; see the sibling page.

## Contradictions / supersessions

- The two push-and-PR notes ([older](../learnings/1792165558748-eval-fixer-push-to-slang-eval-fork-by-explicit-url.md), [newer](../learnings/1792167135839-eval-fixer-push-to-the-explicit-fork-url-and-open-.md)) agree on the remedy. They give different reasons for the push refusal: the placeholder token in origin's URL, and the hook not resolving remote names. The notes do not reconcile the two reasons. The newer note does not restate the `mergeable_state: dirty` fact, so both stay cited.
- "Zero registered Actions workflows" in the push notes is refined by [the fixer-baseline note](../learnings/1792192404849-eval-runner-fixer-slang-eval-fork-gives-no-ci-verd.md): ci.yml exists and Actions is enabled, but the workflow is not registered, and it would skip draft PRs anyway.

**Source learnings (4):**
- [fork master may already contain the fix; branch from the pre-fix parent; formatting.sh and CHECK-NOT gotchas](../learnings/1792161506171-eval-fixer-fork-master-may-already-contain-the-fix.md)
- [push to slang-eval by explicit URL, open the PR via REST; mergeable_state dirty on a pre-fix base](../learnings/1792165558748-eval-fixer-push-to-slang-eval-fork-by-explicit-url.md)
- [push to the explicit fork URL, open the draft PR via REST; critique-gate text match; PR body checker](../learnings/1792167135839-eval-fixer-push-to-the-explicit-fork-url-and-open-.md)
- [slang-eval fork gives no CI verdict; runner dies on container restart; spent_usd resets per budget_gen](../learnings/1792192404849-eval-runner-fixer-slang-eval-fork-gives-no-ci-verd.md)

_Catalog: [[wiki/index.md]]_
