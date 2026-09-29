#!/usr/bin/env python3
"""Static checks for ops/grafana/nanoclaw-coworkers.json that Grafana only reports at render time.

- every panel's queries use distinct refIds: Grafana rejects the WHOLE panel request with
  400 "query.duplicateRefId" otherwise, and the panel silently shows 0 / no data
  (the "Fleet cost today over time" panel shipped this way, found 2026-09-29).
- every influx query targets the provisioned datasource uid.
Run: python3 ops/grafana/check_dashboard.py  (exit 1 on any problem)
"""
import json, os, sys
DS_UID = "PF3A0F3054C0DA367"
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nanoclaw-coworkers.json")
d = json.load(open(path))

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
for x in problems:
    print("FAIL", x)
print(f"{'FAIL' if problems else 'OK'}: {sum(1 for _ in flat(d['panels']))} panels checked, {len(problems)} problem(s)")
sys.exit(1 if problems else 0)
