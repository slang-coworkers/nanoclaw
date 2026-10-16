#!/usr/bin/env python3
"""Static checks for ops/grafana/nanoclaw-coworkers.json that Grafana only reports at render time.

- every panel's queries use distinct refIds: Grafana rejects the WHOLE panel request with
  400 "query.duplicateRefId" otherwise, and the panel silently shows 0 / no data
  (the "Fleet cost today over time" panel shipped this way, found 2026-09-29).
- every influx query targets the provisioned datasource uid.
- no dashboard query or alert rule (alerting/nanoclaw-alerts.yaml) reads a BOOLEAN field. Grafana's
  alerting expressions cannot reduce or threshold a boolean, so such a rule sits in NoData forever and
  never fires ("host down" on host_up, found 2026-10-16). Read the integer twin (host_up_n) instead.
Run: python3 ops/grafana/check_dashboard.py  (exit 1 on any problem)
"""
from __future__ import annotations

import json
import os
import re
import sys

DS_UID = "PF3A0F3054C0DA367"
# Fields ops/metrics/nanoclaw-metrics.py emits as booleans, mapped to their integer twin. InfluxDB fixes
# a field's type per shard, so these cannot simply be turned into integers.
BOOLEAN_FIELDS = {"host_up": "host_up_n"}
# Quoted or bare identifier (InfluxQL accepts both); host_up_n does not match.
_BOOL_RE = re.compile(r"(?<![A-Za-z0-9_])(" + "|".join(map(re.escape, BOOLEAN_FIELDS)) + r")(?![A-Za-z0-9_])")
here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, "nanoclaw-coworkers.json")
alerts_path = os.path.join(here, "alerting", "nanoclaw-alerts.yaml")
with open(path) as fh:
    d = json.load(fh)

def flat(panels):
    for p in panels:
        yield p
        yield from flat(p.get("panels") or [])

problems = []
for p in flat(d["panels"]):
    targets = p.get("targets") or []
    ids = [t.get("refId") for t in targets]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        problems.append(f"{p.get('title')!r}: duplicate refId(s) {dup}")
    for t in targets:
        ds = (t.get("datasource") or p.get("datasource") or {}).get("uid")
        if t.get("query") and ds not in (DS_UID, "-- Grafana --", None):
            problems.append(f"{p.get('title')!r}: query on unexpected datasource uid {ds!r}")
        m = _BOOL_RE.search(t.get("query") or "")
        if m:
            problems.append(f"{p.get('title')!r}: queries boolean field {m.group(1)!r}; "
                            f"use {BOOLEAN_FIELDS[m.group(1)]!r}")
with open(alerts_path) as fh:
    for n, line in enumerate(fh, 1):
        m = None if line.lstrip().startswith("#") else _BOOL_RE.search(line)
        if m:
            problems.append(f"nanoclaw-alerts.yaml:{n}: rule queries boolean field {m.group(1)!r} "
                            f"(alert expressions cannot reduce it: NoData forever); "
                            f"use {BOOLEAN_FIELDS[m.group(1)]!r}")
for x in problems:
    print("FAIL", x)
print(f"{'FAIL' if problems else 'OK'}: {sum(1 for _ in flat(d['panels']))} panels checked, {len(problems)} problem(s)")
sys.exit(1 if problems else 0)
