# ops/ — the observability stack that was not in git

These three files run the prod metrics pipeline. Until 2026-08-11 **none of them
was version-controlled** — they existed only on the prod box, at
`/usr/local/bin/` and `/var/lib/grafana/dashboards/`. That is how the defect
described below survived eight days without anyone noticing.

| File | Deployed to | Owner |
|---|---|---|
| `metrics/nanoclaw-metrics.py` | `/usr/local/bin/nanoclaw-metrics.py` | root, run as `telegraf` |
| `metrics/nanoclaw-metrics.service` | `/etc/systemd/system/` | systemd, `Type=oneshot`, every 60s |
| `grafana/nanoclaw-coworkers.json` | `/var/lib/grafana/dashboards/` | provisioned, `updateIntervalSeconds: 30` |

## The stack

```
nanoclaw-metrics.py  --(line protocol on stdout)-->  nanoclaw-metrics-push.sh
                                                              |
                                              InfluxDB 1.x  db=lp  :8086
                                                              |
                                     Grafana 13.1.0  :13000  under /metrics
```

Two things about this are easy to get wrong and cost real time:

- **The InfluxDB database is `lp`, not `nanoclaw`.** Querying `db=nanoclaw`
  returns `0` rows for every measurement rather than an error, which reads
  exactly like "the collector is not running".
- **Grafana serves under the `/metrics` sub-path** (`serve_from_sub_path = true`,
  `root_url = https://grafana-<box>.brevlab.com/metrics/`). `/api/...` returns
  the HTML app shell; `/metrics/api/...` returns JSON.

## Editing the dashboard

Edit **this file** and copy it to `/var/lib/grafana/dashboards/`. The provisioner
picks it up within 30s.

Do **not** edit in the Grafana UI: provisioned dashboards report
`meta.canSave: false`, and an anonymous `POST /api/dashboards/db` returns 403.
That is deliberate — the file is the source of truth.

## Why floats matter in the collector

`collect_funnel()` used to accept only `int`:

```python
if isinstance(v2, int) and not isinstance(v2, bool):   # floats silently dropped
```

`issuePartition.winRate` is a float. The moment it stopped being a whole number
the field simply stopped being written — and because InfluxDB's `last()` returns
the most recent point *however old*, the final value (`0`, written
**2026-08-03T13:09Z**) kept rendering as the current win rate until
**2026-08-11**. Nothing went red. The real value throughout was ~0.52.

That is the failure mode this directory exists to prevent, and it is why:

- the collector emits `heartbeat_unixtime` every run, and
- every dashboard panel sets `noValue: "no data"`, and
- timeseries panels use `fill(none)` so a collection gap renders as a **break in
  the line**, never as a plausible zero.

**A metric that stops being collected must look different from a metric that is
genuinely zero.** If you add a panel, keep that property.

## Field naming honesty

`silent_beyond_warn` counts running sessions whose `last_active` is older than
`CEILING_SEC - CEILING_WARN_SEC` (9000s). It is named for **silence**, not
container age. On prod `max_silence_sec` reads ~59800s against a 10800s
container ceiling, so `sessions.last_active` demonstrably does not track the
container heartbeat that `container-runner.ts` kills on. A name implying
otherwise would assert a relationship the data does not support.

## Wire-mix (per-coworker model tier)

The **Wire-mix — model tier per coworker** dashboard row shows, per coworker,
which model tier it is configured on so tiering drift is obvious at a glance
(e.g. discord/babysitter/regression on sonnet, orchestrator on opus).

Source of truth is `container_configs` in `v2.db` — the value
`ncl groups config update --model` writes, which is materialized to
`groups/<folder>/container.json` and passed to the SDK as the query model. The
collector reads it read-only and tags each `nanoclaw_group` point with
`provider`, `model` (raw id), and `tier` (coarse: `opus`/`sonnet`/`haiku`/
`other`, or `default` when the model is unset), plus a small per-tier rollup
measurement `nanoclaw_tier` (`events`, `coworkers`, `running`) for the share
bars.

Two honesty caveats, same spirit as the rest of this file:

- **`tier=default` is not a guess.** An unset model means the group inherits
  the host/provider default; the panel says `default` rather than asserting a
  specific tier the config never stated.
- **"Activity" is not cost.** The share is weighted by the 5m rolling
  hook-event count (`events`) — a turn/work proxy, not billed dollars. Per-turn
  `costUsd` exists only in the ephemeral per-session container logs
  (`groups/<folder>/logs/container-*.log`, `Usage:` lines) and those lines
  carry no model, so a true cost-by-model split is not derivable from any
  collector-readable source today. If that changes, wire it in rather than
  approximating dollars from turns.

## Host health + alerts (added 2026-09-28 after the 09-26 outage)

The collector now also emits **`nanoclaw_host`** (one point per run) and
**`nanoclaw_host_mailbox`** (largest session DB, tagged by session). Fields:
`host_up`, `host_uptime_s`, `host_restart`, `host_restarts_total`, `breaker_attempt`,
`sweep_tick_ms` / `sweep_tick_ms_max` / `sweep_full_passes` / `sweep_quiet_skips` / `sweep_ticks`,
`spawns`, `wakes`, `wake_failed`, `quarantined`, `stale_restarts`, `fatal`, `heap_oom`,
`inbox_pending` / `inbox_done` / `inbox_failed` / `inbox_parked` / `inbox_replays` / `inbox_parked_events`,
`mailbox_bytes_total` / `mailbox_bytes_max` / `mailbox_files` / `mailbox_over_500mb`.
Log-derived counters are per collector run (60 s); the collector keeps its own log offsets
(`host_log_off`, `host_errlog_off`) so they do not interfere with `collect_logs`.
Set `NANOCLAW_DIR` to point the collector at another install (tests, lego).

The dashboard gained a row **"Incident signals"** (last row) and an alert-list panel.

| File | Deployed to | Notes |
|---|---|---|
| `grafana/alerting/nanoclaw-alerts.yaml` | `/etc/grafana/provisioning/alerting/` | 11 rules in folder *NanoClaw* (host down, crash loop, restarts, sweep slow / stalled, wake failures, quarantine, webhook port, inbox parked, mailbox > 1 GB, collector stale) + contact point `nanoclaw-ops` (Slack) + policy on `team=nanoclaw`. Read at Grafana start: `sudo systemctl restart grafana-server`. |

The Slack destination is the environment variable **`NANOCLAW_ALERT_SLACK_WEBHOOK`** for the
grafana-server process (`/etc/default/grafana-server`). Until it is set the rules still evaluate
and show as Firing on the dashboard and under Alerting → Alert rules; nothing is sent.

Why these thresholds: every rule maps to a symptom in
`reports/prod-outage-2026-09-26-postmortem.html` — a young/absent host pid and a climbing breaker
attempt (the 66-crash loop), a 19 s sweep tick with 40–60 s gaps (the frozen event loop),
hundreds of wake failures with zero spawns (no new work), port 3841 closed for 15.9 h (321 GitHub
deliveries lost), a 2.6 GB session DB (the root cause's fuel).
