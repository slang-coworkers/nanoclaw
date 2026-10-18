# eval-runner — dispatch, wait, score, report

`scripts/eval_run.py` runs one evaluation job: it takes tasks from the
[slang-eval-tasks](https://github.com/slang-coworkers/slang-eval-tasks) bank, hands each to
an eval copy of a coworker as repeated one-shot NanoClaw tasks, waits for the results, scores
them, keeps the spend under a cap and writes a report. It runs inside the `eval-compliance`
coworker's container; [SKILL.md](./SKILL.md) is the agent's procedure.
`ops/metrics/nanoclaw-metrics.py` reads `latest.json` from the group directory and re-emits
it as `nanoclaw_evals`.

## Pieces

| Step          | Mechanism                                                                                                                                                                                                                                                                                      | Needs                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| select        | `MANIFEST.json` at the bank root: rows `{task_id, kind, path, base_commit, issue, repo, size}`; without a manifest the bank is walked for `instruction.md` + `task.toml` directories                                                                                                           | a checkout of the bank                                                                                 |
| dispatch      | `ncl tasks create --group <eval group> --name eval-<kind>-<task>-r<k> --process-after <ISO now> --prompt <instruction + contract> --json`; the reply's `data.session_id` is the eval session                                                                                                   | the driver group has `cli_scope: global` (the CLI guard refuses `--group <other>` under `group` scope) |
| wait, triage  | `<prod-groups>/<eval folder>/eval/<task>/r<k>/answer.json` on the read-only mount of the eval group's directory                                                                                                                                                                                | the mount `/workspace/extra/ephemeral/prod-groups/<folder>`                                            |
| wait, fixer   | `gh api --method GET repos/<fork>/pulls?state=all`: a PR whose head branch contains `<task>-r<k>` or whose title contains `[<task>#r<k>]`                                                                                                                                                      | a token that can read the fork                                                                         |
| score, triage / reply | the bank's `tests/test.sh` with `AGENT_OUTPUT=<answer.json>` and `REWARD_DIR=<trial>/verifier/`; the verifier writes `reward.txt` in [0,1] and exits 0                                                                                                                                         | bash, python3                                                                                          |
| score, fixer  | `gh api --method GET repos/<fork>/commits/<sha>/check-runs`, only the run named by `--ci-check` (default `eval-ci`, the fork's own workflow; `''` counts every run and the commit statuses): success → 1, red → 0, still running → wait, none after the grace period → unknown                                                                                                                             | the fork's CI is the verifier (the bank's fixer verifier needs a Slang Release build)                  |
| budget        | `ncl cost-cap status --session <id> --json` → `spent_usd`; a session without a cost row counts at the per-trial fallback estimate                                                                                                                                                              | `cost-cap` is an elevated resource: only a `cli_scope: global` caller can run it                       |
| freeze        | `ncl groups config get --id <eval group> --json` (provider, effort, image tag, model) + the forwarded `ANTHROPIC_MODEL` / `ANTHROPIC_DEFAULT_*_MODEL` env; the `github-ref` / `github-tree-sha` stamps of every skill under `/home/node/.claude/skills`; the manifest's `base_commit` per task |                                                                                                        |

## Repeats and statistics

Every task runs `--repeats` times (default 3 triage, 2 fixer). A trial is `<task-id>#r<k>`,
dispatched as its own one-shot task so the eval copy gets a fresh session and never sees an
earlier attempt; its answer directory is `eval/<task-id>/r<k>/` and its fixer branch tag is
`<task-id>-r<k>`. The queue interleaves repeats (r1 of every task, then r2, ...) so a budget
stop leaves every task with a comparable number of repeats.

Per task: `mean` over scored repeats, `pass_at_k` (1 when any repeat scored 1), `min`, `max`,
`stdev`, and `low_signal` when the scored repeats disagree. The job's `mean_reward` is the
mean of the task means; `pass_at_k` is the mean of the per-task pass@k.

`--compare <job>` pairs each task present and scored in both jobs: `delta = variant mean -
baseline mean`. The report gives `paired_delta_mean`, a percentile bootstrap 95% interval over
tasks (`random.Random(20261016)`, 2000 resamples), `significant` when the interval excludes
zero, win/loss/tie counts, the low-signal tasks, and `smoke_signal: true` when fewer than 30
tasks were paired.

## Budget

`Budget.can_dispatch()` refuses the next trial when `committed + fallback > cap`, where
`committed` is the sum of known session costs plus the fallback estimate for every session
whose cost is unknown. With the cost signal present the cap is enforced in dollars; without it
(`cost-cap status` denied or no cost rows yet) the cap degrades to `floor(cap / fallback)`
trials: 200 triage trials or 15 fixer trials for a 300 USD cap at the default estimates.
The summary says which (`cost_signal`). Costs are re-read when a trial finishes and once more
at the end of the job, so `cost_usd` is the latest reading, not the dispatch-time one.

## Verifier contract (triage)

From the bank's README: `AGENT_OUTPUT` is the answer (`{subsystem, severity, next_step,
labels}`), `REWARD_DIR` receives `reward.txt` and `summary.json`, the script exits 0 whatever
the score. The runner also sets `REWARD_PATH`, `TASK_DIR` and `TASK_ID` for verifiers that
want them. A verifier that writes no reward and prints no number leaves the trial `unknown`.
An answer of the form `{"error": "..."}` is an `error` trial with reward 0 (the eval copy
could not do the task; it is not a timeout).

## Report schema

`latest.json` and the head of `job.json` (schema 2):

```
job_id, kind, variant, group, fork, bank, repeats, started_at, finished_at, duration_sec,
tasks, trials, dispatched, scored, unknown, timeouts, errors, skipped,
mean_reward, trial_mean_reward, pass_at_k, pass_rate, low_signal_tasks,
cost_usd, cost_known_sessions, cost_signal, cost_committed_usd, budget_usd, stopped_for_budget,
concurrency, compare, retry_from, compare_result (without rows), frozen {group, skills, bank},
status: complete | partial | stopped
```

`job.json` adds `task_results` (per task), `trial_results` (per trial) and `compare` (with
rows). `trials.jsonl` is one trial per line and is what `--compare` and `--retry-from` read.
Each trial also has a Harbor-style directory `trials/<task>#r<k>__<attempt>-<hex>/` with
`config.json` (task, hidden metadata, base commit, frozen agent settings), `result.json`
(status, reward, session, PR) and `verifier/reward.txt`; `config.json` and `result.json` at
the job root describe the job the same way.

## Exit codes

`0` every trial scored; `1` some trial timed out, errored or is unknown; `2` the job stopped
for budget, or no task was selected, or the eval group's directory is not mounted, or a
planned triage answer path already held a file before dispatch (the job did not start).

## Tests

`python3 -m unittest discover -s container/skills/eval-runner/scripts -p 'test_*.py'` runs
on fakes only: a recording dispatcher, a dict-backed cost reader, canned `gh` JSON, a real
`tests/test.sh` written into a temporary bank, and a fake clock. CI runs the same command.
