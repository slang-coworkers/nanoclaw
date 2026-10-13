# Scheduled Tasks

Scheduled tasks run an agent prompt at a future time or on a recurring cron
schedule. Each task belongs to an agent group and runs in its own system
session, separate from normal chat sessions.

Run `ncl tasks create --help` for the complete and current CLI reference.

## Create a recurring task

From the host, pass the agent group that should own the task:

```bash
ncl tasks create \
  --group <agent-group-id> \
  --name "weekday briefing" \
  --recurrence "0 9 * * 1-5" \
  --prompt "Prepare the weekday briefing and send it to telegram"
```

The first run is calculated from the cron schedule. Cron expressions use the
NanoClaw installation timezone.

Inside an agent container, `--group` is filled in automatically with that
agent's group.

## Create a one-time task

One-time tasks use `--process-after` instead of `--recurrence`:

```bash
ncl tasks create \
  --group <agent-group-id> \
  --name "call reminder" \
  --process-after "2026-07-14T18:00:00+03:00" \
  --prompt "Remind me to call Dana"
```

`--process-after` accepts an ISO 8601 timestamp or a local time interpreted in
the installation timezone.

## Delivery and run logs

A scheduled task has no chat attached to it. If its result should reach a
user, the prompt must tell the agent where to send it. Use a destination name
available to that agent, such as `telegram` or `team-slack`.

Each agent run appends its final text to the series run log. View run counts,
failures, and recent log entries with:

```bash
ncl tasks get <task-id> --group <agent-group-id>
```

`completed_runs` counts every successful fire; `gated_runs` are the fires a
script gate answered `wakeAgent: false` (no model call) and `woke_runs` the
rest. A gated series whose `woke_runs` approaches `completed_runs` has a gate
that is not gating.

## Manage and test tasks

```bash
ncl tasks list --group <agent-group-id>
ncl tasks update <task-id> --group <agent-group-id> --prompt "New prompt"
ncl tasks pause <task-id> --group <agent-group-id>
ncl tasks resume <task-id> --group <agent-group-id>
ncl tasks cancel <task-id> --group <agent-group-id>
ncl tasks delete <task-id> --group <agent-group-id>
```

`cancel` stops the live task but keeps its history. `delete` permanently removes
the whole task series and its history.

To test a task immediately without changing its schedule:

```bash
ncl tasks run <task-id> --group <agent-group-id>
```

`run` also works while a task is paused. It queues one extra run and does not
resume the recurring schedule.

## Script gates

A task can run a Bash script before waking the agent. This is useful for
frequent checks where most runs have nothing for the agent to do.

The script's last line of standard output must be JSON:

```json
{ "wakeAgent": false }
```

or:

```json
{ "wakeAgent": true, "data": { "alerts": 2 } }
```

- `wakeAgent: false` completes the run without calling the model and marks the
  occurrence gated (`gated_runs` in `ncl tasks get`).
- `wakeAgent: true` wakes the agent and adds `data` to its prompt.

Scripts run with Bash, a 30-second timeout, and a 1 MB output limit. Keep
`data` small and include only what the agent needs.

For example, save this as `check-marker.sh`:

```bash
marker=/workspace/agent/wake-next-task

if [ -f "$marker" ]; then
  rm -f "$marker"
  echo '{"wakeAgent": true, "data": {"reason": "marker found"}}'
else
  echo '{"wakeAgent": false}'
fi
```

Test it before scheduling, then pass its contents to `ncl`:

```bash
bash check-marker.sh

ncl tasks create \
  --group <agent-group-id> \
  --name "marker check" \
  --recurrence "*/15 * * * *" \
  --prompt "Handle the condition reported by the script" \
  --script "$(cat check-marker.sh)"
```

Store state that must survive between runs under `/workspace/agent`, the agent
group workspace. Keep secrets out of scripts; the credential gateway injects
them at runtime.

A script created from inside a container may be at most 8 KB: the text is
copied into every occurrence row of the series. Put a larger program in a file
under `/workspace/agent/` and make the script `exec` it.

## Frequency limit

An ungated recurring task that would fire more than four times in the next 24
hours is rejected. A task with a script gate is allowed to run more often
because `wakeAgent: false` uses no model tokens.

For an intentionally frequent task that has no script, see the explicit
override in `ncl tasks create --help` and confirm the token and quota cost
before using it.

Agent callers are also refused a `--recurrence` that targets a single issue or
PR (a name such as `i13435-gate`, or a prompt naming exactly one `#NNNN`): the
webhooks already deliver that issue's events, and a per-issue cron never
self-cancels. Use `--process-after` for a one-time re-check.

## Script failures

A timeout, nonzero exit, missing decision, or invalid JSON counts as a failed
run. Consecutive failures delay the next recurring run by 2, 4, 8, 16, 32,
then 60 minutes. Further failures stay at the 60-minute delay.

After eight consecutive failures, NanoClaw pauses the series and writes the
reason to its run log. Fix the script, test it, then resume the task:

```bash
ncl tasks resume <task-id> --group <agent-group-id>
```

A valid `wakeAgent: false` decision is a successful run. It does not trigger
failure backoff.

## Snapshot and drift check

Task definitions live only in per-session `inbound.db` rows, so
`scripts/dump-scheduled-tasks.py` exports them to
`docs/scheduled-tasks.<instance>.json` plus a Markdown mirror. Definitions only —
runtime state is excluded, so a `git diff` on the file is the drift alarm. Tasks
whose group is paused or deleted are kept but marked `group_paused` /
`group_missing`; they are not live.

Regenerate and commit after editing any task, and run both from the host
crontab daily so drift surfaces within a day:

```cron
# ~/slang-coworkers-prod/nanoclaw — re-dump, then fail loudly on drift or a torn pair
20 6 * * * cd ~/slang-coworkers-prod/nanoclaw && python3 scripts/dump-scheduled-tasks.py --md docs/scheduled-tasks.slang-coworkers-prod.md && git diff --quiet -- docs/scheduled-tasks.*.json || echo "scheduled-task snapshot drifted: review and commit docs/scheduled-tasks.*"
25 6 * * * cd ~/slang-coworkers-prod/nanoclaw && bash scripts/check-task-snapshots.sh
```

`--check` (what `check-task-snapshots.sh` runs, also in CI) verifies the
committed JSON/Markdown pair against its own `snapshot_id` without touching the
host; it catches a torn or hand-edited pair, not drift from the live rows — the
re-dump above does that.

## Template tasks

Agent templates can include recurring tasks and optional script gates. Template
tasks are created paused so installing a template never starts background work
without approval. See [Agent Templates](templates.md#recurring-tasks).

For implementation details, see
[Pre-Agent Scripts](agent-runner-details.md#pre-agent-scripts-tasks).
