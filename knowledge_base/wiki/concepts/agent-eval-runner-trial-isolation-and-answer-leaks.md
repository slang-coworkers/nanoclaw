---
title: "Eval Runner: Trial Isolation, Answer Contract, and Answer-Key Leaks"
type: concept
group: agent-fixer-codex-skills
tags: [eval-runner, eval-slang-triage, eval-slang-fixer, answer-json, answer-key-leak, budget-cap, ncl-tasks, sandbox, eval-memory-contamination, triage-json, llm-judge, reply-eval]
source_count: 17
---

# Eval Runner: Trial Isolation, Answer Contract, and Answer-Key Leaks

The `/eval-runner` skill dispatches tasks from the slang-eval-tasks bank to eval copies of coworkers (`eval-slang-triage`, `eval-slang-fixer`) as one-shot NanoClaw tasks, then scores the answers. This page covers what makes a trial valid: the trial must run in the eval group, the scored answer must have the right shape and belong to this job, and the trial must not read the answer key. It also covers how the budget cap behaves on triage jobs and why the reply-task judge cannot pass a repro claim. Fixer-specific mechanics (the slang-eval fork, push and PR creation, CI, runner restarts) are on the sibling page. The page does not restate per-issue ground truth for bank tasks (final labels, fix PRs, next_step outcomes), because the triage recall step reads the shared wiki and a page that names bank answers would itself be a leak.

## TL;DR

- Inside a container, `ncl tasks create --group <other>` ignores `--group` and creates the task on your own group, even at `cli_scope: global`. It still returns ok.
- After the first dispatch, compare the session's `agent_group_id` with the eval group id. If they differ, stop the runner and cancel the series.
- A passing pre-flight sandbox-marker check proves nothing when dispatch went to the driver group.
- The scored triage deliverable is `/workspace/agent/eval/<task>/r<k>/answer.json` with exactly four keys: `subsystem`, `severity`, `next_step`, `labels`. Put the rationale in a separate `triage.json`.
- The working-dir `/workspace/agent/triage.json` is one file shared by every trial. At trial start it can hold another issue's answer. Always overwrite it and never read it as input. An earlier trial's rationale lives in its `memory/triage-<n>.md` memo.
- If the trial's `eval/<task>/` dir is missing (moved aside after an earlier job), create it again before you write answer.json.
- Leave out labels that are not in the eval label list (for example the internal `Dev Opened`).
- During a trial, never read the target issue's live labels, state, stateReason, label timeline, or linked-PR merge state. These are the scorer's answer key.
- The shared wiki recall and the shared learnings can name the fix PR or outcome of a bank issue. Treat them as answer-key sources too.
- Safe order: reproduce on a release build, research the source tree and related issues, decide the classification, and only then (if at all) look at the target issue.
- If you saw the outcome, keep your own judgement and say so in the rationale or work log.
- A Feature-type issue that a maintainer approves for implementation maps to `next_step: fix`, not `backlog`. Apply the rule from the design discussion, not from the closure state.
- A repro or research subagent in a trial must be told which reads are forbidden, not only "don't write": no `gh issue view`, `gh pr view`, or `gh api` on issues, PRs, timeline or compare. Only `gh release list` and `gh release download` are allowed.
- Eval trials write append_learning notes that name bank issues. Close that path and the live-label path in the sandbox overlay before you trust a variant-vs-baseline delta.
- The eval copy's own group folder leaks earlier answers: `memory/triage-<n>.md` memos (each records its eval answer), `tasks/eval-*` logs, root `triage.json` / `reply.json`, and moved-aside `eval.*` dirs. A repeat of a task the eval copy has seen before is not independent; record the contamination in the memo and work log.
- The answer path depends only on task id and repeat, and nothing clears `eval/` between jobs. Clearing `eval/` alone is not enough. Before every job, check the eval group folder for planned answer paths, `memory/triage-*.md`, `tasks/eval-*` and `eval.*` dirs. The operator clears them on the host, for both arms.
- The runner scores the first parseable answer.json. A trial that rewrites its answer seconds later can get a different reward than the one recorded, and a few such first drafts can make up most of a paired delta. Rescore from the final files before you report a delta.
- Renaming `instructions.prepend.md` restarts the group, wakes every trial session, overwrites their `.claude-trace` files and adds spend. Snapshot the traces as soon as the runner exits.
- The reply-eval LLM judge sees only the reply text and marks any unevidenced "I reproduced this" as dishonest, so reply-eval pass@k is 0 by construction until the rubric changes.
- Sessions keep spending after they write their answer, so the cap overshoots (about 17% on a triage job). Set `--budget-usd` about 20% under the real hard limit.
- The queue runs r1 for every task first. A budget-stopped job has one repeat per task: its pass@k is pass@1, and it cannot be compared with a full 3-repeat job.

Related: [Eval Runner: Fixer Trials on the slang-eval Fork](../concepts/agent-eval-runner-fixer-fork-mechanics.md) · [Skills, ncl CLI, and Slang-Specific Mechanics](../concepts/agent-fixer-skills-ncl.md)

## Dispatch: `--group` is ignored inside a container

[`ncl tasks create --group <other-group-id>` run inside a coworker container creates the task on the caller's own group](../learnings/1792151064652-eval-runner-ncl-tasks-create-group-is-ignored-insi.md). `ncl tasks help create` says so: `--group` is for host callers and is auto-filled to your own group inside a container. This holds even with `cli_scope: global`, and the CLI returns ok with a session_id that belongs to the caller's group.

For `/eval-runner`, the `NclDispatcher` in eval_run.py then runs every trial in the driver group (eval-compliance: global scope, no `.overlay-eval-sandbox`). The eval group's sandbox is bypassed. The answers land in the driver's own `/workspace/agent/eval/`, and the runner, which polls the eval group's mount, times out on all of them. The pre-flight marker check passes but means nothing.

Detect it after the first dispatch: run `ncl sessions get <session_id> --json` (or `ncl cost-cap status --session <id>`) and compare `agent_group_id` with the eval group id. If they differ, stop the runner and run `ncl tasks cancel <series>`. Seen on 2026-10-16 on triage-baseline-20261016 (stopped after 2 trials) and on the concurrent eval-fixer-baseline job. The same auto-fill makes cross-group task reads return your own rows; see the ncl page under Related.

## The triage answer contract

[The bank's instruction.md asks for `triage.json` with a `rationale` key, but the gate prompt requires `/workspace/agent/eval/<task>/r<k>/answer.json` to hold exactly `subsystem`, `severity`, `next_step`, `labels`](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md). Write both files. The four-key answer.json is the scored deliverable, and triage.json carries the rationale. [Labels outside the eval label list, such as the internal `Dev Opened`, do not belong in `labels`](../learnings/1792156489640-triage-eval-feature-issues-fixed-after-maintainer-.md).

The working-dir triage.json is not per trial. [The prompt's `triage.json` sits at `/workspace/agent/triage.json`, one file that every trial overwrites](../learnings/1792306470926-eval-triage-triage-json-in-the-working-dir-is-shar.md), so [at the start of a trial it can still hold the previous issue's answer](../learnings/1792306556116-eval-triage-workspace-agent-triage-json-is-left-ov.md); [one trial found it pre-filled with another task's subsystem, severity and next_step](../learnings/1792307204780-eval-triage-working-dir-triage-json-can-hold-anoth.md). All three cases were seen on 2026-10-18. Always overwrite it, never read it as input, and treat the per-trial answer.json as the only kept record. A reviewer who needs an earlier trial's rationale reads that issue's `memory/triage-<n>.md` memo. [When a task id is re-dispatched after its `eval/<task>/` dir was moved aside (to `eval.triage-baseline-<date>/`), the dir is gone; create it again before you write answer.json](../learnings/1792305223352-eval-re-dispatch-of-the-same-trial-id-finds-the-ea.md). [With no local slang checkout, read-only `gh api repos/shader-slang/slang/contents/<path>?ref=master` is enough to re-check source or CI-workflow facts](../learnings/1792307204780-eval-triage-working-dir-triage-json-can-hold-anoth.md).

[A Feature-type issue that a maintainer approves for implementation is `fix`, not `backlog`](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md). Apply that rule from the issue body and the design discussion, not from whether the issue closed COMPLETED.

## Answer-key leaks

Bank tasks are built from old shader-slang issues that are already closed upstream, so the live issue holds the answer the trial is scored against. [`gh issue view <n> --json labels,state` shows the maintainers' labels and how they handled the issue](../learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md), [and those labels are the scoring ground truth](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md). [The label timeline (`gh api repos/shader-slang/slang/issues/<n>/timeline`), `stateReason`, and the linked PR's merge state belong to the same answer key](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md). Reading any of them contaminates the trial. [This happened on slang-13107#r1 and slang-13075#r1](../learnings/1792156580321-eval-triage-gh-issue-view-leaks-the-scored-answer.md). [A duplicate search can also surface the final labels and close state](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md), and [the eval copy's own note confirms that `gh issue view <n> --json labels` shows the scoring ground truth](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md). If you see the outcome by accident, keep your own judgement and say in the work log or rationale that the ground truth leaked.

Subagents leak the same way. [A repro subagent told only "Do NOT touch GitHub except read-only downloads" still ran gh reads on the issue, the linked PR, the timeline and the compare API to explain its results (slang-13075#r1, 2026-10-18)](../learnings/1792306934765-eval-triage-tell-repro-subagents-not-to-read-the-i.md). A no-write rule does not forbid reads. Name the forbidden reads in every subagent prompt: "Do not run gh issue view, gh pr view, or gh api on issues, PRs, timeline or compare. Only gh release list and gh release download are allowed."

Two shared-knowledge paths leak as well. [The triage workflow requires a recall subagent, and it reads the shared wiki, whose approver and fixer learnings name the fix PRs of bank issues](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md). [In triage-baseline-20261016, 35 of 47 trials called append_learning into the shared learnings, and 32 of those notes named bank issues](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md). Later repeats or variant jobs on the same bank can read them. [Shared wiki concept pages can also quote a maintainer's closing decision on a bank issue, so the mandatory recall step hands the eval copy the scored next_step and labels before any analysis (seen on slang-12916)](../learnings/1792306086806-eval-triage-reruns-are-contaminated-by-shared-wiki.md). Close both the live-label path and the shared-learnings path in the sandbox overlay, and strip issue-specific outcomes from the shared wiki, before you trust a variant-vs-baseline delta. Otherwise score those trials as contaminated.

### The eval copy's own folder carries earlier answers

The eval copy is a long-lived group, and its own folder keeps every earlier job's answers. [A re-dispatch of slang-12714#r1 two days after an earlier run of the same trial id found the earlier live labels in the memo `memory/triage-12714.md`, its index line and the shared wiki](../learnings/1792305223352-eval-re-dispatch-of-the-same-trial-id-finds-the-ea.md), [and slang-12916's memo listed the live labels too](../learnings/1792306086806-eval-triage-reruns-are-contaminated-by-shared-wiki.md). A repeat trial of an issue the eval copy has seen before is therefore not independent; the trial records the contamination in the memo and the work log so the runner can discount the score.

[On triage-rules-20261018 the operator moved `eval-slang-triage/eval/` aside, and the variant still had the baseline's answers](../learnings/1792310997428-eval-runner-clearing-eval-is-not-enough-eval-copy-.md). The group folder still held `memory/triage-<n>.md` (each memo records its "eval answer"), `tasks/eval-triage-*` logs, the root `triage.json`, and the moved-aside `eval.triage-baseline-20261016/` dir. Of 47 trial traces, 16 survived; all 16 read their own memo and old task log before writing answer.json, and 4 read the moved-aside dir. 40 of 47 answers matched the baseline's final answer on every scored field. [Reply trials leak the same way through the root `reply.json` and the old triage memos](../learnings/1792326383997-reply-eval-llm-judge-marks-every-i-reproduced-this.md). Before a variant job, check the eval group folder for `memory/triage-*.md`, `tasks/eval-*` and `eval.*` dirs as well as the answer paths, and have the operator clear them on the host for both arms.

### Research order that keeps the judgement independent

1. Reproduce first on a release build. [Use `gh release download vX -p 'slang-X-linux-x86_64.tar.gz'`, with NVRTC from `/usr/local/cuda-12.6/lib64` when the repro needs CUDA](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md), [for example `gh release download v2026.19 --pattern '*linux-x86_64.tar.gz'` and then `bin/slangc`](../learnings/1792156580321-eval-triage-gh-issue-view-leaks-the-scored-answer.md).
2. [Research related issues and PRs and the source tree, and leave the target issue's own metadata alone](../learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md). [A shallow sparse clone gives a grep-able tree in seconds: `git clone --depth 1 --filter=blob:none --sparse`, then `git sparse-checkout set source/slang`](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md).
3. Decide the classification from the prompt text, the repro and the source.
4. Only then, if at all, look at live issue state. If you did, record in the memo that the trial was contaminated.

## Runner scoring hazards: stale and rewritten answers

[The triage answer path `eval/<task>/r<k>/answer.json` depends only on task id and repeat, so every job on the same eval group and bank uses the same files](../learnings/1792164298690-eval-runner-a-second-triage-job-scores-the-first-j.md). `poll_triage()` in eval_run.py accepts any answer.json that parses, with no mtime check, and nothing clears `eval/` between jobs. A variant job run after a baseline job therefore "scores" the baseline's answers about 30 s after each dispatch. A fake-dispatch simulation reproduced the baseline rewards exactly. The fast scoring also lets the runner start every session within minutes, so the budget cap does not hold.

Pre-flight for every job: after `--dry-run`, check whether any planned answer path already exists under `/workspace/extra/ephemeral/prod-groups/<folder>/eval/`. If one does, the operator must move `groups/<folder>/eval/` aside on the host first, because the mount is read-only from the driver. Moving `eval/` aside is necessary but not sufficient; the memos, task logs and moved-aside dirs in the same folder leak too (see the section above).

A related race: the runner scores the first parseable version of answer.json. In the baseline, 6 of 47 trials rewrote their answer seconds later, and 3 of those rewrites changed the reward. Evidence: `reports/evals/triage-rules-20261016/STOPPED.md` in eval-compliance. [On triage-rules-20261018 the runner's +0.027 paired delta came mostly from 3 baseline first drafts scored before their rewrite; with final-file scores the delta is +0.007 [−0.007, 0.023]](../learnings/1792310997428-eval-runner-clearing-eval-is-not-enough-eval-copy-.md). Rescore both arms from the final files before you report a delta.

[Renaming `instructions.prepend.md` after a job restarts the group. The restart wakes every trial session, overwrites their `.claude-trace` files and adds spend ($55 → $65 on that job)](../learnings/1792310997428-eval-runner-clearing-eval-is-not-enough-eval-copy-.md). Snapshot the traces as soon as the runner exits. `ncl cost-cap status` takes about 9 s per call and fails under parallel calls; one `ncl cost-cap sessions --group <g> --sessions` call reads every session instead.

## Reply tasks: the LLM judge penalises repro claims

[In slang-eval-tasks reply tasks (bank fc5802c), the Opus judge sees only the reply text, the issue and the maintainers' reply](../learnings/1792326383997-reply-eval-llm-judge-marks-every-i-reproduced-this.md). In reply-smoke2-20261018 it set honest=0 on all 3 trials, each time because the reply claimed a reproduction or a source read "with no evidence", although the traces show each trial really ran slangc/nvcc or read the source. Pass needs reward >= 1.0 (0.5×STE + 0.5×judge), so the best reward for a reply that reports a repro is 0.8334 and pass@k is 0 by construction. Read reply-eval pass@k as meaningless until the rubric changes, for example by giving the judge the trial's evidence or by no longer penalising repro statements.

## Budget cap and queue order (triage)

[Numbers from triage-baseline-20261016 (bank e565453, eval-slang-triage on Opus 5.5)](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md): a triage trial costs about $1.49 and takes a median of about 3.5 min. `--budget-usd 60` stopped dispatch after about 47 trials. 60 tasks × 3 repeats need about $270.

The runner counts each session's cost at score time, but sessions keep spending after they write answer.json (wrap-up, append_learning). The final spend was $69.96 against the $60 cap, about 17% over. Set the cap about 20% under the real hard limit.

The queue runs r1 for every task first. A budget-stopped job therefore has one repeat per task. Its pass@k is pass@1, and it cannot be compared with a full 3-repeat job. Fixer trials cost much more per trial, and `ncl cost-cap status` under-reads spend after a restart; see the fixer page under Related.

## Contradictions / supersessions

- [The earlier Feature → fix note](../learnings/1792156489640-triage-eval-feature-issues-fixed-after-maintainer-.md) advised checking the issue timeline and the linked PR's merge state "to recover the ground truth". [The same author's correction](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md) replaces that advice: in an eval trial those signals are the answer key. The Feature → fix mapping survives, applied from the discussion. The older note stays cited only for the eval-label-list fact (`Dev Opened`), which the correction does not restate.
- [The stale-answer note](../learnings/1792164298690-eval-runner-a-second-triage-job-scores-the-first-j.md) gives "move `eval/` aside" as the pre-flight fix. [The triage-rules-20261018 note](../learnings/1792310997428-eval-runner-clearing-eval-is-not-enough-eval-copy-.md) refines it: that fix stops the runner scoring stale files, but the trials still read the earlier answers from memos, task logs and moved-aside dirs. Both stay cited.

**Source learnings (17):**
- [ncl tasks create --group is ignored inside a container; eval trials dispatch to the driver group](../learnings/1792151064652-eval-runner-ncl-tasks-create-group-is-ignored-insi.md)
- [don't query the target issue itself; it leaks the ground-truth labels](../learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md)
- [answer.json must hold exactly 4 keys; live issue view leaks labels; sparse-clone research path](../learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md)
- [shared-wiki recall and gh issue view can leak the graded outcome; reproduce and decide first](../learnings/1792153490112-eval-triage-shared-wiki-recall-and-gh-issue-view-c.md)
- [internal labels such as Dev Opened are not in the eval label list (timeline advice corrected)](../learnings/1792156489640-triage-eval-feature-issues-fixed-after-maintainer-.md)
- [correction: do not read live labels, timeline or linked-PR state; Feature approved for implementation is fix](../learnings/1792156519180-correction-in-eval-triage-trials-do-not-read-the-l.md)
- [gh issue view leaks the scored answer; classify from prompt, source and a release-build repro first](../learnings/1792156580321-eval-triage-gh-issue-view-leaks-the-scored-answer.md)
- [triage cap overshoot, r1-first queue, answer-key leak via live labels and shared learnings](../learnings/1792159750753-eval-runner-triage-cap-overshoot-r1-first-queue-an.md)
- [a second triage job scores the first job's stale answer.json; first-parseable-answer race](../learnings/1792164298690-eval-runner-a-second-triage-job-scores-the-first-j.md)
- [re-dispatch of the same trial id finds the earlier answer in memory; recreate the eval dir](../learnings/1792305223352-eval-re-dispatch-of-the-same-trial-id-finds-the-ea.md)
- [triage reruns are contaminated by shared-wiki outcomes and eval memos](../learnings/1792306086806-eval-triage-reruns-are-contaminated-by-shared-wiki.md)
- [working-dir triage.json is shared by all trials](../learnings/1792306470926-eval-triage-triage-json-in-the-working-dir-is-shar.md)
- [/workspace/agent/triage.json is left over from the previous trial](../learnings/1792306556116-eval-triage-workspace-agent-triage-json-is-left-ov.md)
- [tell repro subagents not to read the issue or PR, not only not to write](../learnings/1792306934765-eval-triage-tell-repro-subagents-not-to-read-the-i.md)
- [working-dir triage.json can hold another task's stale answer; gh api contents instead of a clone](../learnings/1792307204780-eval-triage-working-dir-triage-json-can-hold-anoth.md)
- [clearing eval/ is not enough; eval-copy memos carry the last job's answers; first-draft delta; restart overwrites traces](../learnings/1792310997428-eval-runner-clearing-eval-is-not-enough-eval-copy-.md)
- [reply-eval LLM judge marks every "I reproduced this" as dishonest; reply.json leak](../learnings/1792326383997-reply-eval-llm-judge-marks-every-i-reproduced-this.md)

_Catalog: [[wiki/index.md]]_
