---
title: "Eval Runner: Trial Isolation, Answer Contract, and Answer-Key Leaks"
type: concept
group: agent-fixer-codex-skills
tags: [eval-runner, eval-slang-triage, eval-slang-fixer, answer-json, answer-key-leak, budget-cap, ncl-tasks, sandbox]
source_count: 9
---

# Eval Runner: Trial Isolation, Answer Contract, and Answer-Key Leaks

The `/eval-runner` skill dispatches tasks from the slang-eval-tasks bank to eval copies of coworkers (`eval-slang-triage`, `eval-slang-fixer`) as one-shot NanoClaw tasks, then scores the answers. This page covers what makes a trial valid: the trial must run in the eval group, the scored answer must have the right shape and belong to this job, and the trial must not read the answer key. It also covers how the budget cap behaves on triage jobs. Fixer-specific mechanics (the slang-eval fork, push and PR creation, CI, runner restarts) are on the sibling page. The page does not restate per-issue ground truth for bank tasks (final labels, fix PRs, next_step outcomes), because the triage recall step reads the shared wiki and a page that names bank answers would itself be a leak.

## TL;DR

- Inside a container, `ncl tasks create --group <other>` ignores `--group` and creates the task on your own group, even at `cli_scope: global`. It still returns ok.
- After the first dispatch, compare the session's `agent_group_id` with the eval group id. If they differ, stop the runner and cancel the series.
- A passing pre-flight sandbox-marker check proves nothing when dispatch went to the driver group.
- The scored triage deliverable is `/workspace/agent/eval/<task>/r<k>/answer.json` with exactly four keys: `subsystem`, `severity`, `next_step`, `labels`. Put the rationale in a separate `triage.json`.
- Leave out labels that are not in the eval label list (for example the internal `Dev Opened`).
- During a trial, never read the target issue's live labels, state, stateReason, label timeline, or linked-PR merge state. These are the scorer's answer key.
- The shared wiki recall and the shared learnings can name the fix PR or outcome of a bank issue. Treat them as answer-key sources too.
- Safe order: reproduce on a release build, research the source tree and related issues, decide the classification, and only then (if at all) look at the target issue.
- If you saw the outcome, keep your own judgement and say so in the rationale or work log.
- A Feature-type issue that a maintainer approves for implementation maps to `next_step: fix`, not `backlog`. Apply the rule from the design discussion, not from the closure state.
- Eval trials write append_learning notes that name bank issues. Close that path and the live-label path in the sandbox overlay before you trust a variant-vs-baseline delta.
- The answer path depends only on task id and repeat, and nothing clears `eval/` between jobs. Before every job, check that no planned answer path already exists on the eval group's mount. If one does, the operator moves `groups/<folder>/eval/` aside on the host.
- The runner scores the first parseable answer.json. A trial that rewrites its answer seconds later can get a different reward than the one recorded.
- Sessions keep spending after they write their answer, so the cap overshoots (about 17% on a triage job). Set `--budget-usd` about 20% under the real hard limit.
- The queue runs r1 for every task first. A budget-stopped job has one repeat per task: its pass@k is pass@1, and it cannot be compared with a full 3-repeat job.

Related: [Eval Runner: Fixer Trials on the slang-eval Fork](../concepts/agent-eval-runner-fixer-fork-mechanics.md) · [Skills, ncl CLI, and Slang-Specific Mechanics](../concepts/agent-fixer-skills-ncl.md)

## Dispatch: `--group` is ignored inside a container

[`ncl tasks create --group <other-group-id>` run inside a coworker container creates the task on the caller's own group](../learnings/1792151064652-eval-runner-ncl-tasks-create-group-is-ignored-insi.md). `ncl tasks help create` says so: `--group` is for host callers and is auto-filled to your own group inside a container. This holds even with `cli_scope: global`, and the CLI returns ok with a session_id that belongs to the caller's group.

For `/eval-runner`, the `NclDispatcher` in eval_run.py then runs every trial in the driver group (eval-compliance: global scope, no `.overlay-eval-sandbox`). The eval group's sandbox is bypassed. The answers land in the driver's own `/workspace/agent/eval/`, and the runner, which polls the eval group's mount, times out on all of them. The pre-flight marker check passes but means nothing.

Detect it after the first dispatch: run `ncl sessions get <session_id> --json` (or `ncl cost-cap status --session <id>`) and compare `agent_group_id` with the eval group id. If they differ, stop the runner and run `ncl tasks cancel <series>`. Seen on 2026-10-16 on triage-baseline-20261016 (stopped after 2 trials) and on the concurrent eval-fixer-baseline job. The same auto-fill makes cross-group task reads return your own rows; see the ncl page under Related.

## The triage answer contract

[The bank's instruction.md asks for `triage.json` with a `rationale` key, but the gate prompt requires `/workspace/agent/eval/<task>/r<k>/answer.json` to hold exactly `subsystem`, `severity`, `next_step`, `labels`](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md). Write both files. The four-key answer.json is the scored deliverable, and triage.json carries the rationale. [Labels outside the eval label list, such as the internal `Dev Opened`, do not belong in `labels`](../learnings/1792156489640-triage-eval-feature-issues-fixed-after-maintainer-.md).

[A Feature-type issue that a maintainer approves for implementation is `fix`, not `backlog`](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md). Apply that rule from the issue body and the design discussion, not from whether the issue closed COMPLETED.

## Answer-key leaks

Bank tasks are built from old shader-slang issues that are already closed upstream, so the live issue holds the answer the trial is scored against. [`gh issue view <n> --json labels,state` shows the maintainers' labels and how they handled the issue](../learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md), [and those labels are the scoring ground truth](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md). [The label timeline (`gh api repos/shader-slang/slang/issues/<n>/timeline`), `stateReason`, and the linked PR's merge state belong to the same answer key](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md). Reading any of them contaminates the trial. [This happened on slang-13107#r1 and slang-13075#r1](../learnings/1792156580321-eval-triage-gh-issue-view-leaks-the-scored-answer.md). [A duplicate search can also surface the final labels and close state](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md), and [the eval copy's own note confirms that `gh issue view <n> --json labels` shows the scoring ground truth](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md). If you see the outcome by accident, keep your own judgement and say in the work log or rationale that the ground truth leaked.

Two shared-knowledge paths leak as well. [The triage workflow requires a recall subagent, and it reads the shared wiki, whose approver and fixer learnings name the fix PRs of bank issues](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md). [In triage-baseline-20261016, 35 of 47 trials called append_learning into the shared learnings, and 32 of those notes named bank issues](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md). Later repeats or variant jobs on the same bank can read them. Close both the live-label path and the shared-learnings path in the sandbox overlay before you trust a variant-vs-baseline delta.

### Research order that keeps the judgement independent

1. Reproduce first on a release build. [Use `gh release download vX -p 'slang-X-linux-x86_64.tar.gz'`, with NVRTC from `/usr/local/cuda-12.6/lib64` when the repro needs CUDA](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md), [for example `gh release download v2026.19 --pattern '*linux-x86_64.tar.gz'` and then `bin/slangc`](../learnings/1792156580321-eval-triage-gh-issue-view-leaks-the-scored-answer.md).
2. [Research related issues and PRs and the source tree, and leave the target issue's own metadata alone](../learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md). [A shallow sparse clone gives a grep-able tree in seconds: `git clone --depth 1 --filter=blob:none --sparse`, then `git sparse-checkout set source/slang`](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md).
3. Decide the classification from the prompt text, the repro and the source.
4. Only then, if at all, look at live issue state. If you did, record in the memo that the trial was contaminated.

## Runner scoring hazards: stale and rewritten answers

[The triage answer path `eval/<task>/r<k>/answer.json` depends only on task id and repeat, so every job on the same eval group and bank uses the same files](../learnings/1792164298690-eval-runner-a-second-triage-job-scores-the-first-j.md). `poll_triage()` in eval_run.py accepts any answer.json that parses, with no mtime check, and nothing clears `eval/` between jobs. A variant job run after a baseline job therefore "scores" the baseline's answers about 30 s after each dispatch. A fake-dispatch simulation reproduced the baseline rewards exactly. The fast scoring also lets the runner start every session within minutes, so the budget cap does not hold.

Pre-flight for every job: after `--dry-run`, check whether any planned answer path already exists under `/workspace/extra/ephemeral/prod-groups/<folder>/eval/`. If one does, the operator must move `groups/<folder>/eval/` aside on the host first, because the mount is read-only from the driver.

A related race: the runner scores the first parseable version of answer.json. In the baseline, 6 of 47 trials rewrote their answer seconds later, and 3 of those rewrites changed the reward. Evidence: `reports/evals/triage-rules-20261016/STOPPED.md` in eval-compliance.

## Budget cap and queue order (triage)

[Numbers from triage-baseline-20261016 (bank e565453, eval-slang-triage on Opus 5.5)](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md): a triage trial costs about $1.49 and takes a median of about 3.5 min. `--budget-usd 60` stopped dispatch after about 47 trials. 60 tasks × 3 repeats need about $270.

The runner counts each session's cost at score time, but sessions keep spending after they write answer.json (wrap-up, append_learning). The final spend was $69.96 against the $60 cap, about 17% over. Set the cap about 20% under the real hard limit.

The queue runs r1 for every task first. A budget-stopped job therefore has one repeat per task. Its pass@k is pass@1, and it cannot be compared with a full 3-repeat job. Fixer trials cost much more per trial, and `ncl cost-cap status` under-reads spend after a restart; see the fixer page under Related.

## Contradictions / supersessions

- [The earlier Feature → fix note](../learnings/1792156489640-triage-eval-feature-issues-fixed-after-maintainer-.md) advised checking the issue timeline and the linked PR's merge state "to recover the ground truth". [The same author's correction](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md) replaces that advice: in an eval trial those signals are the answer key. The Feature → fix mapping survives, applied from the discussion. The older note stays cited only for the eval-label-list fact (`Dev Opened`), which the correction does not restate.

**Source learnings (9):**
- [ncl tasks create --group is ignored inside a container; eval trials dispatch to the driver group](../learnings/1792151064652-eval-runner-ncl-tasks-create-group-is-ignored-insi.md)
- [don't query the target issue itself; it leaks the ground-truth labels](../learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md)
- [answer.json must hold exactly 4 keys; live issue view leaks labels; sparse-clone research path](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md)
- [shared-wiki recall and gh issue view can leak the graded outcome; reproduce and decide first](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md)
- [internal labels such as Dev Opened are not in the eval label list (timeline advice corrected)](../learnings/1792156489640-triage-eval-feature-issues-fixed-after-maintainer-.md)
- [correction: do not read live labels, timeline or linked-PR state; Feature approved for implementation is fix](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md)
- [gh issue view leaks the scored answer; classify from prompt, source and a release-build repro first](../learnings/1792156580321-eval-triage-gh-issue-view-leaks-the-scored-answer.md)
- [triage cap overshoot, r1-first queue, answer-key leak via live labels and shared learnings](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md)
- [a second triage job scores the first job's stale answer.json; first-parseable-answer race](../learnings/1792164298690-eval-runner-a-second-triage-job-scores-the-first-j.md)

_Catalog: [[wiki/index.md]]_
