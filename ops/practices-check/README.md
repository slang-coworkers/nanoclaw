# ops/practices-check — read-only audit of fleet operating practices

`practices_check.py` inspects the data the host already keeps and reports where the
fleet has drifted from its operating rules. It costs no agent tokens, opens every
source read-only, and never repairs anything. Its only output is a report under
`data/shared/practices-check/`, which `ops/metrics/nanoclaw-metrics.py` re-emits as
the `nanoclaw_practices` measurement so Grafana can alert on it.

| File | Deployed to | Runs as |
|---|---|---|
| `practices_check.py` | `/usr/local/bin/practices_check.py` | `ubuntu` (owner of the data tree) |
| `nanoclaw-practices-check.service` | `/etc/systemd/system/` | systemd, `Type=oneshot` |
| `nanoclaw-practices-check.timer` | `/etc/systemd/system/` | hourly, randomized by up to 5 min |

## Checks

Each check ends in exactly one of three states. `OK` means it ran and found nothing;
`DRIFT` means it ran and found something; `UNKNOWN` means it could not run, and the
report says why. UNKNOWN is never a pass: a report with any UNKNOWN check has
`complete: false` and the run exits 2.

| Check | What it reports | Threshold env | Default |
|---|---|---|---|
| `instruction-bloat` | `groups/<folder>/CLAUDE.local.md` or composed `CLAUDE.md` over the byte limit, for unpaused groups (symlinked group dirs are followed) | `PRACTICES_LOCAL_MD_MAX_BYTES`, `PRACTICES_CLAUDE_MD_MAX_BYTES` | 20000, 60000 |
| `untyped-groups` | unpaused, non-admin `agent_groups` rows whose `coworker_type` is NULL, empty or `default` | — | — |
| `duplicate-names` | a display name shared by more than one unpaused group | — | — |
| `per-issue-series` | a live recurring task whose name or prompt targets exactly one issue/PR (the same rule the host applies at creation in `src/modules/scheduling/create.ts`) | — | — |
| `ungated-series` | a live recurring task firing more often than the limit per day with no pre-task script gate | `PRACTICES_MAX_DAILY_FIRES` | 4 |
| `failing-series` | a live series with that many consecutive failed runs, or one the host auto-paused after 8 consecutive script failures | `PRACTICES_FAIL_STREAK` | 3 |
| `disk-pressure` | free space on the volume `groups/` resolves to, below the minimum | `PRACTICES_DISK_FREE_MIN_PCT` | 25 |
| `skill-noise` | `Shared skill not symlinked` warnings in the last hour, above the limit | `PRACTICES_SKILL_NOISE_MAX_PER_HOUR` | 20 |
| `compaction-storms` | `CLAUDE.md stale` container restarts per group in the last 24 hours, above the limit | `PRACTICES_COMPACTION_MAX_PER_DAY` | 5 |
| `branch-drift` | commits on the checked-out branch not contained in `origin/nv-main`, `origin/nv-slang` or `origin/nv-slangpy`; informational, counted from local refs, never fetches | — | — |

Scheduled tasks are `messages_in` rows with `kind='task'` in each session's
`data/v2-sessions/<agent_group_id>/<session_id>/inbound.db`. A series is live when
it has a `pending` or `paused` row; its history is the `completed`/`failed` rows that
share its `series_id`. Paused groups are skipped by every group-scoped check because
the host will not spawn for them.

The host logger stamps lines with local time of day only, so the log checks recover
a window by walking the tail backwards and treating a stamp later than the one after
it as a midnight boundary, anchored on the file's mtime. Both `logs/nanoclaw.log`
and `logs/nanoclaw.error.log` are scanned (the two messages are logged at WARN, which
the host routes to the error log), plus their `.1` rotated predecessors.

## Output

`PRACTICES_CHECK_OUT` (default `<NANOCLAW_DIR>/data/shared/practices-check/`) holds:

- `latest.json` — the full report: per-check state, findings with group/series ids,
  measured value and threshold, the thresholds in force, and `counts.perCheck`.
- `latest.md` — the same, as a short table plus details.
- `history.log` — one line per run: timestamp, status, finding and unknown counts, exit code.

Exit codes: `0` clean, `1` findings, `2` indeterminate (or the report could not be written).

## Run it on the prod host

```bash
NANOCLAW_DIR=/home/ubuntu/slang-coworkers-prod/nanoclaw \
  python3 /home/ubuntu/slang-coworkers-prod/nanoclaw/ops/practices-check/practices_check.py
```

Add `--no-report` to print without touching `data/shared/practices-check/`, or
`--out <dir>` to write somewhere else.

## Install the timer

```bash
cd /home/ubuntu/slang-coworkers-prod/nanoclaw
sudo install -m 0755 ops/practices-check/practices_check.py /usr/local/bin/practices_check.py
sudo install -m 0644 ops/practices-check/nanoclaw-practices-check.service /etc/systemd/system/
sudo install -m 0644 ops/practices-check/nanoclaw-practices-check.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nanoclaw-practices-check.timer
sudo systemctl start nanoclaw-practices-check.service   # first run now, not at the next hour
systemctl list-timers nanoclaw-practices-check.timer
journalctl -u nanoclaw-practices-check.service -n 30
```

Override a threshold by writing it to `/etc/nanoclaw-practices-check.env`
(`PRACTICES_MAX_DAILY_FIRES=6`); the unit reads that file when it exists.

Then redeploy the metrics collector so the `nanoclaw_practices` measurement starts
flowing: `sudo install -m 0755 ops/metrics/nanoclaw-metrics.py /usr/local/bin/nanoclaw-metrics.py`.
Alert on `findings > 0`, on `unknown > 0`, and on `age_sec > 7200` (the timer has
stopped producing reports).

## Tests

```bash
python3 -m pytest ops/practices-check -q
python3 -m unittest discover -s ops/practices-check -p 'test_*.py'
```

The suite builds its fixtures (v2.db, session mailboxes, group dirs, logs, a git
repo) in a temporary directory and never reads a production path.
