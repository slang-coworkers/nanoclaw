#!/usr/bin/env python3
"""Hermes port chain supervisor: state + threads + fork PRs + nudge ledger -> actions.

The supervise tick (docs/hermes-port/autopilot.md §2, §3, §5) walks every in-flight row,
derives the chain stage from the role messages on the row's thread and the fork PR,
measures the stage's age against the SLO table, and emits at most one bounded action per
row: `nudge` the role that owes the next artifact (once per row per 6 h, across states)
or `escalate` to the human (an alerts.md line plus the status-thread text, once per
(row, state) per 24 h). Terminal rows (merged, deferred, carried) get nothing; `blocked`
and cost-held rows escalate once and are never nudged. Pure: one set of JSON files in,
one JSON out, `--now` fixes the clock.

Inputs:

  --state    state.json from hermes_queue.py (rows, in_flight, blocked, gating)
  --threads  {"hermes-<ID>": [{"ts", "direction", "text", "sender"?, "kind"?}, ...]}
             the collector's normalised view of the row thread across the role sessions;
             `kind` (spec_handoff | builder_start | handoff | test_report | review_verdict |
             triage | merged | stop | gate_red | nudge | dispatch | pr_opened | blocker)
             is honoured when present, otherwise the first line of `text` is classified
  --prs      gh pr list --repo slang-coworkers/hermes-agent --state all --json
             number,title,state,isDraft,createdAt,updatedAt,headRefName,body[,headRefOid]
  --nudges   {"<ID>": "<ISO>"} or {"<ID>": {"last_nudge", "state", "count", "alerts": {"<key>": "<ISO>"}}}
  --sessions optional {"hermes-<ID>": [{"role", "session_id", "cost_status", "container_status", "status", "last_active"}]}
             (nudge actions pin the role's live session as target_session_id — one live session per role per row)
             for cost_hold (`escalated` / `stopped`); absent means no signal
  --config   optional config.json (paused_rows, core_change_ok, authorize_round, release_tag,
             card_check, card_grace_minutes, card_missing_since)
  --now      ISO timestamp

Output: {"now", "rows": {ID: {...}}, "actions": [...], "alerts": [...], "summary": {...}}.
Per row: stage, stage_label, clock_start, last_activity, age_hours, slo_breach,
escalation_due, hold, cost_hold, action (none | nudge | escalate), target_role, message
(the nudge text or the alerts.md line), alert_line, status_line, pr, head, rounds, cards.

card_missing (hermes-task-card): every terminal role marker on the thread ([Spec handoff],
[Triage Resolution], [Fix Report], [Fix Review Request], [Test Report], [Review Verdict]) owes
one LATER outbound line starting "card · " or "card(html) · " (the send_file caption). A marker
older than `card_grace_minutes` (default 20) with no such line draws one nudge to the role that
sent it, through the ordinary nudge machinery (one nudge per row per tick, the 6 h row bound,
SLO nudges first). "Once per marker": the nudge names the marker and its timestamp, so the next
tick reads its own nudge back from the thread and does not repeat it. `card_missing_since`
(ISO, optional) ignores markers older than that, for threads that predate the card skill.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

FORK = "slang-coworkers/hermes-agent"
NUDGE_BOUND_H = 6.0
ALERT_BOUND_H = 24.0
HOLD_TOO_LONG_H = 48.0
TEST_FAIL_CAP = 2  # in-plugin FAILs per review cycle (a REQUEST_CHANGES starts a new cycle); FAIL (env)/ESCALATE never count
REVIEW_RC_CAP = 2  # REQUEST_CHANGES per PR
ORCHESTRATOR = "orchestrator"
DUP_WINDOW_S = 900  # a2a copies of one send (sender `out`, receiver `in`) land within seconds of each other
PR_EVENT_KINDS = ("handoff", "test_report", "review_verdict", "merged", "pr_opened")

# state -> (nudge after h, role owing the next artifact, escalate after h)
SLO = {
    "queued": (4.0, None, 6.0),
    "dispatched": (6.0, "hermes-architect", 12.0),
    "spec_handoff": (2.0, "hermes-architect", 6.0),
    "building": (8.0, "hermes-builder", 16.0),
    "pr_open": (2.0, "hermes-builder", 6.0),
    "testing": (6.0, "hermes-tester", 12.0),
    "review": (4.0, "hermes-reviewer", 10.0),
    "gate": (4.0, "hermes-architect", 8.0),
}
IN_FLIGHT = ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")
NUDGE_TEMPLATE = (
    "Supervisor nudge {id}: {state} for {h}h, no {short}. Expected next: {expected} on thread "
    "hermes-{id}. Reply on this thread: status, blocker, ETA. If your container restarted, "
    "re-read your task memory and resume."
)

# hermes-task-card: marker line prefix -> the role that owes the card for it
CARD_MARKERS = {
    "[Spec handoff]": "hermes-architect",
    "[Triage Resolution]": "hermes-architect",
    "[Fix Report]": "hermes-builder",
    "[Fix Review Request]": "hermes-builder",
    "[Test Report]": "hermes-tester",
    "[Review Verdict]": "hermes-reviewer",
}
CARD_PREFIXES = ("card · ", "card(html) · ")
CARD_GRACE_MINUTES = 20
CARD_ROLE_RE = re.compile(r"^card(?:\(html\))? · \S+ · ([a-z][a-z-]*) ·")
CARD_NUDGE_MARK = "no task card"
CARD_NUDGE_TEMPLATE = (
    "Supervisor nudge {id}: {mark} after your {marker} at {ts} ({m} min ago). Run /hermes-task-card "
    "for {id} and send_file the PNG as a reply to the same intake id, caption "
    "\"card · {id} · {role} · <OUTCOME> — <headline>\" (prefix \"card(html) · \" with the .html if the PNG failed)."
)


def parse_iso(s: str) -> datetime:
    t = s.strip()
    if t.endswith(("Z", "z")):
        t = t[:-1] + "+00:00"
    m = re.match(r"^(.*T\d{2}:\d{2}:\d{2})\.(\d+)(.*)$", t)
    if m:
        t = f"{m.group(1)}.{m.group(2)[:6]}{m.group(3)}"
    dt = datetime.fromisoformat(t)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def hours_between(a: datetime, b: datetime) -> float:
    return round((b - a).total_seconds() / 3600.0, 2)


def _first_line(text: str) -> str:
    for line in (text or "").splitlines():
        if line.strip():
            return line.strip()
    return ""


# --------------------------------------------------------------------------- events

def classify_message(msg: dict, rid: str) -> dict | None:
    """One thread message -> one chain event, or None for progress chatter."""
    text = msg.get("text") or ""
    first = _first_line(text)
    pr_m = re.search(r"#(\d+)", first)
    head_m = re.search(r"\bhead\s+`?([0-9a-f]{7,40})\b", text, re.IGNORECASE) or re.search(
        r"\*\*Head SHA:\*\*\s*`?([0-9a-f]{7,40})", text
    )
    round_m = re.search(r"\bround\s+(\d)", first, re.IGNORECASE)
    ev = {
        "ts": msg.get("ts"),
        "kind": None,
        "pr": int(pr_m.group(1)) if pr_m else None,
        "head": head_m.group(1) if head_m else None,
        "round": int(round_m.group(1)) if round_m else None,
        "verdict": None,
        "direction": msg.get("direction"),
        "sender": msg.get("sender") or msg.get("role"),
    }
    kind = msg.get("kind")
    esc = re.escape(rid)
    if not kind:
        if re.match(rf"^\[Spec handoff\]\s*{esc}\b", first):
            kind = "spec_handoff"
        elif re.match(rf"^Spec handoff\s+{esc}\b", first):
            kind = "builder_start"
        elif first.startswith("[Blocker]"):
            kind = "blocker"
        elif re.match(rf"^\[Triage Resolution\]\s*{esc}\b", first):
            kind = "triage"
        elif first.startswith("[Test Report]"):
            kind = "test_report"
        elif first.startswith("[Review Verdict]"):
            kind = "review_verdict"
        elif re.match(r"^(Fix report|Verify request|Test re-run request)\s*[—–-]", first) or re.match(
            r"^\[Fix Report\]\s*\S*#\d+", first
        ):
            kind = "handoff"
        elif re.match(r"^Fix review request", first):
            kind = "review_request"
        elif re.match(r"^Merged\s+\S*#\d+", first):
            kind = "merged"
        elif re.match(r"^blocked:\s*STOP", first):
            kind = "stop"
        elif re.match(r"^blocked:\s*P\d", first):
            kind = "gate_red"
        elif re.match(rf"^Supervisor nudge\s+{esc}\b", first):
            kind = "nudge"
        elif re.match(rf"^(Dispatch|Adopt)\s+{esc}\b", first):
            kind = "dispatch"
        elif re.match(r"^(Draft )?PR opened\b", first, re.IGNORECASE) and pr_m:
            kind = "pr_opened"
        else:
            return None
    ev["kind"] = kind
    if kind == "spec_handoff":
        cc = re.search(r"\*\*CORE-CHANGE:\*\*\s*([^\n]*)", text)
        ev["core_change"] = bool(cc and not cc.group(1).strip().lower().startswith("none"))
    elif kind == "triage":
        oc = re.search(r"\*\*Outcome:\*\*\s*(\w+)", text)
        ev["outcome"] = oc.group(1).lower() if oc else None
        ev["merge_gate"] = "## Merge gate" in text
    elif kind == "test_report":
        vm = re.search(r"\*\*Verdict:\*\*\s*([^\n]*)", text)
        vtext = (vm.group(1) if vm else first).upper()
        cap_form = re.search(r"FAIL\s*[×X]\s*2", vtext) is not None
        env_form = re.search(r"FAIL\s*\(\s*(ENV|ENVIRONMENTAL|OUTSIDE[- ]PLUGIN)", vtext) is not None
        ev["escalated_up"] = "ESCALATE" in vtext or "ESCALATE" in first.upper()
        if env_form and not cap_form:
            ev["verdict"] = "FAIL_ENV"  # every failing row outside plugin code: a FAIL to read, never a counted round
        elif cap_form or ("FAIL" in vtext and "ESCALATE" not in vtext):
            ev["verdict"] = "FAIL"  # counted toward the per-cycle cap; the ×2 form is the cap being hit
        elif ev["escalated_up"]:
            ev["verdict"] = "ESCALATE"  # environmental: not a round (hermes-verify rounds.log rule)
        elif "PASS" in vtext:
            ev["verdict"] = "PASS"
        ev["env_fail"] = env_form or bool(
            re.search(r"install_packages|desktop tier unavailable|pre-existing|mergeable UNKNOWN", text, re.IGNORECASE)
        )
        ev["install_packages"] = (
            (re.search(r"install_packages:\s*([^\n]+)", text) or re.search(r"install_packages\s+([^\n]+)", text))
            or [None, None]
        )[1]
    elif kind == "review_verdict":
        vm = re.search(r"\*\*Verdict:\*\*\s*(APPROVE|REQUEST_CHANGES)", text)
        ev["verdict"] = vm.group(1) if vm else ("APPROVE" if "APPROVE" in first else None)
    return ev


def _event_key(ev: dict, first: str) -> tuple:
    return (
        ev["kind"], ev.get("pr"), ev.get("round"), (ev.get("head") or "")[:7], ev.get("verdict"),
        " ".join(first.split()).lower()[:160],
    )


def extract_events(messages: list[dict], rid: str) -> list[dict]:
    """Classify every message on the thread, then drop the cross-session copies.

    The collector reads all five role sessions on a thread, so one send appears twice: as
    the sender's `out` and the receiver's `in`. Counted twice, a single `[Test Report] FAIL`
    would exhaust the 2-round cap. A copy is the same (kind, pr, round, head, verdict, first
    line) within DUP_WINDOW_S of an event already kept; the earliest copy wins. Identical
    texts further apart (two nudges 6 h apart) stay distinct events."""
    events: list[dict] = []
    kept: list[tuple[tuple, datetime]] = []
    for m in sorted(messages, key=lambda x: x.get("ts") or ""):
        ev = classify_message(m, rid)
        if not ev or not ev["ts"]:
            continue
        key = _event_key(ev, _first_line(m.get("text") or ""))
        try:
            ts = parse_iso(ev["ts"])
        except ValueError:
            ts = None
        if ts is not None:
            if any(k == key and abs((ts - t).total_seconds()) <= DUP_WINDOW_S for k, t in kept):
                continue
            kept.append((key, ts))
        events.append(ev)
    return events


def find_pr(prs: list[dict], rid: str, ledger_pr: int | None) -> dict | None:
    tag = f"[{rid}]"
    branch = f"plugin/{rid.lower()}"
    for pr in prs:
        if tag in (pr.get("title") or "") or (pr.get("headRefName") or "") == branch:
            return pr
    if ledger_pr is not None:
        for pr in prs:
            if pr.get("number") == ledger_pr:
                return pr
    return None


# --------------------------------------------------------------------------- resolution

def resolve_stage(rid: str, row: dict, events: list[dict], pr: dict | None, gating: dict, cfg: dict) -> dict:
    """§2.3: terminal states first, then walk the chain backwards to the first evidence."""
    ledger = row.get("ledger") or {}
    res: dict = {
        "pr": (pr or {}).get("number") or ledger.get("pr"),
        "head": (pr or {}).get("headRefOid"),
        "round": None,
        "core_change": any(e.get("core_change") for e in events if e["kind"] == "spec_handoff"),
        "blocker_open": any(e["kind"] == "blocker" for e in events),
        "env_fail": False,
        "install_packages": None,
        "gate_red": ledger.get("gate_red"),
        "triage_present": False,
        "fix_after": None,
    }
    known_pr = res["pr"]
    if known_pr is not None:
        # A report, verdict or hand-off addressed to another PR is another row's traffic (a
        # session attributed by mention, or the operator relaying a report): never a round here.
        foreign = [e for e in events if e["kind"] in PR_EVENT_KINDS and e.get("pr") not in (None, known_pr)]
        if foreign:
            res["ignored_foreign_pr_events"] = len(foreign)
            events = [e for e in events if e not in foreign]
    handoffs = [e for e in events if e["kind"] == "handoff"]
    if res["head"] is None:
        for e in reversed(handoffs):
            if e["head"]:
                res["head"] = e["head"]
                break
    head7 = (res["head"] or "")[:7]

    def same_head(e: dict) -> bool:
        return not head7 or not e.get("head") or e["head"][:7] == head7

    reports = [e for e in events if e["kind"] == "test_report"]
    verdicts = [e for e in events if e["kind"] == "review_verdict"]
    fails = [e for e in reports if e["verdict"] == "FAIL"]
    rcs = [e for e in verdicts if e["verdict"] == "REQUEST_CHANGES"]
    # The tester's FAIL budget is per review cycle: only counted FAILs after the last
    # REQUEST_CHANGES draw on it. FAIL_ENV / ESCALATE reports are not in `fails` at all.
    last_rc_ts = rcs[-1]["ts"] if rcs else ""
    cycle_fails = [e for e in fails if e["ts"] > last_rc_ts]
    res["review_cycle"] = len(rcs)
    res["cycle_fail_count"] = len(cycle_fails)
    res["test_rounds"] = [{"round": e["round"], "head": (e["head"] or "")[:7] or None, "verdict": e["verdict"], "ts": e["ts"]} for e in reports]
    res["review_rounds"] = [{"round": e["round"], "head": (e["head"] or "")[:7] or None, "verdict": e["verdict"], "ts": e["ts"]} for e in verdicts]
    res["fail_count"] = len(fails)
    res["rc_count"] = len(rcs)
    round3_ok = rid in (cfg.get("authorize_round") or {}) or (ledger.get("verdict") or {}).get("round3", False)

    # Terminal states.
    pr_state = (pr or {}).get("state")
    ledger_state = row.get("state")
    merged_confirm = any(e["kind"] == "merged" for e in events)
    if pr_state == "MERGED" or ledger_state == "merged" or merged_confirm:
        res.update(stage="merged", clock=None, reason="fork MERGED" if pr_state == "MERGED" else "ledger/thread says merged")
        if ledger_state == "merged" and pr is not None and pr_state != "MERGED":
            res["drift"] = f"ledger merged, fork PR #{pr.get('number')} is {pr_state}"
        return res
    if ledger_state == "blocked":
        res.update(stage="blocked", clock=None, reason=row.get("state_reason") or "ledger blocked")
        return res
    if pr_state == "CLOSED":
        res.update(stage="blocked", clock=None, reason=f"PR #{pr.get('number')} closed unmerged")
        return res
    if any(e["kind"] == "stop" for e in events):
        res.update(stage="blocked", clock=None, reason="Orchestrator wrote blocked: STOP on the thread")
        return res
    fail_cap = TEST_FAIL_CAP + (1 if round3_ok else 0)  # an authorized extra round lifts this cycle's cap by exactly one
    if len(cycle_fails) >= fail_cap:
        why = "round 3 used" if round3_ok else "no round 3 authorized"
        res.update(stage="blocked", clock=None, reason=f"cap: test FAIL x{len(cycle_fails)} in review cycle {len(rcs)}, {why}")
        return res
    if len(rcs) >= REVIEW_RC_CAP:
        res.update(stage="blocked", clock=None, reason=f"cap: review REQUEST_CHANGES x{len(rcs)}")
        return res
    gate_reds = [e for e in events if e["kind"] == "gate_red"]
    last_handoff_ts = handoffs[-1]["ts"] if handoffs else ""
    if len([e for e in gate_reds if e["ts"] >= last_handoff_ts]) >= 2:
        res.update(stage="blocked", clock=None, reason="cap: merge gate red twice on the same head")
        return res

    triage = [e for e in events if e["kind"] == "triage" and e.get("outcome") == "fixed" and e.get("merge_gate")]
    res["triage_present"] = bool(triage)

    # Walk backwards.
    cur_verdicts = [e for e in verdicts if same_head(e)]
    if cur_verdicts:
        last = cur_verdicts[-1]
        if last["verdict"] == "APPROVE":
            res.update(stage="gate", clock=last["ts"], round=last["round"], reason=f"APPROVE round {last['round']} head {head7 or '?'}")
            return res
        res.update(stage="building", clock=last["ts"], round=last["round"], fix_after=f"REQUEST_CHANGES round {last['round']}", reason="review asked for changes")
        return res
    cur_reports = [e for e in reports if same_head(e)]
    if cur_reports:
        last = cur_reports[-1]
        if last["verdict"] == "PASS":
            res.update(stage="review", clock=last["ts"], round=last["round"], reason=f"[Test Report] PASS round {last['round']}")
            return res
        if last["verdict"] in ("ESCALATE", "FAIL_ENV"):
            res.update(
                stage="testing", clock=last["ts"], round=last["round"], env_fail=True,
                install_packages=last.get("install_packages"),
                reason="[Test Report] ESCALATE (environmental)" if last["verdict"] == "ESCALATE" else "[Test Report] FAIL (env): outside plugin code, not a counted round",
            )
            return res
        res.update(stage="building", clock=last["ts"], round=last["round"], fix_after=f"FAIL round {last['round']}", reason="tester FAIL, new head due")
        return res
    cur_handoffs = [e for e in handoffs if same_head(e)]
    if cur_handoffs:
        k = len(cycle_fails) + 1
        res.update(stage="testing", clock=cur_handoffs[-1]["ts"], round=k, reason=f"hand-off round {k} head {head7 or '?'}")
        return res
    if pr is not None and pr_state == "OPEN":
        clock = pr.get("createdAt")
        if reports and pr.get("updatedAt"):
            clock = max(pr["updatedAt"], reports[-1]["ts"])  # new head after a FAIL: the push
        res.update(stage="pr_open", clock=clock, round=len(cycle_fails) + 1, reason=f"PR #{pr.get('number')} open, head {head7 or '?'} unhanded")
        return res
    pr_opened = [e for e in events if e["kind"] == "pr_opened"]
    if pr_opened:
        res.update(stage="pr_open", clock=pr_opened[-1]["ts"], round=1, reason="PR opened per thread, not seen on the fork")
        res["pr"] = res["pr"] or pr_opened[-1]["pr"]
        return res
    if pr is None and ledger.get("pr"):
        clock = ledger.get("spec_accepted_at") or ledger.get("dispatched_at")
        res.update(stage="pr_open", clock=clock, round=len(cycle_fails) + 1, reason=f"ledger PR #{ledger['pr']}; not on the fork list and no hand-off on the thread (degraded)")
        return res
    starts = [e for e in events if e["kind"] == "builder_start"]
    if starts:
        res.update(stage="building", clock=starts[0]["ts"], round=None, reason="builder holds the row, no PR yet")
        return res
    specs = [e for e in events if e["kind"] == "spec_handoff"]
    if specs or ledger.get("spec_accepted_at"):
        clock = specs[0]["ts"] if specs else ledger["spec_accepted_at"]
        res.update(stage="spec_handoff", clock=clock, reason="[Spec handoff] seen, builder not started")
        return res
    dispatches = [e for e in events if e["kind"] == "dispatch"]
    if ledger.get("dispatched_at") or row.get("dispatched_at") or dispatches:
        clock = ledger.get("dispatched_at") or row.get("dispatched_at") or dispatches[0]["ts"]
        res.update(stage="dispatched", clock=clock, reason="ledger row, no [Spec handoff]")
        return res
    res.update(stage="queued", clock=row.get("eligible_since"), reason="no ledger row, no dispatch")
    return res


def merge_hold(rid: str, row: dict, gating: dict, res: dict, cfg: dict) -> str | None:
    """§4.3 merge holds and §5 core-change hold, evaluated at `gate` only."""
    if rid in (cfg.get("paused_rows") or []):
        return "paused"
    if res["stage"] != "gate":
        return None
    batch = row.get("batch")
    attaches = row.get("attaches_to") or ""
    waits_1a = batch in ("1b", "2") or (batch == "adopt" and attaches in ("P2", "P3-waveA"))
    waits_b2 = batch in ("3", "4") or (batch == "adopt" and attaches == "P5-rooms-veto")
    waits_b34 = batch == "adopt" and attaches == "P6-fleet"
    if waits_1a and not gating.get("1a_merged"):
        return "1a"
    if waits_b2 and not gating.get("batch2_merged"):
        return "batch2"
    if waits_b34 and not (gating.get("batch3_merged") and gating.get("batch4_merged")):
        return "batch3+4"
    if res.get("core_change") and rid not in (cfg.get("core_change_ok") or []):
        return "core-change"
    return None


# --------------------------------------------------------------------------- texts

def expected_artifact(stage: str, res: dict, rid: str, cfg: dict) -> tuple[str, str]:
    pr = res.get("pr")
    head7 = (res.get("head") or "")[:7] or "<sha7>"
    k = res.get("round") or 1
    tag = cfg.get("release_tag") or "v2026.8.31"
    if stage == "dispatched":
        return "[Spec handoff]", "[Spec handoff] with the ADR and acceptance test attached, or a [Blocker] naming what stops you"
    if stage == "spec_handoff":
        return "forward to hermes-builder", "the unmarked forward to hermes-builder with memo, ADR and acceptance test"
    if stage == "building":
        if res.get("fix_after"):
            if str(res["fix_after"]).startswith("REQUEST_CHANGES"):
                return f"new head on PR #{pr}", f"a new head on PR #{pr} addressing the review ({res['fix_after']}), re-entering hermes-tester as review cycle {res.get('review_cycle') or 1} round 1/2"
            return f"new head on PR #{pr}", f"a new head on PR #{pr} fixing the named rows ({res['fix_after']}), re-entering hermes-tester as round {k + 1}/2"
        return "draft PR", f"a draft PR on {FORK}, base release/{tag}-e2e-fixed, titled [{rid}], then the round-1 hand-off to hermes-tester"
    if stage == "pr_open":
        return "hand-off to hermes-tester", f"the round-{k} hand-off to hermes-tester for PR #{pr} head {head7}, with ## Scenarios and the ADR attached"
    if stage == "testing":
        return "[Test Report]", f"[Test Report] PASS or FAIL for PR #{pr} head {head7}, with test-report-{head7}.md attached"
    if stage == "review":
        return "[Review Verdict]", f"[Review Verdict] round j/2 for PR #{pr} head {head7} on the builder's edge"
    if stage == "gate":
        if res.get("triage_present"):
            return "merge gate run", f"the merge gate (merge-gate.md P1-P6) on PR #{pr} head {head7}: merge, hold, or blocked: P<n>"
        return "[Triage Resolution]", f"[Triage Resolution] {rid} with Outcome: fixed and the ## Merge gate block relaying the builder's [Fix Report]"
    return "dispatch", "a dispatch from the dispatch tick (WIP slot is free)"


def alert_texts(now: datetime, rid: str, label: str, age_h: float, what: str, nudges: dict, decision: str, pr: int | None) -> tuple[str, str]:
    n = nudges.get("count") or 0
    last = nudges.get("last") or "never"
    body = (
        f"{rid} · {label} {int(age_h)}h · {what} · nudged {n}× (last {last}) · decision: {decision}"
        f" · PR #{pr if pr is not None else '-'} · thread hermes-{rid}"
    )
    return f"- {iso_utc(now)} · {body}", f"Autopilot alert {body}"


# --------------------------------------------------------------------------- bookkeeping

def nudge_book(raw: dict | None, rid: str, events: list[dict]) -> dict:
    v = (raw or {}).get(rid)
    last = None
    count = 0
    state = None
    alerts: dict = {}
    if isinstance(v, str):
        last, count = v, 1
    elif isinstance(v, dict):
        last = v.get("last_nudge") or v.get("at") or v.get("last")
        count = int(v.get("count") or (1 if last else 0))
        state = v.get("state")
        alerts = dict(v.get("alerts") or {})
    seen = [e["ts"] for e in events if e["kind"] == "nudge"]
    if seen:
        newest = max(seen)
        if last is None or newest > last:
            last = newest
        count = max(count, len(seen))
    return {"last": last, "count": count, "state": state, "alerts": alerts}


def alerted_recently(book: dict, key: str, now: datetime) -> bool:
    ts = (book.get("alerts") or {}).get(key)
    if not ts:
        return False
    try:
        return hours_between(parse_iso(ts), now) < ALERT_BOUND_H
    except ValueError:
        return False


# --------------------------------------------------------------------------- task cards

def _safe_ts(s) -> datetime | None:
    try:
        return parse_iso(s) if isinstance(s, str) and s else None
    except ValueError:
        return None


def card_audit(messages: list[dict], rid: str, now: datetime, grace_minutes: float = CARD_GRACE_MINUTES, since: str | None = None) -> dict:
    """Pair every terminal role marker on the thread with the card caption that followed it.

    Outbound lines only (`direction` != "in": the receiver's copy of a send is the same event), except
    the supervisor's own card nudge, which is read back in either direction (it reaches the thread
    only as the role's inbound copy);
    copies of one marker within DUP_WINDOW_S collapse. A card line ("card · " / "card(html) · ")
    is attributed by the role named in its caption (else its sender) to the latest preceding
    marker of that role that has no card yet, so two [Fix Report]s need two cards. A marker with
    no card is `pending` inside the grace window, `missing` after it, and `nudged` once a later
    "Supervisor nudge <ID>: no task card after your <marker> at <ts>" line sits on the thread."""
    since_dt = _safe_ts(since)
    markers: list[dict] = []
    cards: list[dict] = []
    nudges: list[dict] = []
    esc = re.escape(rid)
    for m in sorted(messages or [], key=lambda x: x.get("ts") or ""):
        text = m.get("text") or ""
        first = _first_line(text)
        ts = _safe_ts(m.get("ts"))
        if ts is None:
            continue
        # Nudge read-back must run BEFORE the inbound skip: the supervise tick sends from the
        # Orchestrator's task session (thread system:tasks:*), which collect_threads never reads,
        # so on a collected hermes-<ROW> thread our own card nudge exists only as the role's "in" copy.
        if re.match(rf"^Supervisor nudge\s+{esc}\b", first) and CARD_NUDGE_MARK in text:
            nudges.append({"ts": ts, "text": text})
            continue
        if m.get("direction") == "in":
            continue
        if text.startswith(CARD_PREFIXES):
            rm = CARD_ROLE_RE.match(first)
            cards.append({"ts": ts, "iso": m.get("ts"), "text": first, "role": rm.group(1) if rm else (m.get("sender") or m.get("role"))})
            continue
        for label, role in CARD_MARKERS.items():
            if not first.startswith(label):
                continue
            if since_dt is not None and ts < since_dt:
                break
            key = " ".join(first.split()).lower()[:160]
            if any(x["label"] == label and x["key"] == key and abs((ts - x["ts"]).total_seconds()) <= DUP_WINDOW_S for x in markers):
                break
            markers.append({"label": label, "role": role, "ts": ts, "iso": m.get("ts"), "first": first[:160], "key": key, "card": None})
            break

    for c in cards:
        pool = [x for x in markers if x["ts"] <= c["ts"] and x["card"] is None and (c["role"] is None or x["role"] == c["role"])]
        if not pool:
            pool = [x for x in markers if x["ts"] <= c["ts"] and (c["role"] is None or x["role"] == c["role"])]
        if pool:
            pool[-1]["card"] = pool[-1]["card"] or c["iso"]

    out = {"markers": len(markers), "carded": 0, "pending": [], "missing": [], "nudged": []}
    for i, x in enumerate(markers):
        entry = {"marker": x["label"], "role": x["role"], "ts": x["iso"], "first": x["first"]}
        if x["card"]:
            out["carded"] += 1
            continue
        age_min = (now - x["ts"]).total_seconds() / 60.0
        entry["age_minutes"] = round(age_min, 1)
        if age_min < grace_minutes:
            out["pending"].append(entry)
            continue
        later_same = [y["ts"] for y in markers[i + 1:] if y["label"] == x["label"]]
        nudged = any(
            n["ts"] >= x["ts"] and x["label"] in n["text"]
            and ((x["iso"] and x["iso"] in n["text"]) or not any(t < n["ts"] for t in later_same))
            for n in nudges
        )
        out["nudged" if nudged else "missing"].append(entry)
    return out


def card_check(tick: _Tick, rec: dict, thread_msgs: list[dict] | None, cfg: dict) -> None:
    """card_missing: at most one card nudge per row per tick, only when the row drew no other
    nudge or escalation this tick and its 6 h nudge bound has lapsed. Merged, blocked, cost-held
    and unreadable rows are left to the ordinary path (they are never nudged). `card_check: false`
    in config.json switches the check off (a fleet whose roles do not carry hermes-task-card yet)."""
    if not cfg.get("card_check", True):
        return
    if not isinstance(thread_msgs, list) or rec.get("stage") in ("merged", "blocked") or rec.get("cost_hold"):
        return
    try:
        grace = float(cfg.get("card_grace_minutes", CARD_GRACE_MINUTES))
    except (TypeError, ValueError):
        grace = float(CARD_GRACE_MINUTES)
    audit = card_audit(thread_msgs, rec["id"], tick.now, grace, cfg.get("card_missing_since"))
    rec["cards"] = audit
    if not audit["missing"]:
        return
    tick.summary["card_missing"] += len(audit["missing"])
    if rec.get("action") != "none":
        return
    last = (rec.get("nudges") or {}).get("last")
    last_dt = _safe_ts(last)
    if last_dt is not None and hours_between(last_dt, tick.now) < NUDGE_BOUND_H:
        rec["reason"] = (rec.get("reason") or "") + f"; card nudge bound: last nudge {round(hours_between(last_dt, tick.now), 1)}h ago"
        return
    m = audit["missing"][0]
    text = CARD_NUDGE_TEMPLATE.format(
        id=rec["id"], mark=CARD_NUDGE_MARK, marker=m["marker"], ts=m["ts"], m=int(m.get("age_minutes") or 0), role=m["role"],
    )
    rec["target_role"] = m["role"]
    tick.nudge(rec, m["role"], text)
    tick.actions[-1].update(check="card_missing", marker=m["marker"], marker_ts=m["ts"])


# --------------------------------------------------------------------------- main

def pick_target_session(rows: list[dict] | None, role: str | None) -> dict | None:
    """The one session a nudge to `role` on this row must land in, or None when unknown.

    NanoClaw keys agent-to-agent sessions on (recipient, sender->recipient messaging group,
    thread), so a nudge sent WITHOUT a pin opens a second session for the role on the same row
    next to the one the chain hand-off created (seen on LOOP-F35: an architect-created builder
    session doing the work and an Orchestrator-created "Supervisor nudge" twin). Pinning the
    existing session with send_message(target_session_id=...) keeps one live session per role
    per row. Preference: an active session with a running container, then any active session,
    then the most recently active one; ties break on the newest last_active.
    """
    if not rows or not role:
        return None
    want = str(role).strip().lower()
    mine = [r for r in rows if str(r.get("role") or "").strip().lower() == want and r.get("session_id")]
    if not mine:
        return None

    def rank(r: dict) -> tuple:
        active = (r.get("status") or "active").lower() == "active"
        running = (r.get("container_status") or "").lower() == "running"
        return (1 if active and running else 0, 1 if active else 0, r.get("last_active") or "")

    best = max(mine, key=rank)
    return best


class _Tick:
    """Per-tick sinks (alerts, actions, summary) plus the 24 h alert bound."""

    def __init__(self, now_dt: datetime, sessions: dict | None = None) -> None:
        self.now = now_dt
        self.sessions = sessions or {}
        self.actions: list[dict] = []
        self.alerts: list[dict] = []
        self.summary = {"in_flight": 0, "must_nudge": 0, "escalate": 0, "hold": 0, "cost_hold": 0, "blocked": 0, "gate": 0, "card_missing": 0}

    def escalate(self, rec: dict, book: dict, kind: str, label: str, age_h: float, what: str, decision: str) -> None:
        key = f"{kind}:{label}"
        if alerted_recently(book, key, self.now):
            rec["slo_status"] = "escalated"
            return
        rid = rec["id"]
        line, status = alert_texts(self.now, rid, label, age_h, what, book, decision, rec["pr"])
        rec.update(action="escalate", alert_kind=kind, message=line, alert_line=line, status_line=status, slo_status="escalated")
        self.alerts.append({"kind": kind, "row": rid, "state": label, "line": line, "status_line": status, "alert_key": key})
        self.actions.append({
            "kind": "alert", "row": rid, "alert_kind": kind, "alert_key": key,
            "text": line, "status_text": status, "thread_id": "hermes-status",
        })
        self.summary["escalate"] += 1

    def nudge(self, rec: dict, role: str, text: str) -> None:
        rec.update(action="nudge", message=text)
        target = pick_target_session(self.sessions.get(rec["thread_id"]), role)
        sid = target.get("session_id") if target else None
        rec["target_session_id"] = sid
        self.actions.append({
            "kind": "nudge", "row": rec["id"], "target_role": role, "thread_id": rec["thread_id"], "text": text,
            # Pin the role's existing session on this row: without it the send opens a second
            # session for the role (see pick_target_session). null = no known session; the
            # Orchestrator then sends unpinned and the routing fallback applies.
            "target_session_id": sid,
            "target_session_note": (
                f"pin: existing {role} session on this thread"
                f" ({(target.get('container_status') or 'unknown')} container, {(target.get('status') or 'active')})"
                if sid else "no known session for this role on the thread; unpinned send"
            ),
        })
        self.summary["must_nudge"] += 1


def _new_record(rid: str, res: dict, last_activity: str | None, book: dict) -> dict:
    stage = res["stage"]
    return {
        "id": rid,
        "thread_id": f"hermes-{rid}",
        "stage": stage,
        "stage_label": f"testing({res['round']})" if stage == "testing" and res.get("round") else stage,
        "round": res.get("round"),
        "reason": res.get("reason"),
        "clock_start": res.get("clock"),
        "last_activity": last_activity,
        "age_hours": None,
        "nudge_after_h": None,
        "escalate_after_h": None,
        "slo_breach": False,
        "escalation_due": False,
        "slo_status": "n/a",
        "hold": None,
        "cost_hold": False,
        "cost_hold_sessions": [],
        "env_fail": res.get("env_fail", False),
        "blocker_open": res.get("blocker_open", False),
        "core_change": res.get("core_change", False),
        "gate_red": res.get("gate_red"),
        "triage_present": res.get("triage_present", False),
        "pr": res.get("pr"),
        "head": (res.get("head") or "")[:7] or None,
        "test_rounds": res.get("test_rounds", []),
        "review_rounds": res.get("review_rounds", []),
        "fail_count": res.get("fail_count", 0),
        "cycle_fail_count": res.get("cycle_fail_count", 0),
        "review_cycle": res.get("review_cycle", 0),
        "rc_count": res.get("rc_count", 0),
        "nudges": {"last": book["last"], "count": book["count"], "in_state": False},
        "action": "none",
        "target_role": None,
        "message": None,
        "alert_line": None,
        "status_line": None,
        "alert_kind": None,
        "cards": None,
    }


def supervise_row(tick: _Tick, rid: str, row: dict, thread_msgs: list[dict] | None, prs: list[dict], gating: dict, cfg: dict, nudges: dict | None, sessions: dict | None) -> dict:
    rec = _supervise_row_core(tick, rid, row, thread_msgs, prs, gating, cfg, nudges, sessions)
    card_check(tick, rec, thread_msgs, cfg)
    return rec


def _supervise_row_core(tick: _Tick, rid: str, row: dict, thread_msgs: list[dict] | None, prs: list[dict], gating: dict, cfg: dict, nudges: dict | None, sessions: dict | None) -> dict:
    thread = f"hermes-{rid}"
    thread_ok = isinstance(thread_msgs, list)
    events = extract_events(thread_msgs if thread_ok else [], rid)
    pr = find_pr(prs, rid, (row.get("ledger") or {}).get("pr"))
    res = resolve_stage(rid, row, events, pr, gating, cfg)
    stage = res["stage"]
    book = nudge_book(nudges, rid, events)
    stamps = [e["ts"] for e in events] + [t for t in ((pr or {}).get("updatedAt"), (pr or {}).get("createdAt")) if t]
    rec = _new_record(rid, res, max(stamps) if stamps else None, book)
    rec["thread_ok"] = thread_ok
    if res.get("drift"):
        tick.alerts.append({"kind": "ledger-drift", "row": rid, "detail": res["drift"]})

    if stage == "merged":
        return rec
    if not thread_ok and stage != "blocked":
        # Degrade, never guess: no nudge for a row whose sessions could not be read.
        tick.summary["in_flight"] += 1
        rec["reason"] = f"thread hermes-{rid} unreadable this tick; no action"
        rec["slo_status"] = "unknown"
        return rec
    if stage == "blocked":
        tick.summary["blocked"] += 1
        tick.escalate(rec, book, "blocked", "blocked", 0.0, res.get("reason") or "blocked", "re-dispatch by hand once (autopilot never will), or drop the row")
        return rec

    tick.summary["in_flight"] += 1
    clock = res.get("clock")
    age_h = max(0.0, hours_between(parse_iso(clock), tick.now)) if clock else 0.0
    rec["age_hours"] = age_h
    nudge_h, role, esc_h = SLO.get(stage, (None, None, None))
    if stage == "gate" and res.get("triage_present"):
        role = ORCHESTRATOR
    rec["nudge_after_h"], rec["escalate_after_h"] = nudge_h, esc_h
    rec["target_role"] = role

    # cost_hold: a human card is pending; the container cannot take a turn, so never nudge.
    cost_rows = [s for s in ((sessions or {}).get(thread) or []) if (s.get("cost_status") or "").lower() in ("escalated", "stopped")]
    if cost_rows:
        rec["cost_hold"] = True
        rec["cost_hold_sessions"] = [{"role": s.get("role"), "session_id": s.get("session_id"), "cost_status": s.get("cost_status")} for s in cost_rows]
        tick.summary["cost_hold"] += 1
        sid = cost_rows[0].get("session_id") or "?"
        tick.escalate(
            rec, book, "cost-card", stage, age_h,
            f"{cost_rows[0].get('role') or 'a role'} session {sid} is {cost_rows[0].get('cost_status')} on its cost cap",
            f"Continue or Stop on the dashboard cost card for session {sid}",
        )
        return rec

    hold = merge_hold(rid, row, gating, res, cfg)
    if hold:
        rec["hold"] = hold
        tick.summary["hold"] += 1
        tick.actions.append({"kind": "hold", "row": rid, "hold": hold, "pr": rec["pr"], "text": f"hold: {hold} — do not gh pr ready or merge PR #{rec['pr']} for {rid} yet"})
        if hold in ("1a", "batch2", "batch3+4") and gating.get("1a_blocked"):
            tick.escalate(rec, book, "blocked-twice", stage, age_h, f"held on {hold} and LOOP-F35 is blocked; the port cannot proceed", "unblock or re-dispatch LOOP-F35 by hand")
        elif age_h >= HOLD_TOO_LONG_H:
            tick.escalate(rec, book, "hold-too-long", stage, age_h, f"merge held on {hold} for {int(age_h)}h", f"merge the {hold} dependency (or waive it in config.json) so held rows can merge")
        return rec

    if stage == "gate" and res.get("triage_present"):
        tick.summary["gate"] += 1
        tick.actions.append({"kind": "gate", "row": rid, "pr": rec["pr"], "head": rec["head"], "text": f"run merge-gate.md for {FORK}#{rec['pr']} head {rec['head'] or '?'} ({rid})"})

    if rec["env_fail"]:
        pkgs = res.get("install_packages") or "see the tester's report"
        authorized = rid in (cfg.get("authorize_round") or {})
        tick.escalate(
            rec, book, "env-fail", rec["stage_label"], age_h,
            f"[Test Report] ESCALATE round {res.get('round')}: environmental failure ({pkgs})",
            "already authorized: wait for the re-run" if authorized else "authorize one extra test round (autopilot §5, once per review cycle) or file install_packages",
        )
        return rec

    if nudge_h is None:
        return rec
    if book["state"]:
        in_state = bool(book["last"]) and book["state"] == stage
    else:
        in_state = bool(book["last"]) and clock is not None and book["last"] >= clock
    rec["nudges"]["in_state"] = in_state
    rec["slo_breach"] = age_h >= nudge_h
    rec["escalation_due"] = age_h >= esc_h
    since_nudge_h = hours_between(parse_iso(book["last"]), tick.now) if book["last"] else None
    rec["slo_status"] = "ok" if not rec["slo_breach"] else ("nudged" if in_state else "breached")
    short, expected = expected_artifact(stage, res, rid, cfg)
    if rec["escalation_due"] and (in_state or role is None):
        tick.escalate(
            rec, book, "slo", rec["stage_label"], age_h,
            f"no {short} for {int(age_h)}h (SLO {int(esc_h)}h)",
            f"nudge {role} by hand (hermes-check.sh, intervention 1), restart its container (ncl groups restart), or pause the row",
        )
    elif rec["slo_breach"] and role and (since_nudge_h is None or since_nudge_h >= NUDGE_BOUND_H):
        tick.nudge(rec, role, NUDGE_TEMPLATE.format(id=rid, state=rec["stage_label"], h=int(age_h), short=short, expected=expected))
    elif rec["slo_breach"]:
        rec["reason"] = (rec["reason"] or "") + f"; nudge bound: last nudge {round(since_nudge_h or 0, 1)}h ago (< {int(NUDGE_BOUND_H)}h)"
    return rec


def supervise(
    state: dict,
    threads: dict,
    prs: list[dict],
    nudges: dict | None,
    now: str,
    sessions: dict | None = None,
    config: dict | None = None,
) -> dict:
    tick = _Tick(parse_iso(now), sessions)
    cfg = config or {}
    gating = state.get("gating") or {}
    rows_in = state.get("rows") or {}
    candidates = [r for r in rows_in if rows_in[r].get("state") in IN_FLIGHT or rows_in[r].get("state") == "blocked"]
    for r in state.get("in_flight") or []:
        if r not in candidates and r in rows_in:
            candidates.append(r)

    out_rows = {
        rid: supervise_row(tick, rid, rows_in[rid], threads.get(f"hermes-{rid}", []), prs, gating, cfg, nudges, sessions)
        for rid in sorted(candidates)
    }
    order = {"hold": 0, "gate": 1, "nudge": 2, "alert": 3}
    tick.actions.sort(key=lambda a: (order.get(a["kind"], 9), a.get("row") or ""))
    return {"now": iso_utc(tick.now), "rows": out_rows, "actions": tick.actions, "alerts": tick.alerts, "summary": tick.summary}


def _read_json(path: str | None, default):
    if not path:
        return default
    p = Path(path)
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8") or "null") or default


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="hermes_supervise.py",
        description="Hermes port chain supervisor: stage per in-flight row, SLO check, bounded nudge or escalation (autopilot.md §2-§5).",
    )
    ap.add_argument("--state", required=True, help="state.json from hermes_queue.py")
    ap.add_argument("--threads", required=True, help='{"hermes-<ID>": [{ts, direction, text}, ...]}')
    ap.add_argument("--prs", required=True, help="gh pr list --json ... output for the fork")
    ap.add_argument("--nudges", help="nudge ledger JSON (row -> last nudge ts, or row -> {last_nudge, state, count, alerts})")
    ap.add_argument("--sessions", help='optional {"hermes-<ID>": [{role, session_id, cost_status, container_status}]}')
    ap.add_argument("--config", help="optional config.json (paused_rows, core_change_ok, authorize_round, release_tag)")
    ap.add_argument("--now", required=True, help="ISO timestamp, e.g. 2026-09-09T12:00:00Z")
    ap.add_argument("--json", action="store_true", help="compact JSON on one line (default: indented)")
    args = ap.parse_args(argv)

    out = supervise(
        _read_json(args.state, {}),
        _read_json(args.threads, {}),
        _read_json(args.prs, []),
        _read_json(args.nudges, {}),
        args.now,
        sessions=_read_json(args.sessions, {}),
        config=_read_json(args.config, {}),
    )
    if args.json:
        print(json.dumps(out, separators=(",", ":"), sort_keys=True))
    else:
        print(json.dumps(out, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
