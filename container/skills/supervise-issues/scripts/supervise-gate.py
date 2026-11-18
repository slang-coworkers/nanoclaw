#!/usr/bin/env python3
"""supervise-gate.py — the zero-token hourly pre-task gate of the /supervise-issues task.

The supervisor used to run its full, model-driven tick every 12 hours, so a chain
that stalled just after a tick (a fixer killed mid-task with no PR and no comment)
went unnoticed for up to 12 hours. This gate runs every hour inside the
orchestrator's container, before the agent wakes, and decides with no model
tokens whether a tick is needed now:

  1. It pulls the chain universe incrementally: `pull-universe.sh --cache-dir`
     refetches only the chains that changed since the last pull (see
     universe_cache.py) within a soft time budget.
  2. It classifies every chain with scan.py's own `run()` — the same function the
     full tick uses, so the nudge and escalate rules have one source.
  3. It wakes the agent when a chain newly needs a nudge or an escalation, or
     when FULL_PASS_EVERY_S has passed since the last tick (the periodic full
     discovery pass), and otherwise answers wakeAgent=false.

A woken agent runs the normal /supervise-issues tick, which covers every chain.

"Newly" matters. scan.py stops flagging a chain once the tick records that it
nudged it (`nudgedAt`), but a tick can also judge a flag a false positive and send
nothing, and then the flag stays. So the gate keeps the flags it has already shown
a tick (`presented` in its state) and wakes only for one it has not: a flag that
persists after a tick saw it waits for the next full pass instead of waking the
agent every hour. A flag that clears is forgotten, so the chain wakes the agent
again if it stalls again.

A chain the incremental pull built from missing or out-of-date data carries
`cache_cold` and is left out of the decision. The first runs after a deploy warm
the cache within the time box; until then the full pass covers those chains.

The gate never fails the task: a pull that errors or overruns PULL_HARD_S is
killed, the run is recorded as degraded, and the gate still prints valid JSON and
exits 0 (a failing script backs the series off and, after 8 failures, pauses it).
The full pass still fires on time, and the FAILURE_WAKE_AFTER-th degraded run in a
row wakes the agent once, so a broken gate cannot leave the chains unsupervised
past the next full pass without anyone being told.

Files, all under /workspace/agent/.supervise-gate/:
  state.json     last_wake_at, presented flags, failure streak
  last-run.json  the full record of the latest run (what woke, why, pull stats)
  history.log    one line per run
  cache/         the incremental pull's cache (universe_cache.py)
  last/          the latest payload, scan output and pull log, for debugging

Modes:
  --gate     (default) decide, write the files above, print the gate JSON last.
  --dry-run  decide and print the gate JSON; writes nothing but the pull cache.

Task (orchestrator, host shell; see SKILL.md → Scheduling):
  --recurrence '0 * * * *' --script $'# nanoclaw-task-timeout: 300\\nexec python3 /app/skills/supervise-issues/scripts/supervise-gate.py --gate'
"""

from __future__ import annotations

import contextlib
import datetime as dt
import fcntl
import importlib.util
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent

# The periodic full discovery pass: the agent is woken at least this often.
FULL_PASS_EVERY_S = 12 * 60 * 60
# The task script declares `# nanoclaw-task-timeout: 300`. The pull gets a soft
# budget (it stops starting new fetches) and a hard limit (its process group is
# killed); the rest covers scan.py and the bookkeeping.
PULL_BUDGET_S = float(os.environ.get("SUPERVISE_GATE_PULL_BUDGET_S") or 150)
PULL_HARD_S = float(os.environ.get("SUPERVISE_GATE_PULL_HARD_S") or 230)
# A run of this many degraded gate runs in a row wakes the agent once.
FAILURE_WAKE_AFTER = 3
# Threads listed in the gate JSON (the prompt the agent sees); the rest are counted.
MAX_LISTED = 20

AGENT = Path(os.environ.get("SUPERVISE_GATE_AGENT_DIR") or "/workspace/agent")
STATE_DIR = AGENT / ".supervise-gate"
SUPERVISOR_STATE = AGENT / "memory" / "supervisor-state.json"


class GateDegraded(Exception):
    """The pull or the scan did not produce a classification this run."""


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(ts: dt.datetime) -> str:
    return ts.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value):
    if not value or not isinstance(value, str):
        return None
    try:
        ts = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=dt.timezone.utc)


def load_json(path: Path, default):
    try:
        with open(path) as f:
            data = json.load(f)
    except (OSError, ValueError):
        return default
    return data if isinstance(data, dict) else default


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=1)
    os.replace(tmp, path)


def load_scan():
    """scan.py as a module, so the gate classifies with the full tick's own `run()`."""
    spec = importlib.util.spec_from_file_location("supervise_scan", HERE / "scan.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def last_tick_at(state: dict, now: dt.datetime):
    """When a full tick last ran: the gate's last wake, or the tick time the supervisor wrote
    into supervisor-state.json `_meta` (a hand-run tick counts too), whichever is later."""
    times = [parse_iso(state.get("last_wake_at"))]
    meta = load_json(SUPERVISOR_STATE, {}).get("_meta")
    if isinstance(meta, dict):
        times.append(parse_iso(meta.get("ran_at")) or parse_iso(meta.get("at")))
    times = [t for t in times if t is not None and t <= now]
    return max(times) if times else None


def run_pull(last_dir: Path) -> dict:
    """Run the incremental pull under the hard time limit and return its payload.

    SUPERVISE_GATE_PULL_CMD replaces pull-universe.sh with a shell command whose
    stdout is the payload (tests use it).
    """
    custom = os.environ.get("SUPERVISE_GATE_PULL_CMD")
    argv = ["bash", "-c", custom] if custom else [
        "bash", str(HERE / "pull-universe.sh"),
        "--state", str(SUPERVISOR_STATE),
        "--cache-dir", str(STATE_DIR / "cache"),
        "--budget-s", str(int(PULL_BUDGET_S)),
    ]
    last_dir.mkdir(parents=True, exist_ok=True)
    payload_path, log_path = last_dir / "payload.json", last_dir / "pull.log"
    with open(payload_path, "w") as out, open(log_path, "w") as err:
        # Its own process group, so a timeout kills the pull's ncl/gh children too.
        proc = subprocess.Popen(argv, stdout=out, stderr=err, start_new_session=True)
        try:
            rc = proc.wait(timeout=PULL_HARD_S)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
            raise GateDegraded(f"pull exceeded the {int(PULL_HARD_S)}s time box and was killed") from None
    if rc != 0:
        raise GateDegraded(f"pull exited {rc}: {log_tail(log_path)}")
    try:
        with open(payload_path) as f:
            payload = json.load(f)
    except ValueError:
        raise GateDegraded("pull output is not JSON") from None
    if not isinstance(payload, dict) or not isinstance(payload.get("chains"), dict):
        raise GateDegraded("pull output has no chains")
    return payload


def log_tail(path: Path, limit: int = 300) -> str:
    try:
        return path.read_text(errors="replace")[-limit:].strip()
    except OSError:
        return ""


def classify(payload: dict):
    """Run scan.py over the payload; return (flags, cold threads, scan summary, scan output).

    A flag is "<thread>|nudge" for a row whose action is 'nudge', "<thread>|escalate"
    for a row with escalate=true. Cold chains raise no flag.
    """
    try:
        result = load_scan().run(payload)
    # Any scan failure (scan.py exits on a payload without `now`) degrades the run
    # instead of failing the task.
    except (Exception, SystemExit) as e:  # noqa: BLE001
        raise GateDegraded(f"scan failed: {e}") from None
    cold = {t for t, c in payload["chains"].items() if isinstance(c, dict) and c.get("cache_cold")}
    flags = set()
    for row in result.get("rows", []):
        if row.get("thread") in cold:
            continue
        if row.get("action") == "nudge":
            flags.add(f"{row['thread']}|nudge")
        if row.get("escalate"):
            flags.add(f"{row['thread']}|escalate")
    return flags, cold, result.get("summary") or {}, result


def threads_of(flags, kind: str):
    return sorted(f.rsplit("|", 1)[0] for f in flags if f.endswith(f"|{kind}"))


def run_gate(mode: str) -> dict:
    start = time.monotonic()
    now = utcnow()
    state = load_json(STATE_DIR / "state.json", {})
    presented = state.get("presented") if isinstance(state.get("presented"), dict) else {}
    failures = int(state.get("failures") or 0)

    last_tick = last_tick_at(state, now)
    full_due = last_tick is None or (now - last_tick).total_seconds() >= FULL_PASS_EVERY_S

    degraded = None
    flags, cold, summary, scan_out = set(), set(), {}, None
    try:
        payload = run_pull(STATE_DIR / "last")
        flags, cold, summary, scan_out = classify(payload)
    except GateDegraded as e:
        degraded = str(e)

    new = flags - set(presented)
    reasons = []
    if threads_of(new, "nudge"):
        reasons.append("nudge")
    if threads_of(new, "escalate"):
        reasons.append("escalate")
    if full_due:
        reasons.append("full-pass")
    if degraded:
        failures += 1
        if failures == FAILURE_WAKE_AFTER:
            reasons.append("gate-degraded")
    else:
        failures = 0
    wake = bool(reasons)

    if not degraded:
        # On a wake the tick sees every current flag; otherwise flags that cleared are forgotten.
        presented = ({f: presented.get(f) or iso(now) for f in flags} if wake
                     else {f: t for f, t in presented.items() if f in flags})
    report = load_json(STATE_DIR / "cache" / "report.json", {})
    hours = round((now - last_tick).total_seconds() / 3600, 1) if last_tick else None
    data = {
        "reasons": reasons,
        "nudge": threads_of(new, "nudge")[:MAX_LISTED],
        "escalate": threads_of(new, "escalate")[:MAX_LISTED],
        "already_presented": len(flags - new),
        "hours_since_last_tick": hours,
        "chains": {
            "in_flight": summary.get("in_flight"),
            "must_nudge": summary.get("must_nudge"),
            "escalate": summary.get("escalate"),
            "cold": len(cold),
        },
        "degraded": degraded,
        "record": str(STATE_DIR / "last-run.json"),
    }
    elapsed = round(time.monotonic() - start, 1)

    if mode == "gate":
        new_state = dict(state)
        new_state.update({"version": 1, "presented": presented, "failures": failures})
        if wake:
            new_state["last_wake_at"] = iso(now)
        if not degraded:
            new_state["last_ok_at"] = iso(now)
        write_json(STATE_DIR / "state.json", new_state)
        if scan_out is not None:
            write_json(STATE_DIR / "last" / "scan-out.json", {"summary": summary, "rows": scan_out.get("rows", [])})
        write_json(STATE_DIR / "last-run.json", {
            "at": iso(now), "elapsed_s": elapsed, "wake": wake, "reasons": reasons,
            "new_flags": sorted(new), "flags": sorted(flags), "cold_chains": sorted(cold),
            "summary": summary, "pull": report, "degraded": degraded, "failures": failures,
            "last_tick_at": iso(last_tick) if last_tick else None,
            "last_wake_at": new_state.get("last_wake_at"),
        })
        with open(STATE_DIR / "history.log", "a") as f:
            f.write(f"{iso(now)} wake={str(wake).lower()} reasons={','.join(reasons) or '-'} "
                    f"new={len(new)} flagged={len(flags)} cold={len(cold)} "
                    f"in_flight={summary.get('in_flight', '-')} elapsed={elapsed}s"
                    f"{' degraded=' + degraded[:120] if degraded else ''}\n")
    print(f"supervise-gate: wake={wake} reasons={reasons} new={len(new)} flagged={len(flags)} "
          f"cold={len(cold)} elapsed={elapsed}s{' degraded: ' + degraded if degraded else ''}",
          file=sys.stderr)
    return {"wakeAgent": wake, "data": data}


def fallback_decision(error: BaseException) -> dict:
    """Last-resort answer when the gate itself crashed: wake only when the full pass is due."""
    try:
        now = utcnow()
        last = last_tick_at(load_json(STATE_DIR / "state.json", {}), now)
        due = last is None or (now - last).total_seconds() >= FULL_PASS_EVERY_S
    except Exception:  # noqa: BLE001 — the crash path itself must not raise
        due = False
    return {"wakeAgent": due, "data": {"reasons": ["full-pass"] if due else [],
                                       "degraded": f"gate crashed: {error!r}"[:300]}}


def main(argv) -> int:
    mode = "dry" if "--dry-run" in argv else "gate"
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_DIR / "lock", "w") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                decision = {"wakeAgent": False, "data": {"skipped": "another gate run holds the lock"}}
            else:
                decision = run_gate(mode)
    except Exception as e:  # noqa: BLE001 — a crash still answers valid gate JSON
        decision = fallback_decision(e)
    # The task runner reads the LAST stdout line as the gate JSON; nothing else goes to stdout.
    sys.stdout.write(json.dumps(decision) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
