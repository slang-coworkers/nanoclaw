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
  --nudges   {"<ID>": "<ISO>"} or {"<ID>": {"last_nudge", "state", "count", "alerts": {"<key>": "<ISO>"},
             "texts": [recorded nudge/re-arm texts], "rearms": [{"at": ISO, "text"}] (the sent re-arms, timed)}}
  --sessions optional {"hermes-<ID>": [{"role", "session_id", "cost_status", "container_status", "status", "last_active"}]}
             (nudge actions pin the role's live session as target_session_id — one live session per role per row)
             for cost_hold (`escalated` / `stopped`); absent means no signal
  --acks     optional acks.json from collect-acks.sh (host-side, every 15 min):
             {"generated_at": ISO, "sessions": {"<session_id>": {"status": "completed|processing|bounced-transient|...",
             "changed": ISO, "role": "hermes-architect", "thread_id": "hermes-<ID>"[, "container_status"]}}}
             — the newest processing_ack row per session. Missing, malformed or older than ACKS_STALE_H (2 h):
             the bounce and idle-turn detections below are OFF for the tick (`acks.status`, never a guess)
  --config   optional config.json (paused_rows, core_change_ok, authorize_round, release_tag,
             card_check, card_grace_minutes, card_missing_since)
  --now      ISO timestamp

Output: {"now", "rows": {ID: {...}}, "actions": [...], "alerts": [...], "summary": {...}, "acks": {...}}.
Per row: stage, stage_label, clock_start, last_activity, age_hours, slo_breach,
escalation_due, hold, cost_hold, infra_hold, bounced, idle_turn, action (none | nudge | escalate),
target_role, message (the nudge text or the alerts.md line), alert_line, status_line, pr, head, rounds, cards.

Three stall shapes the chain markers do not show (autopilot.md §2.5; the 2026-09-15/16 stalls):

  infra_hold  a role's OUTBOUND line whose first line is `blocked (infra`, `Hold (NOT a verdict` or
              `HOLD on <ID>` (case-insensitive), or whose first three lines say "pending an operator
              ruling" / "awaiting (an) operator". The hold STANDS while nothing came after it: no progress
              marker (PROGRESS_KINDS) and no later outbound line by the same role that is not itself a
              hold — a role that wrote `codex is back — resuming` or `PR opened #7` has moved on. While
              standing: the stage is unchanged, `infra_hold` is set, one `infra-hold` (or `operator-ruling`,
              when the text names an operator ruling) alert fires at once (24 h bound), the Orchestrator gets
              one re-arm nudge per hold TEXT (key: role + the normalised first line, so hourly restatements
              of the same hold draw nothing new), and the row's ordinary SLO check still runs (a re-armed
              role that stalls again is caught by the `slo` nudge/alert, not hidden behind the hold).
              A paused row (config `paused_rows`) stays silent, like every other paused-row action.
  bounced     the owing role's newest session on the thread has an ack `bounced-*` newer than the role's
              last outbound line: no turn happened. The Orchestrator gets one re-arm nudge per ack
              timestamp, at once. `bounced-transient` is a recognised provider-outage signature: the prompt
              probes the dependency before sending and never spawns a fresh session for it; only
              `bounced-unknown` may fall back to a fresh session when the warm one refuses the send.
              A later bounce after a re-arm was SENT is the `bounce-repeat` alert and NOTHING ELSE: no
              second re-arm while the newest ack is still `bounced-*` — the supervisor is the only
              redriver here (host-sweep skips a session whose container is up), and one re-arm per
              outage is the whole budget; the operator spawns fresh by hand (the alert's decision).
  idle_turn   the owing role's newest session acked `completed` at T, its container is not running, no
              marker followed T, and T is ≥ half the stage's nudge SLO (min 1 h) old: the role's turn
              ended without the hand-off. The `completed` ack is stamped AFTER the turn's outputs, so a
              turn that ended with the alternative artifact — a `[Blocker]` or a hold by that role as its
              newest line, or any blocker/hold it wrote since the inbound that started the turn — is not
              idle. The role is nudged EARLY (the §3 template plus the sentence "Your turn at T ended
              without the <marker>"), once per T, never on top of the SLO nudge for the same marker,
              inside the 6 h row bound.

Re-arm nudges (`check` infra_hold / bounced) target the ORCHESTRATOR: it owns the row and re-arms the
role itself (`rearm_role`, `rearm_text`, `rearm_session_id` on the action). Their text starts
"Supervisor re-arm <ID> · <role>:" — read back from the thread or the recorded texts for the
once-per-event bound, never classified as a `nudge`, so they neither consume nor honour the 6 h row
bound. One more cap on top of the per-event keys: at most one SENT re-arm per (row, role) per
NUDGE_BOUND_H (the role's `in` copy on the thread, or the recorded `rearms` with their `at`), so two
detections firing on one role inside the window still open at most one extra turn for it.

card_missing (hermes-task-card): every terminal role marker on the thread ([Spec handoff],
[Triage Resolution], [Fix Report], [Fix Review Request], [Test Report], [Review Verdict]) owes
one LATER outbound line starting "card · " or "card(html) · " (the send_file caption). A marker
older than `card_grace_minutes` (default 20) with no such line draws one nudge to the role that
sent it, through the ordinary nudge machinery (one nudge per row per tick, the 6 h row bound,
SLO nudges first). "Once per marker": the nudge names the marker and its timestamp, so the next
tick reads its own nudge back from the thread and does not repeat it. `card_missing_since`
(ISO, optional) ignores markers older than that, for threads that predate the card skill.

Carried criteria (ledger.md § Carried criteria, read by hermes_queue into each row's
`carries_criteria`): a row at `gate` with open criteria carried onto it gets them appended to the
gate action text ("carried criteria to verify in the ADR/Test Report: AC-..."), and a row that is
`merged` while a criterion carried TO it is still open draws one `carried-open` alert ("merged
with open carried criterion AC-... — mark covered or re-carry"), 24 h bound like every alert.
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
# A later one of these clears an infra hold: the chain markers plus every "the role is working again" line
# (builder_start, pr_opened, review_request) and the alternative artifact ([Blocker]). So does any later plain
# outbound line by the holding role (detect_infra_hold).
PROGRESS_KINDS = ("spec_handoff", "handoff", "test_report", "review_verdict", "triage", "merged", "pr_opened", "builder_start", "review_request", "blocker")
BOUNCE_TRANSIENT = "bounced-transient"  # host-sweep's provider-outage signature: probe before re-arming, never spawn fresh for it
ACKS_STALE_H = 2.0  # acks.json older than this: bounce and idle-turn detection are off for the tick (never guess)
REARM_PREFIX = "Supervisor re-arm"  # the re-arm line (Orchestrator-facing and role-facing); read back like a card nudge, never a 6 h-bound nudge
OPERATOR_PHRASES = ("pending an operator ruling", "awaiting operator", "awaiting an operator")
ACKS_OFF_NOTE = "acks stale/missing — bounce and idle detection off"

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
ROW_ID_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,4}-F\d+(?:\.[a-z])?)\b")  # matrix row ids named in a message line
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

def _strip_md(s: str) -> str:
    """Drop bold/italic asterisks and backticks, so `**operator ruling**` reads as `operator ruling`."""
    return re.sub(r"[*`]", "", s or "")


def _head_lines(text: str, n: int) -> list[str]:
    out: list[str] = []
    for line in (text or "").splitlines():
        if line.strip():
            out.append(line.strip())
            if len(out) >= n:
                break
    return out


def _infra_hold_line(first: str, text: str, rid: str) -> bool:
    """§2.5 infra/operator hold: the three real first-line shapes of 2026-09-15/16, or an operator
    phrase in the first three lines. Case-insensitive; markdown emphasis is ignored."""
    f = _strip_md(first)
    if re.match(r"^blocked \(infra", f, re.IGNORECASE) or re.match(r"^hold \(not a verdict", f, re.IGNORECASE):
        return True
    if re.match(rf"^hold on {re.escape(rid)}\b", f, re.IGNORECASE):
        return True
    head = " ".join(_strip_md(line).lower() for line in _head_lines(text, 3))
    return any(p in head for p in OPERATOR_PHRASES)


def _codex_cause(text: str) -> str | None:
    """The phrase after the first `codex` up to the end of its line (the failing dependency), or None."""
    for line in (text or "").splitlines():
        m = re.search(r"\bcodex\b[:\s]*(.+)$", _strip_md(line), re.IGNORECASE)
        if m and m.group(1).strip():
            return m.group(1).strip()[:200]
    return None


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
            # A merge notice is this row's only when the Orchestrator wrote it on THIS thread and it
            # names no other row. The dashboard merge line for one row fans into every hermes-<ROW>
            # thread as an "in" copy (cross-session context), which read as "merged" for CRED-F28 and
            # ISO-F14 on 2026-09-15 while both were stalled at the architect — hiding a 20 h stall.
            if msg.get("direction") == "in":
                return None
            named = set(ROW_ID_RE.findall(first))
            if named and rid not in named:
                return None
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
        elif msg.get("direction") != "in" and _infra_hold_line(first, text, rid):
            # Outbound only: the receiver's `in` copy of the same hold is the same event, and an operator's
            # own inbound hold is not a role stalling. Last in the chain: a marker line is never a hold.
            kind = "infra_hold"
        else:
            return None
    ev["kind"] = kind
    if kind == "infra_hold":
        ev["hold_text"] = _strip_md(first)[:200]
        ev["infra_cause"] = _codex_cause(text)
        ev["operator_ruling"] = "operator ruling" in _strip_md(text).lower()
    elif kind == "spec_handoff":
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
        env_proof = re.search(r"\*\*Env cause:\*\*", text) is not None
        if env_form and not cap_form and env_proof:
            ev["verdict"] = "FAIL_ENV"  # every failing row outside plugin code, WITH the Env cause proof: never a counted round
        elif env_form and not cap_form:
            ev["verdict"] = "FAIL"  # 'FAIL (env)' without an Env cause line is not exempt (hermes-verify verdict rule): it counts
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

def _role_plain_out_after(thread_msgs: list[dict] | None, role: str | None, after_ts: str, rid: str) -> bool:
    """Did `role` write any OUTBOUND line after `after_ts` that is not itself a hold? (`codex is back — resuming`,
    a status update, a PR line: the role moved on, whatever the stage says.) Supervisor lines are never the role's."""
    if not role:
        return False
    want = str(role).lower()
    for m in thread_msgs or []:
        if m.get("direction") == "in" or not m.get("ts") or m["ts"] <= after_ts:
            continue
        if str(m.get("role") or m.get("sender") or "").lower() != want:
            continue
        text = m.get("text") or ""
        first = _first_line(text)
        if re.match(r"^Supervisor (?:nudge|re-arm)\b", first) or _infra_hold_line(first, text, rid):
            continue
        return True
    return False


def detect_infra_hold(events: list[dict], thread_msgs: list[dict] | None = None, rid: str = "") -> dict | None:
    """§2.5: the newest infra/operator hold still STANDING on the thread, or None. A hold stands until either a
    progress marker (PROGRESS_KINDS: the chain markers, `PR opened`, the builder start, a review request, a
    [Blocker]) is as new or newer, or the holding role itself wrote a later plain outbound line — then the
    role moved on (resumed, restated progress, opened the PR) and re-arming it would interrupt live work.
    Never changes the stage."""
    holds = [e for e in events if e["kind"] == "infra_hold" and e.get("ts")]
    if not holds:
        return None
    progress = [e["ts"] for e in events if e["kind"] in PROGRESS_KINDS and e.get("ts")]
    floor = max(progress) if progress else ""
    standing = [
        e for e in holds
        if e["ts"] > floor and not _role_plain_out_after(thread_msgs, e.get("sender"), e["ts"], rid)
    ]
    if not standing:
        return None
    newest = max(standing, key=lambda e: e["ts"])
    # Every standing hold names the same outage from its own side; the most descriptive `codex …` phrase
    # among them is the dependency the operator should check.
    causes = [e.get("infra_cause") for e in standing if e.get("infra_cause")]
    return {
        "ts": newest["ts"],
        "text": newest.get("hold_text"),
        "cause": max(causes, key=len) if causes else None,
        "role": newest.get("sender"),
        "roles": sorted({e.get("sender") for e in standing if e.get("sender")}),
        "operator_ruling": any(e.get("operator_ruling") for e in standing),
        "count": len(standing),
    }


def resolve_stage(rid: str, row: dict, events: list[dict], pr: dict | None, gating: dict, cfg: dict, thread_msgs: list[dict] | None = None) -> dict:
    """§2.3: terminal states first, then walk the chain backwards to the first evidence."""
    ledger = row.get("ledger") or {}
    res: dict = {
        "pr": (pr or {}).get("number") or ledger.get("pr"),
        "head": (pr or {}).get("headRefOid"),
        "round": None,
        "core_change": any(e.get("core_change") for e in events if e["kind"] == "spec_handoff"),
        "blocker_open": any(e["kind"] == "blocker" for e in events),
        "infra_hold": detect_infra_hold(events, thread_msgs, rid),
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
    texts: list[str] = []
    rearms: list[dict] = []
    if isinstance(v, str):
        last, count = v, 1
    elif isinstance(v, dict):
        last = v.get("last_nudge") or v.get("at") or v.get("last")
        count = int(v.get("count") or (1 if last else 0))
        state = v.get("state")
        alerts = dict(v.get("alerts") or {})
        # recorded nudge / re-arm texts (pull-state.sh): the once-per-event bound reads its keys back from them
        texts = [t for t in (v.get("texts") or []) if isinstance(t, str)]
        # the SENT re-arms with their record time: the per-(row, role) re-arm cap needs the `at`, not just the text
        rearms = [r for r in (v.get("rearms") or []) if isinstance(r, dict) and isinstance(r.get("text"), str) and r.get("at")]
    seen = [e["ts"] for e in events if e["kind"] == "nudge"]
    if seen:
        newest = max(seen)
        if last is None or newest > last:
            last = newest
        count = max(count, len(seen))
    return {"last": last, "count": count, "state": state, "alerts": alerts, "texts": texts, "rearms": rearms}


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


def acks_status(acks, now_dt: datetime) -> dict:
    """What --acks gave us: `ok`, `stale` (generated_at older than ACKS_STALE_H) or `missing` (absent or
    malformed). Anything but `ok` switches the bounce and idle-turn detections off for the tick."""
    if not isinstance(acks, dict) or not isinstance(acks.get("sessions"), dict):
        return {"status": "missing", "generated_at": None, "age_hours": None, "sessions": 0, "note": ACKS_OFF_NOTE}
    n = len(acks["sessions"])
    gen = _safe_ts(acks.get("generated_at"))
    if gen is None:
        return {"status": "missing", "generated_at": acks.get("generated_at"), "age_hours": None, "sessions": n, "note": ACKS_OFF_NOTE}
    age = hours_between(gen, now_dt)
    if age > ACKS_STALE_H:
        return {"status": "stale", "generated_at": iso_utc(gen), "age_hours": age, "sessions": n, "note": ACKS_OFF_NOTE}
    return {"status": "ok", "generated_at": iso_utc(gen), "age_hours": age, "sessions": n, "note": None}


def role_ack(acks: dict | None, thread: str, role: str | None) -> dict | None:
    """The newest ack across `role`'s sessions on `thread` (max `changed`), or None."""
    if not acks or not role:
        return None
    want = str(role).strip().lower()
    best: dict | None = None
    for sid, a in acks.items():
        if not isinstance(a, dict) or a.get("thread_id") != thread or str(a.get("role") or "").strip().lower() != want:
            continue
        dt = _safe_ts(a.get("changed"))
        if dt is None:
            continue
        if best is None or dt > best["changed_dt"]:
            best = {
                "session_id": sid, "status": str(a.get("status") or ""), "changed_dt": dt, "changed": iso_utc(dt),
                "container_status": a.get("container_status"),
            }
    return best


def _role_last_out(thread_msgs: list[dict] | None, role: str) -> datetime | None:
    """When the role last wrote on the thread (its `out` lines; `role` is the session owner, `sender` the fallback)."""
    want = role.lower()
    best: datetime | None = None
    for m in thread_msgs or []:
        if m.get("direction") == "in":
            continue
        if str(m.get("role") or m.get("sender") or "").lower() != want:
            continue
        ts = _safe_ts(m.get("ts"))
        if ts is not None and (best is None or ts > best):
            best = ts
    return best


def _container_status(sessions: dict | None, thread: str, ack: dict) -> str | None:
    """The acked session's container status from --sessions (the live list), else from the ack itself, else unknown."""
    for s in (sessions or {}).get(thread) or []:
        if s.get("session_id") == ack["session_id"] and s.get("container_status"):
            return str(s["container_status"])
    cs = ack.get("container_status")
    return str(cs) if cs else None


_SUPERVISOR_LINE = r"^Supervisor (?:nudge|re-arm)\s+{esc}\b"


def _rearm_pat(rid: str, role: str | None) -> re.Pattern:
    """The first line of a re-arm for this row — and, when `role` is given, for this role: the texts carry
    it as `Supervisor re-arm <ID> · <role>:`, so an architect re-arm is never read as the builder's."""
    if role:
        return re.compile(rf"^{re.escape(REARM_PREFIX)}\s+{re.escape(rid)}\s+·\s+{re.escape(role)}:")
    return re.compile(rf"^{re.escape(REARM_PREFIX)}\s+{re.escape(rid)}\b")


def _marked_nudge_seen(thread_msgs: list[dict] | None, rid: str, book: dict, key: str, role: str | None = None) -> bool:
    """The once-per-event bound: a supervisor line for this row carrying `key` already exists — on the
    thread (either direction: the tick sends from the task session, so on a collected row thread its own
    line is the role's `in` copy) or among the recorded nudge texts. Same idea as the card nudge's marker ts.
    With `role`, only a re-arm line addressed to that role counts."""
    pat = _rearm_pat(rid, role) if role else re.compile(_SUPERVISOR_LINE.format(esc=re.escape(rid)))
    for m in thread_msgs or []:
        text = m.get("text") or ""
        if key in text and pat.match(_first_line(text)):
            return True
    return any(key in t and pat.match(_first_line(t)) for t in (book.get("texts") or []))


def _rearm_bounce_before(thread_msgs: list[dict] | None, book: dict, rid: str, role: str, changed_dt: datetime) -> str | None:
    """A re-arm already sent to `role` for an EARLIER bounce of this row (the ts it named), or None. The role
    is required: an architect re-arm on the thread must not make the builder's first bounce a repeat."""
    pat = _rearm_pat(rid, role)
    found: list[str] = []
    for text in [m.get("text") or "" for m in (thread_msgs or [])] + list(book.get("texts") or []):
        if not pat.match(_first_line(text)):
            continue
        for m in re.finditer(r"turn at (\S+) ended bounced", text):
            dt = _safe_ts(m.group(1))
            if dt is not None and dt < changed_dt:
                found.append(iso_utc(dt))
    return max(found) if found else None


def _recent_rearm(thread_msgs: list[dict] | None, book: dict, rid: str, role: str, now: datetime) -> float | None:
    """Hours since the newest re-arm SENT to `role` on this row inside NUDGE_BOUND_H, or None. Read from the
    role's `in` copy on the thread (its ts) and from the recorded `rearms` (their `at`); the untimed `texts`
    cannot say when, so they do not count here. This is the per-(row, role) cap: two detections on one role
    inside the window open at most one extra turn for it."""
    pat = _rearm_pat(rid, role)
    best: datetime | None = None
    for m in thread_msgs or []:
        ts = _safe_ts(m.get("ts"))
        if ts is not None and pat.match(_first_line(m.get("text") or "")) and (best is None or ts > best):
            best = ts
    for r in book.get("rearms") or []:
        at = _safe_ts(r.get("at"))
        if at is not None and pat.match(_first_line(r["text"])) and (best is None or at > best):
            best = at
    if best is None:
        return None
    h = hours_between(best, now)
    return h if 0 <= h < NUDGE_BOUND_H else None


class _Tick:
    """Per-tick sinks (alerts, actions, summary) plus the 24 h alert bound."""

    def __init__(self, now_dt: datetime, sessions: dict | None = None, acks: dict | None = None) -> None:
        self.now = now_dt
        self.sessions = sessions or {}
        self.acks_info = acks_status(acks, now_dt)
        self.acks_ok = self.acks_info["status"] == "ok"
        self.acks: dict = (acks or {}).get("sessions") if self.acks_ok else {}
        self.actions: list[dict] = []
        self.alerts: list[dict] = []
        self.summary = {
            "in_flight": 0, "must_nudge": 0, "escalate": 0, "hold": 0, "cost_hold": 0, "blocked": 0, "gate": 0, "card_missing": 0,
            "infra_hold": 0, "bounced": 0, "idle_turn": 0, "acks": self.acks_info["status"],
        }

    def session_pin(self, rec: dict, role: str | None) -> str | None:
        target = pick_target_session(self.sessions.get(rec["thread_id"]), role)
        return target.get("session_id") if target else None

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
        "infra_hold": None,
        "bounced": None,
        "idle_turn": None,
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
        "carries_criteria": [],
    }


def _open_carried(row: dict) -> list[str]:
    """The AC ids other rows deferred onto this one that are still open (hermes_queue's reading)."""
    return [c.get("criterion") for c in (row.get("carries_criteria") or []) if isinstance(c, dict) and c.get("criterion")]


def _hold_action(tick: _Tick, rec: dict, book: dict, gating: dict, rid: str, hold: str, stage: str, age_h: float) -> None:
    """§4.3 / §5 merge hold (or `paused`): a note for the ledger, never a nudge; two alerts when the hold itself is the problem."""
    rec["hold"] = hold
    tick.summary["hold"] += 1
    tick.actions.append({"kind": "hold", "row": rid, "hold": hold, "pr": rec["pr"], "text": f"hold: {hold} — do not gh pr ready or merge PR #{rec['pr']} for {rid} yet"})
    if hold in ("1a", "batch2", "batch3+4") and gating.get("1a_blocked"):
        tick.escalate(rec, book, "blocked-twice", stage, age_h, f"held on {hold} and LOOP-F35 is blocked; the port cannot proceed", "unblock or re-dispatch LOOP-F35 by hand")
    elif age_h >= HOLD_TOO_LONG_H:
        tick.escalate(rec, book, "hold-too-long", stage, age_h, f"merge held on {hold} for {int(age_h)}h", f"merge the {hold} dependency (or waive it in config.json) so held rows can merge")


def _hold_key(hold_role: str, hold_text: str) -> str:
    """The once-per-hold bound key: the role plus the normalised first line (≤ 80 chars), quoted exactly as both
    re-arm texts carry it. An hourly restatement of the same hold is the same key; a differently worded one is
    a new hold and falls under the per-(row, role) re-arm cap instead."""
    return f"hold \"{' '.join(hold_text.split())[:80]}\""


def _infra_hold_action(tick: _Tick, rec: dict, book: dict, thread_msgs: list[dict] | None, ih: dict, stage: str, age_h: float, slo_role: str | None) -> bool:
    """§2.5 infra/operator hold: alert at once (24 h bound) and ask the Orchestrator, once per hold text and at
    most once per (row, role) per NUDGE_BOUND_H, to re-arm the role when the dependency is back. The stage and
    its SLO clock are untouched. Returns True only when the re-arm nudge was emitted this tick — the caller
    then stops; otherwise it falls through to the ordinary SLO check, so a re-armed role that stalls again is
    still nudged/escalated on the row's clock instead of hiding behind the hold."""
    rid = rec["id"]
    rec["infra_hold"] = ih
    tick.summary["infra_hold"] += 1
    hold_role = ih.get("role") or slo_role or "the owing role"
    kind = "operator-ruling" if ih.get("operator_ruling") else "infra-hold"
    hold_text = ih.get("text") or "hold"
    what = f"{hold_role} wrote: {hold_text}"
    if kind == "operator-ruling":
        decision = f"post the ruling on hermes-{rid}"
    else:
        dep = f"codex: {ih['cause']}" if ih.get("cause") else "codex/OneCLI/proxy"
        decision = f"check the named dependency ({dep}); when healthy tell the Orchestrator to re-arm {hold_role} on hermes-{rid} with 'resume, no new round'"
    tick.escalate(rec, book, kind, stage, age_h, what, decision)
    rec["slo_status"] = "infra-hold"  # after escalate, which labels the row `escalated`; the hold is the more useful word on the table
    key = _hold_key(hold_role, hold_text)
    if _marked_nudge_seen(thread_msgs, rid, book, key, hold_role):
        return False
    capped = _recent_rearm(thread_msgs, book, rid, hold_role, tick.now)
    if capped is not None:
        rec["reason"] = (rec.get("reason") or "") + f"; re-arm cap: {hold_role} re-armed {round(capped, 1)}h ago (< {int(NUDGE_BOUND_H)}h)"
        return False
    cause = f"; codex {ih['cause']}" if ih.get("cause") else ""
    if kind == "operator-ruling":
        ask = f"Wait for the operator's ruling on hermes-{rid}; when it lands, re-arm {hold_role} there with 'resume, no new round' and relay the ruling."
    else:
        ask = f"Check that dependency; once it is healthy re-arm {hold_role} on hermes-{rid} with 'resume, no new round' (pin its session), else send nothing and retry next tick."
    text = f"{REARM_PREFIX} {rid} · {hold_role}: {kind.replace('-', ' ')} — {hold_role} wrote {key} at {ih['ts']}{cause}. {ask}"
    rearm_text = (
        f"{REARM_PREFIX} {rid} · {hold_role}: resume, no new round — your {key} (at {ih['ts']}) is lifted: the dependency is back"
        f"{' / the ruling is on this thread' if kind == 'operator-ruling' else ''}. Pick up where you stopped and reply on this thread: status, blocker, ETA."
    )
    tick.nudge(rec, ORCHESTRATOR, text)
    tick.actions[-1].update(
        check="infra_hold", alert_kind=kind, hold_ts=ih["ts"], hold_role=hold_role, hold_key=key, rearm_role=hold_role,
        rearm_text=rearm_text, rearm_session_id=tick.session_pin(rec, hold_role),
    )
    return True


def _bounced(tick: _Tick, rec: dict, book: dict, thread_msgs: list[dict] | None, role: str, stage: str, age_h: float, ack: dict) -> None:
    """§2.5 bounced turn: the owing role's newest turn ended `bounced-*` with no output. One re-arm nudge
    to the Orchestrator per ack timestamp, at once, capped at one SENT re-arm per (row, role) per
    NUDGE_BOUND_H. A later bounce after a re-arm was sent is the `bounce-repeat` ALERT and nothing else:
    every redrive during an outage mints a new `bounced-*` ack, so re-arming per ack would open one fresh
    session per tick until the provider recovered, all of them waking on the same row (the LOOP-F35 twin
    hazard, multiplied). One re-arm per outage is the budget; the operator spawns fresh by hand."""
    rid = rec["id"]
    changed, status = ack["changed"], ack["status"]
    key = f"turn at {changed} ended"
    earlier = _rearm_bounce_before(thread_msgs, book, rid, role, ack["changed_dt"])
    transient = status == BOUNCE_TRANSIENT
    rec["bounced"] = {"role": role, "session_id": ack["session_id"], "status": status, "changed": changed, "repeat": bool(earlier), "after_rearm_for": earlier}
    tick.summary["bounced"] += 1
    rec["slo_status"] = "bounced"
    if earlier:
        fresh = (
            f"the provider outage ({status}) is still on: check the host error log around {changed}, and when the provider is back spawn a fresh {role} session by hand"
            if transient else f"spawn a fresh {role} session by hand; check the host error log around {changed} for the provider/proxy error"
        )
        tick.escalate(
            rec, book, "bounce-repeat", stage, age_h,
            f"{role} bounced again: turn at {changed} ended {status} with no output, after the re-arm for its bounce at {earlier}; no further re-arm from the supervisor",
            fresh,
        )
        return
    if _marked_nudge_seen(thread_msgs, rid, book, key, role):
        return
    capped = _recent_rearm(thread_msgs, book, rid, role, tick.now)
    if capped is not None:
        rec["reason"] = (rec.get("reason") or "") + f"; re-arm cap: {role} re-armed {round(capped, 1)}h ago (< {int(NUDGE_BOUND_H)}h)"
        return
    if transient:
        how = (
            "this is the provider-outage signature: probe the provider first (one cheap call through the proxy); healthy → resume the warm "
            "session pinned; still down → send nothing and retry next tick. Never spawn a fresh session for a transient bounce"
        )
    else:
        how = "resume the warm session if it accepts a message, else spawn fresh"
    text = f"{REARM_PREFIX} {rid} · {role}: re-arm {role} on hermes-{rid}: its last {key} {status} with no output; {how}; reply on this thread."
    rearm_text = (
        f"{REARM_PREFIX} {rid} · {role}: resume, no new round — your last {key} {status} with no output on thread hermes-{rid}. "
        "Re-read your task memory, pick up where that turn stopped, and reply on this thread: status, blocker, ETA."
    )
    tick.nudge(rec, ORCHESTRATOR, text)
    tick.actions[-1].update(
        check="bounced", ack_status=status, ack_changed=changed, transient=transient, repeat=False, rearm_role=role,
        rearm_text=rearm_text, rearm_session_id=ack["session_id"],
    )


def _turn_ended_with_alternative(thread_msgs: list[dict] | None, events: list[dict], role: str, ended: datetime, rid: str) -> bool:
    """Did the turn that acked `completed` at `ended` end with the alternative artifact instead of the marker?
    The ack is stamped AFTER the turn's outputs (poll-loop markCompleted runs once processQuery returns), so
    nothing the turn wrote is ever later than T. Two readings, either suffices: the role's newest outbound line
    on the thread is a [Blocker] or a hold; or the role wrote a [Blocker] / hold at or after the inbound that
    started the turn (its newest `in` line before T)."""
    want = role.lower()
    mine_out: list[dict] = []
    turn_start: datetime | None = None
    for m in thread_msgs or []:
        if str(m.get("role") or m.get("sender") or "").lower() != want:
            continue
        ts = _safe_ts(m.get("ts"))
        if ts is None:
            continue
        if m.get("direction") == "in":
            if ts <= ended and (turn_start is None or ts > turn_start):
                turn_start = ts
            continue
        mine_out.append({**m, "_ts": ts})
    if mine_out:
        newest = max(mine_out, key=lambda m: m["_ts"])
        first, text = _first_line(newest.get("text") or ""), newest.get("text") or ""
        if first.startswith("[Blocker]") or _infra_hold_line(first, text, rid):
            return True
    if turn_start is not None:
        for e in events:
            if e["kind"] not in ("blocker", "infra_hold") or str(e.get("sender") or "").lower() != want:
                continue
            ts = _safe_ts(e.get("ts"))
            if ts is not None and turn_start <= ts <= ended:
                return True
    return False


def _idle_turn(tick: _Tick, rec: dict, events: list[dict], thread_msgs: list[dict] | None, role: str, ack: dict, clock: str | None, nudge_h: float | None, sessions: dict | None) -> dict | None:
    """§2.5 turn ended without hand-off: `completed` at T, container not running, no marker after T, the turn did
    not end with a [Blocker] / hold (the alternative artifact the nudge text itself names), and T at least half
    the stage's nudge SLO (min 1 h) old. Unknown container status is no signal."""
    ended = ack["changed_dt"]
    cstatus = _container_status(sessions, rec["thread_id"], ack)
    if cstatus is None or cstatus.lower() == "running":
        return None
    clock_dt = _safe_ts(clock)
    if clock_dt is not None and ended < clock_dt:
        return None  # the turn predates this stage: the role has not taken its turn yet; the SLO clock applies
    for e in events:
        if e["kind"] == "nudge":
            continue
        ts = _safe_ts(e.get("ts"))
        if ts is not None and ts > ended:
            return None  # a marker (or a [Blocker], a hold) came after the turn: not idle
    if _turn_ended_with_alternative(thread_msgs, events, role, ended, rec["id"]):
        return None  # the turn's own [Blocker] / hold is the alternative artifact; the SLO path owns what follows
    age = hours_between(ended, tick.now)
    if age < max(1.0, (nudge_h or 0.0) / 2.0):
        return None
    return {"role": role, "session_id": ack["session_id"], "ended": ack["changed"], "age_hours": age, "container_status": cstatus}


def supervise_row(tick: _Tick, rid: str, row: dict, thread_msgs: list[dict] | None, prs: list[dict], gating: dict, cfg: dict, nudges: dict | None, sessions: dict | None) -> dict:
    rec = _supervise_row_core(tick, rid, row, thread_msgs, prs, gating, cfg, nudges, sessions)
    card_check(tick, rec, thread_msgs, cfg)
    return rec


def _supervise_row_core(tick: _Tick, rid: str, row: dict, thread_msgs: list[dict] | None, prs: list[dict], gating: dict, cfg: dict, nudges: dict | None, sessions: dict | None) -> dict:
    thread = f"hermes-{rid}"
    thread_ok = isinstance(thread_msgs, list)
    events = extract_events(thread_msgs if thread_ok else [], rid)
    pr = find_pr(prs, rid, (row.get("ledger") or {}).get("pr"))
    res = resolve_stage(rid, row, events, pr, gating, cfg, thread_msgs if thread_ok else None)
    stage = res["stage"]
    book = nudge_book(nudges, rid, events)
    stamps = [e["ts"] for e in events] + [t for t in ((pr or {}).get("updatedAt"), (pr or {}).get("createdAt")) if t]
    rec = _new_record(rid, res, max(stamps) if stamps else None, book)
    rec["thread_ok"] = thread_ok
    rec["carries_criteria"] = _open_carried(row)
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

    # A paused row is silent, whatever the roles wrote on it: the operator asked for exactly that. It is
    # checked BEFORE the infra hold so a stale `HOLD on <ID>` line cannot alert or re-arm a paused row.
    hold = merge_hold(rid, row, gating, res, cfg)
    if hold == "paused":
        _hold_action(tick, rec, book, gating, rid, hold, stage, age_h)
        return rec

    # infra / operator hold (§2.5): the role said it cannot proceed; alert now, re-arm through the Orchestrator.
    # Only a re-arm SENT this tick ends the row's turn here; otherwise the ordinary SLO check below still runs
    # (a re-armed role that stalls again must not hide behind its old hold).
    if res.get("infra_hold") and _infra_hold_action(tick, rec, book, thread_msgs, res["infra_hold"], stage, age_h, role):
        return rec

    if hold:
        _hold_action(tick, rec, book, gating, rid, hold, stage, age_h)
        return rec

    if stage == "gate" and res.get("triage_present"):
        tick.summary["gate"] += 1
        text = f"run merge-gate.md for {FORK}#{rec['pr']} head {rec['head'] or '?'} ({rid})"
        action = {"kind": "gate", "row": rid, "pr": rec["pr"], "head": rec["head"]}
        if rec["carries_criteria"]:
            # P5 must see each carried id as a PASS row too; the Orchestrator's gate run is where that is checked.
            text += f"; carried criteria to verify in the ADR/Test Report: {', '.join(rec['carries_criteria'])}"
            action["carried_criteria"] = list(rec["carries_criteria"])
        action["text"] = text
        tick.actions.append(action)

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

    # acks (§2.5): the owing chain role's newest turn on the thread, when acks.json is fresh. Off = no signal.
    ack = role_ack(tick.acks, thread, role) if tick.acks_ok and role and role != ORCHESTRATOR else None
    if ack and ack["status"].startswith("bounced"):
        last_out = _role_last_out(thread_msgs, role)
        if last_out is None or ack["changed_dt"] > last_out:
            _bounced(tick, rec, book, thread_msgs, role, stage, age_h, ack)
            return rec
    if ack and ack["status"] == "completed":
        rec["idle_turn"] = _idle_turn(tick, rec, events, thread_msgs, role, ack, clock, nudge_h, sessions)
        if rec["idle_turn"]:
            tick.summary["idle_turn"] += 1

    actions_before_slo = len(tick.actions)
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

    # idle turn (§2.5): nudge the role EARLY, once per turn end, never on top of the SLO nudge for the same marker.
    idle = rec.get("idle_turn")
    if idle and rec["action"] == "none" and role and not in_state and (since_nudge_h is None or since_nudge_h >= NUDGE_BOUND_H):
        key = f"Your turn at {idle['ended']}"
        if _marked_nudge_seen(thread_msgs, rid, book, key):
            rec["reason"] = (rec["reason"] or "") + f"; idle-turn nudge already sent for the turn at {idle['ended']}"
        else:
            text = NUDGE_TEMPLATE.format(id=rid, state=rec["stage_label"], h=int(age_h), short=short, expected=expected)
            text += f" {key} ended without the {short}; if the work is done, send the marker now."
            rec["slo_status"] = "idle-turn"
            tick.nudge(rec, role, text)
            tick.actions[-1].update(check="idle_turn", turn_ended=idle["ended"], marker=short, session_id=idle["session_id"])
    if rec["infra_hold"] and len(tick.actions) == actions_before_slo:
        rec["slo_status"] = "infra-hold"  # the SLO check ran and fired nothing: the standing hold is the row's word on the table
    return rec


def carried_after_merge(tick: _Tick, rows_in: dict, out_rows: dict, nudges: dict | None) -> None:
    """A row that is merged (ledger, or the fork this tick) while a criterion carried TO it is
    still `open` in ledger.md § Carried criteria: the merge gate either verified it (then the
    Orchestrator marks it `covered (<PR or head>)`) or it slipped through — either way the open
    row is wrong and would be dispatched nowhere, so one alert per row, 24 h bound. A merged row
    is otherwise not supervised at all, so its record is added here only when it has open ids."""
    for rid in sorted(rows_in):
        row = rows_in[rid]
        open_ids = _open_carried(row)
        if not open_ids:
            continue
        rec = out_rows.get(rid)
        merged = rec["stage"] == "merged" if rec is not None else row.get("state") == "merged"
        if not merged:
            continue
        book = nudge_book(nudges, rid, [])
        if rec is None:
            ledger = row.get("ledger") or {}
            res = {"stage": "merged", "reason": row.get("state_reason") or "ledger says merged", "pr": ledger.get("pr")}
            rec = _new_record(rid, res, None, book)
            rec["thread_ok"] = True
            rec["carries_criteria"] = open_ids
            out_rows[rid] = rec
        tick.escalate(
            rec, book, "carried-open", "merged", 0.0,
            f"merged with open carried criterion {', '.join(open_ids)} — mark covered or re-carry",
            "in ledger.md § Carried criteria set status `covered (<PR or head>)` if this PR delivered it, else re-carry it (to row = a row still to be dispatched)",
        )


def supervise(
    state: dict,
    threads: dict,
    prs: list[dict],
    nudges: dict | None,
    now: str,
    sessions: dict | None = None,
    config: dict | None = None,
    acks: dict | None = None,
) -> dict:
    tick = _Tick(parse_iso(now), sessions, acks)
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
    carried_after_merge(tick, rows_in, out_rows, nudges)
    order = {"hold": 0, "gate": 1, "nudge": 2, "alert": 3}
    tick.actions.sort(key=lambda a: (order.get(a["kind"], 9), a.get("row") or ""))
    return {"now": iso_utc(tick.now), "rows": out_rows, "actions": tick.actions, "alerts": tick.alerts, "summary": tick.summary, "acks": tick.acks_info}


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
    ap.add_argument("--acks", help='optional acks.json (collect-acks.sh): {"generated_at", "sessions": {<id>: {status, changed, role, thread_id}}}; missing or > 2 h old = bounce/idle detection off')
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
        acks=_read_json(args.acks, None),
    )
    if args.json:
        print(json.dumps(out, separators=(",", ":"), sort_keys=True))
    else:
        print(json.dumps(out, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
