---
name: eval-runner
license: MIT
type: capability
description: "Run an evaluation job: dispatch tasks from the slang-eval-tasks bank to an eval copy of a coworker (eval-slang-triage, eval-slang-fixer) as repeated one-shot NanoClaw tasks, wait for the answers on the read-only group mount or for draft PRs on the slang-eval fork, score them with the bank's verifiers or the fork's CI, keep the spend under a cap, and deliver the scorecard. Compares a variant against a baseline job with a paired bootstrap interval. Reads production; writes only under /workspace/agent/reports/evals/."
allowed-tools: Bash(python3:*), Bash(ncl:*), Bash(gh api:*), Bash(git clone:*), Bash(git -C:*), Bash(ls:*), Bash(cat:*), Bash(date:*), Read, Write, mcp__nanoclaw__send_file, mcp__nanoclaw__send_message
---

# /eval-runner — run and score an evaluation job

You run in the `eval-compliance` group (`cli_scope: global`, read-only mount of every group
directory at `/workspace/extra/ephemeral/prod-groups/<folder>`). You are the driver: you
never solve a task yourself, you never touch `shader-slang/*`, and the only files you write
are under `/workspace/agent/reports/evals/`. The eval copies do the work; the runner scores it.

## Before a job

1. **Check out the bank.** `git clone https://github.com/slang-coworkers/slang-eval-tasks
/workspace/agent/eval-bank` (or `git -C /workspace/agent/eval-bank pull`). Its
   `MANIFEST.json` is the task list the runner reads; note the bank commit
   (`git -C /workspace/agent/eval-bank rev-parse HEAD`) for the delivery message.
2. **Confirm the eval group is an eval copy.** `ncl groups config get --id <eval group> --json`
   must show the group you expect, and `/workspace/extra/ephemeral/prod-groups/<folder>/.overlay-eval-sandbox`
   must exist. Without that marker the group is not sandboxed: stop and report, do not dispatch.
3. **Preview.** Run the command below with `--dry-run` and read the trial list and the
   `ncl tasks create` invocation it prints. The trial count is tasks × repeats.

## Start a job

```bash
python3 /home/node/.claude/skills/eval-runner/scripts/eval_run.py \
    --bank /workspace/agent/eval-bank --kind triage --group eval-slang-triage \
    --variant baseline --limit 60 --budget-usd 300 --concurrency 2
```

- `--kind triage` scores with the bank's `tests/test.sh` (`AGENT_OUTPUT`, `REWARD_DIR`).
  `--kind fixer` scores from the fork's CI check runs for each draft PR; the bank's fixer
  verifier needs a Slang Release build that this container does not have.
- `--repeats` defaults to 3 for triage and 2 for fixer. Every repeat is an independent
  one-shot task with its own session and answer directory; never set it to 1 for a job
  whose numbers you intend to compare.
- `--variant <label>` names what is under test (a prompt, a skill version). Use `baseline`
  for the reference job and a short slug for the change.
- The budget counts every repeat. The runner stops dispatching, marks the remaining trials
  `skipped` and exits 2 when the cap would be passed; a stopped job is reported as stopped,
  not as a score.
- The job runs for hours. Run it in the foreground of one turn when the trial count is
  small; otherwise schedule it as a one-shot task of this group with `ncl tasks create
--process-after <now>` whose prompt is this skill with the arguments, so the run has a
  session of its own.

## Compare a variant to a baseline

Run the variant job with `--compare <baseline job id>`. The report pairs each task (mean over
repeats on both sides), gives the mean paired difference with a bootstrap 95% interval, and
marks the comparison `smoke-signal` when fewer than 30 tasks were paired. Report the interval,
not just the sign: a difference whose interval contains zero is "no measurable change". Tasks
flagged `low-signal` (their repeats disagree) are listed; do not cite one of them as evidence.

## Retry

A trial that timed out, errored or stayed unknown is retried at most once:
`--retry-from <job id>` re-dispatches exactly those trials as attempt 2 and refuses any trial
already on attempt 2. Never re-run a trial that was scored, whatever its reward, and never
retry a job a second time.

## Deliver

Send `/workspace/agent/reports/evals/<job id>/scorecard.html` with `mcp__nanoclaw__send_file`
to the task's destination, with one paragraph: the job id, kind, variant, tasks × repeats,
scored / unknown / timeout / error counts, mean reward and pass@k, cost in USD and which cost
signal produced it (`ncl cost-cap status` or the per-trial fallback estimate), the resolved
model id (or "unresolved" and the alias), and for a comparison the paired delta with its
interval and the smoke-signal flag. Say plainly when the job stopped for budget or when fixer
trials are unknown because the fork's CI reported nothing.

## Where things are

| Path                                                                                | What                                                                               |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/workspace/agent/reports/evals/latest.json`                                        | the last job's summary, read by `nanoclaw-metrics.py` as `nanoclaw_evals`          |
| `/workspace/agent/reports/evals/<job id>/job.json`                                  | summary + per-task results + per-trial results + comparison + frozen settings      |
| `/workspace/agent/reports/evals/<job id>/trials.jsonl`                              | one line per trial; the input `--compare` and `--retry-from` read                  |
| `/workspace/agent/reports/evals/<job id>/scorecard.html`                            | the page to deliver                                                                |
| `/workspace/agent/reports/evals/<job id>/trials/<trial>/`                           | Harbor-style trial directory (`config.json`, `result.json`, `verifier/reward.txt`) |
| `/workspace/extra/ephemeral/prod-groups/<eval folder>/eval/<task>/r<k>/answer.json` | a triage answer, written by the eval copy, read by the runner                      |

Flags, the verifier contract, the budget model and the report schema are in
[README.md](./README.md).

## Do not

- Do not run `gh` with any verb other than `api` GET; the runner's own `gh` calls pin
  `--method GET`. Do not open, comment on or label anything on the fork or on production.
- Do not create tasks on any group other than the eval groups, and do not create recurring
  tasks: every dispatch is a one-shot with `--process-after`.
- Do not write into an eval group's directory; the mount is read-only and the answers are
  the eval copy's to write.
- Do not quote a single trial as a result, and do not compare two jobs with different
  repeat counts or different model ids without saying so.
