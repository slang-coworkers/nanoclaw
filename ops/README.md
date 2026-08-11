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
