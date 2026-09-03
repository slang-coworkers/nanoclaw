#!/usr/bin/env python3
"""Emit NanoClaw coworker-fleet metrics as InfluxDB line protocol on stdout.

Run by telegraf's inputs.exec. Every data source is opened READ-ONLY:
SQLite uses `file:...?mode=ro` + `PRAGMA query_only`, logs are read with 'rb'.
Nothing here ever writes to the nanoclaw prod data directory.

Failures are contained: any section that throws is skipped and counted in
nanoclaw_collector.errors, so telegraf keeps getting the sections that work.
"""

import json
import os
import socket
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timezone

NC = "/home/ubuntu/slang-coworkers-prod/nanoclaw"
DB = os.path.join(NC, "data", "v2.db")
LOG = os.path.join(NC, "logs", "nanoclaw.log")
ERRLOG = os.path.join(NC, "logs", "nanoclaw.error.log")
FUNNEL = os.path.join(NC, "reports", "funnel.json")

WINDOW_MS = 300_000          # 5m rolling window for hook_events
STALE_SEC = 3600             # running container silent this long = stale
CEILING_SEC = 10800          # container absolute ceiling (container-runner.ts)
CEILING_WARN_SEC = 1800      # warn once within this much of the ceiling
APPROVAL_WINDOW_H = 24
TOP_TOOLS = 25
MAX_LOG_SCAN = 8 * 1024 * 1024   # cap a single incremental log read

# Cost feed: the dashboard's /api/sessions is backed by sessionCostCache, which
# refreshes unconditionally every 60s (dashboard/server.ts) -- unlike the
# ccusage-backed endpoints, it is never stale without a browser open. period=1d
# = cost accrued so far TODAY, priced from the transcript JSONL (Claude + Codex).
DASH_URL = "http://127.0.0.1:3737"
COST_TOP_SESSIONS = 100      # per-session cardinality cap; overflow is emitted, never silent

_errors = []
_out = []


# ---------- line protocol ----------

def _esc_tag(s):
    return (str(s).replace("\\", "\\\\").replace(" ", "\\ ")
            .replace(",", "\\,").replace("=", "\\="))


def emit(measurement, fields, tags=None):
    """Append one line-protocol point. Ints get the 'i' suffix."""
    if not fields:
        return
    line = _esc_tag(measurement)
    for k, v in sorted((tags or {}).items()):
        if v is None or v == "":
            continue
        line += f",{_esc_tag(k)}={_esc_tag(v)}"
    parts = []
    for k, v in sorted(fields.items()):
        if v is None:
            continue
        if isinstance(v, bool):
            parts.append(f"{_esc_tag(k)}={'true' if v else 'false'}")
        elif isinstance(v, int):
            parts.append(f"{_esc_tag(k)}={v:d}i")  # trailing i = influx integer type
        elif isinstance(v, float):
            parts.append(f"{_esc_tag(k)}={v:g}")
        else:
            _sv = str(v).replace('"', '\\"')
            parts.append(f'{_esc_tag(k)}="{_sv}"')
    if parts:
        _out.append(line + " " + ",".join(parts))


# ---------- incremental log state ----------

def _state_path():
    for d in ("/var/lib/telegraf", "/tmp"):
        if os.path.isdir(d) and os.access(d, os.W_OK):
            return os.path.join(d, "nanoclaw-metrics-state.json")
    return "/tmp/nanoclaw-metrics-state.json"


def load_state():
    try:
        with open(_state_path()) as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001 - a collector must never crash the metrics pipeline
        return {}


def save_state(st):
    try:
        p = _state_path()
        tmp = p + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(st, fh)
        os.replace(tmp, p)
    except Exception as exc:  # noqa: BLE001 - a collector must never crash the metrics pipeline
        _errors.append(f"state:{exc}")


def read_new_bytes(path, state, key):
    """Return bytes appended to `path` since the last run (handles rotation)."""
    size = os.path.getsize(path)
    prev = state.get(key, None)
    if prev is None or prev > size:      # first run, or file rotated/truncated
        state[key] = size
        return b""
    if prev == size:
        return b""
    start = prev
    if size - prev > MAX_LOG_SCAN:       # huge gap: only scan the tail
        start = size - MAX_LOG_SCAN
    with open(path, "rb") as fh:
        fh.seek(start)
        data = fh.read(size - start)
    state[key] = size
    return data


# ---------- helpers ----------

def parse_iso(s):
    if not s:
        return None
    try:
        t = str(s).replace("Z", "+00:00")
        dt = datetime.fromisoformat(t)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except Exception:  # noqa: BLE001 - a collector must never crash the metrics pipeline
        return None


def model_tier(model):
    """Coarse model tier for the per-coworker wire-mix panel.

    Collapses an alias ('opus'/'sonnet'/'haiku') or a full model id
    (e.g. 'claude-sonnet-5-...', 'bedrock/anthropic.claude-opus-...') to a
    single tier so coworkers group cleanly, while the raw model id is emitted
    as its own tag for the detail column. An UNSET model means the group
    inherits the host/provider default rather than an explicit tier, so it is
    labelled 'default' -- never guessed. Asserting a tier the config does not
    state would be exactly the kind of plausible-but-wrong value this
    collector is written to avoid.
    """
    if not model:
        return "default"
    m = str(model).lower()
    if "opus" in m:
        return "opus"
    if "sonnet" in m:
        return "sonnet"
    if "haiku" in m:
        return "haiku"
    return "other"


def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=2):
            return 1
    except Exception:  # noqa: BLE001 - a collector must never crash the metrics pipeline
        return 0


def connect_ro():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=5.0)
    con.execute("PRAGMA query_only = 1")
    return con


# ---------- collectors ----------

def collect_db(now_ms):
    con = connect_ro()
    cur = con.cursor()
    try:
        groups = {}   # folder -> (name, coworker_type)
        for gid, name, ctype, folder in cur.execute(
                "SELECT id, name, coworker_type, folder FROM agent_groups"):
            groups[gid] = (name or gid, ctype or "unknown", folder or "")

        # --- per-group provider/model tier (wire-mix) ---
        # container_configs is the source of truth for a coworker's model
        # tier: `ncl groups config update --model` writes here, it is
        # materialized to groups/<folder>/container.json, and the agent-runner
        # passes it to the SDK as the query model. Read read-only from the same
        # v2.db connection. Wrapped on its own so a schema surprise degrades to
        # "no model tag" instead of taking down every db metric below.
        cfgs = {}   # gid -> (provider, model)
        try:
            for gid, provider, model in cur.execute(
                    "SELECT agent_group_id, provider, model FROM container_configs"):
                cfgs[gid] = (provider or "", model or "")
        except Exception as exc:  # noqa: BLE001 - degrade, never crash the pipeline
            _errors.append(f"cfgs:{exc}")

        # --- sessions, per group and fleet-wide ---
        now = time.time()
        per = {}
        fleet = {"sessions_running": 0, "sessions_active": 0,
                 "sessions_total": 0, "stale_running": 0}
        max_silence = 0.0
        near_ceiling = 0
        for gid, status, cstatus, last_active in cur.execute(
                "SELECT agent_group_id, status, container_status, last_active "
                "FROM sessions"):
            d = per.setdefault(gid, {"running": 0, "active": 0,
                                     "total": 0, "stale": 0})
            d["total"] += 1
            fleet["sessions_total"] += 1
            if status == "active":
                d["active"] += 1
                fleet["sessions_active"] += 1
            if cstatus == "running":
                d["running"] += 1
                fleet["sessions_running"] += 1
                ts = parse_iso(last_active)
                if ts is not None:
                    silence = now - ts
                    max_silence = max(max_silence, silence)
                    if silence > STALE_SEC:
                        d["stale"] += 1
                        fleet["stale_running"] += 1
                    if silence > CEILING_SEC - CEILING_WARN_SEC:
                        near_ceiling += 1
        fleet["max_silence_sec"] = int(max_silence)
        # Running sessions whose last_active is older than
        # CEILING_SEC - CEILING_WARN_SEC.
        #
        # NAMED FOR WHAT IT MEASURES, which is SILENCE, not container age. On
        # prod max_silence_sec reads ~59800s against a 10800s container ceiling,
        # so sessions.last_active plainly does not track the container heartbeat
        # that container-runner.ts kills on. Calling this "near_ceiling" would
        # assert a relationship to that kill that the data does not support.
        # It is still a useful signal on its own terms: a running session nobody
        # has heard from in over two and a half hours.
        fleet["silent_beyond_warn"] = int(near_ceiling)
        # Collector heartbeat. Every other panel on the dashboard is only as
        # trustworthy as this number: if the collector stops, InfluxDB simply
        # stops gaining points and `last()` keeps serving the final value
        # forever -- which is how a dead metric reads as a healthy one. A panel
        # of `now() - heartbeat_unixtime` is the watchdog for the whole board.
        fleet["heartbeat_unixtime"] = int(now)

        # --- hook_events in the rolling window (idx_he_ts) ---
        since = now_ms - WINDOW_MS
        ev_total = 0
        for event, n in cur.execute(
                "SELECT event, COUNT(*) FROM hook_events WHERE timestamp > ? "
                "GROUP BY event", (since,)):
            emit("nanoclaw_hook_event", {"count": n}, {"event": event or "unknown"})
            ev_total += n
        fleet["hook_events"] = ev_total

        for tool, n in cur.execute(
                "SELECT tool, COUNT(*) FROM hook_events WHERE timestamp > ? "
                "AND tool IS NOT NULL GROUP BY tool ORDER BY 2 DESC LIMIT ?",
                (since, TOP_TOOLS)):
            emit("nanoclaw_tool", {"calls": n}, {"tool": tool})

        by_folder, fail_by_folder = {}, {}
        for folder, n in cur.execute(
                "SELECT group_folder, COUNT(*) FROM hook_events "
                "WHERE timestamp > ? GROUP BY group_folder", (since,)):
            by_folder[folder or ""] = n
        for folder, n in cur.execute(
                "SELECT group_folder, COUNT(*) FROM hook_events "
                "WHERE timestamp > ? AND event = 'PostToolUseFailure' "
                "GROUP BY group_folder", (since,)):
            fail_by_folder[folder or ""] = n
        fleet["tool_failures"] = sum(fail_by_folder.values())

        tier_agg = {}   # tier -> {"events", "coworkers", "running"}
        for gid, d in per.items():
            name, ctype, folder = groups.get(gid, (gid, "unknown", ""))
            provider, model = cfgs.get(gid, ("", ""))
            tier = model_tier(model)
            ev = by_folder.get(folder, 0)
            # provider/model/tier tags feed the wire-mix panels. emit() drops
            # empty tag values, so an unset model simply omits the model tag;
            # provider falls back to the baked-in default ('claude') and tier
            # is always a groupable label ('default' when the model is unset).
            emit("nanoclaw_group",
                 {"running": d["running"], "active": d["active"],
                  "total": d["total"], "stale": d["stale"],
                  "events": ev,
                  "tool_failures": fail_by_folder.get(folder, 0)},
                 {"group": name, "coworker_type": ctype,
                  "provider": provider or "claude", "model": model,
                  "tier": tier})
            a = tier_agg.setdefault(tier, {"events": 0, "coworkers": 0,
                                           "running": 0})
            a["events"] += ev
            a["coworkers"] += 1
            a["running"] += d["running"]

        # Per-tier rollup for the wire-mix share panels. Pre-aggregated here
        # (not via an InfluxQL subquery) so the panel is the same trivial
        # `last() ... GROUP BY "tier"` idiom as every other bargauge, and so
        # the arithmetic is done where all the inputs are already in hand.
        # `events` is the same 5m rolling hook-event count the fleet uses as
        # its activity proxy -- a stand-in for turns, not billed cost.
        for tier, a in tier_agg.items():
            emit("nanoclaw_tier",
                 {"events": a["events"], "coworkers": a["coworkers"],
                  "running": a["running"]},
                 {"tier": tier})

        fleet["groups_total"] = len(groups)
        emit("nanoclaw_fleet", fleet)

        # --- approvals ---
        cutoff = datetime.fromtimestamp(
            now - APPROVAL_WINDOW_H * 3600, timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
        appr = {}
        for decision, n in cur.execute(
                "SELECT decision, COUNT(*) FROM approval_decisions "
                "WHERE decided_at > ? GROUP BY decision", (cutoff,)):
            appr[(decision or "unknown").lower()] = n
        appr_total = {}
        for decision, n in cur.execute(
                "SELECT decision, COUNT(*) FROM approval_decisions GROUP BY decision"):
            appr_total[(decision or "unknown").lower() + "_all"] = n
        merged = dict(appr)
        merged.update(appr_total)
        merged["window_hours"] = APPROVAL_WINDOW_H
        emit("nanoclaw_approvals", merged)

        for reason, n in cur.execute(
                "SELECT reason_code, COUNT(*) FROM approval_decisions "
                "GROUP BY reason_code ORDER BY 2 DESC LIMIT 15"):
            emit("nanoclaw_approval_reason", {"count": n},
                 {"reason": reason or "unknown"})

        for mode, n in cur.execute(
                "SELECT mode, COUNT(*) FROM approval_decisions GROUP BY mode"):
            emit("nanoclaw_approval_mode", {"count": n}, {"mode": mode or "unknown"})

        # --- queues / backlog ---
        def count(tbl):
            try:
                return cur.execute(f"SELECT COUNT(*) FROM [{tbl}]").fetchone()[0]
            except Exception:  # noqa: BLE001 - a collector must never crash the metrics pipeline
                return None
        emit("nanoclaw_queue", {
            "pending_reviewable_prs": count("pending_reviewable_prs"),
            "pending_questions": count("pending_questions"),
            "pending_approvals": count("pending_approvals"),
            "pr_session_mappings": count("pr_session_mappings"),
            "unregistered_senders": count("unregistered_senders"),
            "a2a_session_sources": count("a2a_session_sources"),
        })
    finally:
        con.close()


def collect_logs(state):
    # webhook routing outcomes, counted incrementally from the tail
    data = read_new_bytes(LOG, state, "nanoclaw_log_off")
    if data:
        text = data.decode("utf-8", "replace")
        emit("nanoclaw_webhook", {
            "delivered_agent_group": text.count("delivered to agent group"),
            "delivered_pr_mapping": text.count("delivered via PR mapping"),
            "dropped_no_mapping": text.count("no mapping"),
            "forwarded_foreign": text.count("forwarded to foreign owner"),
            "delivered_peer": text.count("delivered to peer"),
            "duplicate": text.count("duplicate delivery"),
            "bytes": len(data),
        })
    else:
        emit("nanoclaw_webhook", {"delivered_agent_group": 0,
                                  "delivered_pr_mapping": 0,
                                  "dropped_no_mapping": 0,
                                  "forwarded_foreign": 0,
                                  "delivered_peer": 0,
                                  "duplicate": 0, "bytes": 0})

    data = read_new_bytes(ERRLOG, state, "nanoclaw_errlog_off")
    text = data.decode("utf-8", "replace") if data else ""
    emit("nanoclaw_errors", {
        "warn": text.count("WARN"),
        "error": text.count("ERROR"),
        "bytes": len(data),
    })


def collect_funnel():
    st = os.stat(FUNNEL)
    with open(FUNNEL) as fh:
        d = json.load(fh)
    fields = {"age_sec": int(time.time() - st.st_mtime)}

    def _num(x):
        """A number we can store, or None.

        FLOATS COUNT. They did not used to, and that silently dropped
        issuePartition.winRate the moment it stopped being a whole number:
        the last point written was 2026-08-03T13:09Z with value 0, and every
        dashboard kept rendering that stale 0 as the current win rate for the
        following week. bool is excluded deliberately -- in Python
        isinstance(True, int) is True, and a flag stored as 1 is not a metric.
        """
        if isinstance(x, bool):
            return None
        return x if isinstance(x, (int, float)) else None

    for k, v in d.items():
        if isinstance(v, bool):
            continue
        n = _num(v)
        if n is not None:
            fields[k] = n
        elif isinstance(v, dict):
            for k2, v2 in v.items():
                n2 = _num(v2)
                if n2 is not None:
                    fields[f"{k}_{k2}"] = n2
        elif isinstance(v, list):
            fields[k + "_count"] = len(v)
    emit("nanoclaw_funnel", fields)


def collect_health():
    emit("nanoclaw_health", {
        "webhook_port": port_open(3841),
        "dashboard_port": port_open(3737),
        "influx_port": port_open(8086),
        "db_bytes": os.path.getsize(DB),
    })


def collect_cost():
    """Fleet / per-coworker / per-session USD accrued TODAY.

    Reads the dashboard's /api/sessions?period=1d (always-fresh, 60s
    sessionCostCache). Every dollar is priced from the transcript JSONL, so
    Claude and Codex are both included and split out. Emitted as one measurement
    `nanoclaw_cost` with a `scope` tag so a single dashboard row can show fleet,
    per-coworker and per-session breakdowns off the same series:

      scope=fleet                     -> whole-fleet usd today + active sessions
      scope=group   group=<name>      -> one point per coworker (zero-cost skipped)
      scope=session session=<id>      -> one point per costing session, top-N by usd

    Honesty rules from ops/README.md are kept: a coworker/session that spent $0
    today emits no point (so "no data" != "spent zero"), and if more sessions
    cost money than the cardinality cap allows, the overflow COUNT is emitted
    rather than silently dropped.
    """
    req = urllib.request.Request(DASH_URL + "/api/sessions?period=1d")
    with urllib.request.urlopen(req, timeout=15) as resp:
        d = json.load(resp)
    if d.get("costUnavailable"):
        _errors.append("cost:costUnavailable")
        return
    sessions = d.get("sessions", []) or []

    fleet_usd = fleet_claude = fleet_codex = 0.0
    active = 0
    per = {}          # folder -> [name, usd, claude, codex, sessions]
    costed = []       # (usd, claude, codex, session_id, name, folder)
    for s in sessions:
        usd = float(s.get("cost") or 0)
        claude = float(s.get("claudeUsd") or 0)
        codex = float(s.get("codexUsd") or 0)
        folder = s.get("group_folder") or ""
        name = s.get("group_name") or folder or "unknown"
        if (s.get("container_status") or "") == "running":
            active += 1
        fleet_usd += usd
        fleet_claude += claude
        fleet_codex += codex
        g = per.setdefault(folder, [name, 0.0, 0.0, 0.0, 0])
        g[1] += usd
        g[2] += claude
        g[3] += codex
        g[4] += 1
        if usd > 0:
            costed.append((usd, claude, codex, s.get("session_id") or "", name, folder))

    emit("nanoclaw_cost",
         {"usd": round(fleet_usd, 6), "claude_usd": round(fleet_claude, 6),
          "codex_usd": round(fleet_codex, 6),
          "active_sessions": active, "sessions_total": len(sessions)},
         {"scope": "fleet"})

    for folder, g in per.items():
        if g[1] <= 0:      # a coworker that spent nothing today emits nothing
            continue
        emit("nanoclaw_cost",
             {"usd": round(g[1], 6), "claude_usd": round(g[2], 6),
              "codex_usd": round(g[3], 6), "sessions": g[4]},
             {"scope": "group", "group": g[0], "folder": folder})

    costed.sort(reverse=True)
    for usd, claude, codex, sid, name, folder in costed[:COST_TOP_SESSIONS]:
        emit("nanoclaw_cost",
             {"usd": round(usd, 6), "claude_usd": round(claude, 6),
              "codex_usd": round(codex, 6)},
             {"scope": "session", "session": sid, "group": name, "folder": folder})

    overflow = len(costed) - COST_TOP_SESSIONS
    if overflow > 0:
        # never silently truncate: how many costing sessions we could not emit
        emit("nanoclaw_cost", {"dropped_sessions": overflow}, {"scope": "session_overflow"})


def main():
    t0 = time.time()
    now_ms = int(t0 * 1000)
    state = load_state()

    for name, fn in (("db", lambda: collect_db(now_ms)),
                     ("logs", lambda: collect_logs(state)),
                     ("funnel", collect_funnel),
                     ("health", collect_health),
                     ("cost", collect_cost)):
        try:
            fn()
        except Exception as exc:  # noqa: BLE001 - a collector must never crash the metrics pipeline
            _errors.append(f"{name}:{exc}")

    save_state(state)
    emit("nanoclaw_collector", {
        "duration_ms": int((time.time() - t0) * 1000),
        "errors": len(_errors),
        "points": len(_out),
        "detail": "; ".join(_errors)[:200] if _errors else "ok",
    })
    sys.stdout.write("\n".join(_out) + "\n")


if __name__ == "__main__":
    main()
