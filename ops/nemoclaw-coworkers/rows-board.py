#!/usr/bin/env python3
"""rows-board.py: the /rows viewer for the Hermes port — one task card per finished role task.

Reads (every input optional; a missing or broken one becomes a banner, never a crash):

  <ROOT>/docs/hermes-port/dispatch-plan.md      the rows per batch (hermes_queue.parse_plan; falls
                                                 back to data/shared/hermes/dispatch-plan.md)
  <ROOT>/data/shared/hermes/autopilot/state.json  per-row stage (supervise.rows / rows) + generated_at
  <ROOT>/data/shared/hermes/autopilot/threads.json generated_at only (staleness banner)
  <ROOT>/groups/orchestrator/reports/ledger.md   its `## Carried criteria` table (hermes_queue.parse_ledger):
                                                 the criteria one row deferred onto another
  <ROOT>/groups/orchestrator/reports/upstream-asks.md  the `## Upstream asks` table (hermes_queue.parse_upstream_asks):
                                                 core-change candidates the plugin surface cannot absorb
  <ROOT>/groups/<group>/reports/hermes-<ROW>/cards/card-<role>-<outcome>-r<N>.{png,html,json}
                                                 plus the card-<role>-latest.{png,html} copies. The dir's thread is read
                                                 through rowid.canon_thread: a `hermes-iso-f13` card dir (a role addressed
                                                 with a mis-cased thread, 2026-09-16) is ISO-F13's; URLs and the symlink
                                                 keep the real dir name
  `ncl sessions list --json` (--ncl, default <ROOT>/bin/ncl)  LIVE per-role status on every row:
                                                 green = a container is running, amber = session idle,
                                                 red = needs a human (cost card / hold / blocked / escalated),
                                                 grey = no session. Roles come from threads.json `roles`. A session
                                                 on a mis-cased row thread counts for its row (canon_thread) and the
                                                 row page names the thread it really lives on.

  <ROOT>/data/shared/hermes/autopilot/config.json  the human's knobs (wip, waive, paused_rows): paused / waived rows

ONE computation, ONE row state. load_board() reads every input once and builds one per-row RECORD per
plan row / card thread (build_records: plan row, queue row + supervisor row, live sessions and their
dots, cards, the ledger's work-item row). row_state() derives THE row's state from those inputs exactly
once — ledger merged > paused > blocked > deferred > in flight > waiting > queued, plus the supervisor's
holds and config.waive — and every surface renders that: the index cell and the row page show
row_stage(record) (the state plus `· hold X` / `· cost hold` / `· waived` decorations), the demo-path
tracker maps the same record["state"] onto its vocabulary. Neither re-reads state.json's rows.

Writes under <WWW>/rows/ (tmp + rename):

  index.html      batch → rows → a | b | t | r: the latest card per role as a 180 px thumbnail,
                  bordered in the verdict colour (ok / bad / run), linking to the row page; a row
                  that carries open criteria wears a `carries N` badge. Then two sections:
                  "Carried criteria" (criterion · from → to · status · reason, open first; a to-row
                  that is not a plan row — a phase name such as P4 — is flagged) and "Upstream asks"
                  (UA id · source row · disposition · ask, truncated). The header carries ONE link,
                  "Demo path →", to the tracker's own page; nothing else of the tracker is on the index.
  <ROW>.html      every card on the row newest-first with its .html / .json, links to /adr/,
                  /test-reports/<thread>/ and the dashboard lane ($DASHBOARD_URL/#/cw/orchestrator/l/hermes-<ROW>);
                  a "Carries" block (criteria this row must cover — each must be a PASS row under its
                  own id at the merge gate), a "Deferred from this row" block, and the row's upstream asks
  demo-path.html  the demo-path tracker (demo_path.py over the SAME per-row records: five rungs, the
                  rows each needs in their board state, status + ETA), full page, same CSS, a link back
                  to the index. A tracker failure is one banner on this page; the board still writes.
  demo-path.json  the tracker's computed result (demo_path.compute output + `slack_text`, the rendered
                  Slack message) — slack-rows.py reads THIS for its `*Demo path*` message and never
                  computes anything itself. Left untouched when the tracker fails (slack-rows then sees
                  a stale file and leaves the message alone).
  cards/<group>/<thread>  a symlink to that group's card dir, so the PNGs are served as-is

Stdlib only, no hostname guard, exit 0 on every handled failure (the caller is refresh-viewers.sh,
which must go on publishing the other viewers). `--now` fixes the clock for tests.
"""

from __future__ import annotations

import argparse
import glob
import html
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
# rowid.canon_thread (autopilot/rowid.py, the one canonical copy): `hermes-iso-f13` -> `hermes-ISO-F13`, non-row threads
# unchanged. Applied wherever a thread string names a row (card dirs, live sessions) so a role that opened its session or
# wrote its cards on a mis-cased thread still lands on its row. Its absence is one banner; spellings then stay as found.
sys.path.insert(0, os.path.join(HERE, "autopilot"))
try:
    from rowid import canon_thread
    ROWID_ERR = None
except ImportError:
    ROWID_ERR = "autopilot/rowid.py not found: thread ids are not canonicalised (a mis-cased hermes-<row> thread shows as its own row)"

    def canon_thread(thread):
        return thread


ROLE_COLUMNS = (("a", "hermes-architect"), ("b", "hermes-builder"), ("t", "hermes-tester"), ("r", "hermes-reviewer"))
ROLE_ORDER = [r for _, r in ROLE_COLUMNS] + ["orchestrator"]
BATCH_ORDER = ("1a", "1b", "2", "3", "4", "5", "adopt", "defer")
BATCH_TITLES = {
    "1a": "Batch 1a · P2 · the compose plugin",
    "1b": "Batch 1b · P2 · CONFIGURE rows the render must emit",
    "2": "Batch 2 · P3-waveA · gates, ledgers, the cap",
    "3": "Batch 3 · P4-sandbox",
    "4": "Batch 4 · P5-rooms-veto",
    "5": "Batch 5 · P6-fleet · fleet assembly",
    "adopt": "Adopt track · doc page + hermetic acceptance test",
    "defer": "Deferred rows",
}
OUTCOME_CLASS = {
    "pass": "ok", "approve": "ok", "merged": "ok", "shipped": "ok", "fixed": "ok", "handoff": "ok", "resolved": "ok",
    "fail": "bad", "request_changes": "bad", "blocked": "bad",
    "escalate": "run", "dispatched": "run",
}
OUTCOMES = "|".join(sorted(OUTCOME_CLASS, key=len, reverse=True))
CARD_RE = re.compile(rf"^card-(?P<role>.+?)-(?P<outcome>{OUTCOMES})-r(?P<round>\d+)\.(?P<ext>png|html|json)$")
LATEST_RE = re.compile(r"^card-(?P<role>.+)-latest\.(?P<ext>png|html)$")
THREAD_RE = re.compile(r"^hermes-(?P<row>.+)$")
# A row id usable as a page filename (<ROW>.html) and a link target; anything else renders as plain text.
SAFE_RID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
STALE_H = 2.0
# hermes_queue.IN_FLIGHT_STATES / hermes_supervise.IN_FLIGHT (kept local: the board must render without them).
IN_FLIGHT_STATES = ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")
# hermes_supervise.merge_hold's §4.3 holds: the PR is ready and merges the moment that batch has merged.
GATE_HOLDS = ("1a", "batch2", "batch3+4")
# Supervisor escalations another record field already carries (cost_hold / state blocked / a gate hold).
ESCALATIONS_CARRIED = ("cost-card", "blocked", "hold-too-long")
CSS = """
body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;max-width:1280px;color:#222;background:#fafafa}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
small,.muted{color:#777}code{color:#555;font-size:12px}a{color:#1a56a0}
.banner{padding:8px 12px;border-radius:6px;margin:8px 0;background:#fff3cd;border:1px solid #f0d58c;color:#664d03}
.banner.bad{background:#fde2e2;border-color:#f5b5b5;color:#7a1c1c}
table{border-collapse:collapse;width:100%}th,td{padding:6px 8px;vertical-align:top;text-align:left;border-bottom:1px solid #eee}
th{font-size:12px;color:#666;font-weight:600}td.cell{width:196px}
.thumb{display:block;width:180px;height:120px;object-fit:cover;border:3px solid #bbb;border-radius:4px;background:#fff}
.thumb.ok{border-color:#2e7d32}.thumb.bad{border-color:#c62828}.thumb.run{border-color:#f9a825}
.v{font-size:11px;font-weight:600;margin-top:2px}.v.ok{color:#2e7d32}.v.bad{color:#c62828}.v.run{color:#b07d00}.v.none{color:#aaa;font-weight:400}
.stage{font-size:12px;color:#555;white-space:nowrap}
.card{margin:18px 0;padding:12px;background:#fff;border:1px solid #e3e3e3;border-radius:6px}
.card img{display:block;width:100%;max-width:900px;border:3px solid #bbb;border-radius:4px}
.card img.ok{border-color:#2e7d32}.card img.bad{border-color:#c62828}.card img.run{border-color:#f9a825}
.links a{margin-right:12px}
.live{font-size:11px;color:#444;margin-bottom:3px;white-space:nowrap}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:middle;border:1px solid rgba(0,0,0,.15)}
.dot.green{background:#2e7d32}.dot.red{background:#c62828}.dot.amber{background:#f9a825}.dot.grey{background:#bbb}
.legend{font-size:12px;color:#555;margin:6px 0 12px}.legend .dot{margin-left:10px}
table.live-sessions td{font-size:12px}
.badge{display:inline-block;font-size:10px;font-weight:600;padding:0 6px;border-radius:9px;margin-left:6px;vertical-align:middle;background:#fff3cd;border:1px solid #f0d58c;color:#664d03;white-space:nowrap}
.st{font-weight:600;white-space:nowrap}.st.open{color:#b07d00}.st.ok{color:#2e7d32}.st.off{color:#777;font-weight:400}.st.bad{color:#c62828}
table.tbl td{font-size:13px}table.tbl td.ask{max-width:520px}
"""


def log(msg: str) -> None:
    sys.stderr.write(f"rows-board: {msg}\n")


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


def truncate(s, n: int = 120) -> str:
    s = str(s if s is not None else "").strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "\u2026"


def parse_iso(value):
    if not isinstance(value, str) or not value.strip():
        return None
    v = value.strip()
    if v.endswith(("Z", "z")):
        v = v[:-1] + "+00:00"
    v = re.sub(r"(\.\d{6})\d+", r"\1", v)
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def fmt_age(seconds: float) -> str:
    seconds = max(seconds, 0)
    if seconds < 3600:
        return f"{int(seconds // 60)}m"
    if seconds < 48 * 3600:
        return f"{seconds / 3600:.1f}h"
    return f"{int(seconds // 86400)}d"


def fmt_stamp(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%MZ")


def write_atomic(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(text)
    os.replace(tmp, path)


# --------------------------------------------------------------------------- inputs

def _hermes_queue():
    """The autopilot's parsers, imported late: their absence is a banner, not a crash."""
    sys.path.insert(0, os.path.join(HERE, "autopilot"))
    import hermes_queue
    return hermes_queue


def load_plan(paths: list) -> tuple:
    """(plan dict from hermes_queue.parse_plan | None, error string | None)."""
    path = next((p for p in paths if p and os.path.isfile(p)), None)
    if path is None:
        return None, "dispatch-plan.md not found (" + ", ".join(p for p in paths if p) + ")"
    try:
        hermes_queue = _hermes_queue()
        with open(path, encoding="utf-8") as fh:
            plan = hermes_queue.parse_plan(fh.read())
        if not isinstance(plan, dict) or not isinstance(plan.get("rows"), dict):
            return None, f"parse_plan returned no rows for {path}"
        plan["path"] = path
        return plan, None
    except Exception as exc:  # noqa: BLE001 - any failure renders as "plan unreadable"
        return None, f"plan unreadable: {type(exc).__name__}: {exc}"


def ledger_merge_stamps(ledger_text: str, hq) -> dict:
    """{row-id: ISO merge time} from the ledger's `merged/blocked` cell (first timestamp in it), for
    merged rows only — parse_ledger keeps the parsed outcome but not the cell's timestamp, so the
    same table is re-read with the same cell splitter and header-located columns."""
    out: dict = {}
    main_text, _ = hq._split_ledger_sections(ledger_text)
    tz = hq.DEFAULT_CONFIG.get("install_tz_offset_minutes", 330)
    header = None
    col: dict = {}
    for line in main_text.splitlines():
        if not line.startswith("|"):
            continue
        cells = hq.split_cells(line)
        if not cells or hq.is_separator(cells):
            continue
        if header is None:
            low = [c.lower() for c in cells]
            if any(h in low for h in ("row-id", "req-id", "id")):
                header = low
                col = {name: i for i, name in enumerate(header)}
            continue
        if len(cells) > len(header):
            cells = cells[: len(header) - 1] + ["|".join(cells[len(header) - 1:])]
        id_col = next((col[h] for h in ("row-id", "req-id", "id") if h in col), 0)
        rid, _tokens = hq.ledger_row_id(hq.clean_id(cells[id_col]) if id_col < len(cells) else "")
        i = col.get("merged/blocked")
        if not rid or i is None or i >= len(cells):
            continue
        if hq.parse_outcome_cell(cells[i]).get("outcome") == "merged":
            stamp = hq.first_timestamp(cells[i], tz)
            if stamp:
                out[rid] = stamp
    return out


def load_tables(ledger_path: str, asks_path: str) -> dict:
    """The Orchestrator's two tables, read through hermes_queue's parsers (the same code the queue,
    the supervisor and the coverage check run), so the board shows exactly what they act on.

    {"carried": [criterion dicts], "carried_problems": [str], "carried_err": str | None,
     "asks": [ask dicts], "asks_err": str | None,
     "ledger_rows": {row-id: parse_ledger entry}, "merged_at": {row-id: ISO merge stamp}}.
    The last two come from the same ledger read (the work-item table: dispatched / PR / verdict /
    merged/blocked outcome + merge sha, and the merge timestamp for merged rows) and feed the
    per-row records. A missing or unreadable file is an *_err string (rendered as a banner) with an
    empty list; an empty upstream-asks.md (the box's state until the first ask is surfaced) is simply
    no asks."""
    out = {"carried": [], "carried_problems": [], "carried_err": None, "asks": [], "asks_err": None, "ledger_rows": {}, "merged_at": {}}
    try:
        hermes_queue = _hermes_queue()
    except Exception as exc:  # noqa: BLE001
        out["carried_err"] = out["asks_err"] = f"hermes_queue unavailable: {type(exc).__name__}: {exc}"
        return out
    if not os.path.isfile(ledger_path):
        out["carried_err"] = f"ledger.md not found ({ledger_path})"
    else:
        try:
            with open(ledger_path, encoding="utf-8") as fh:
                text = fh.read()
            led = hermes_queue.parse_ledger(text)
            out["carried"] = [c for c in (led.get("carried_criteria") or []) if isinstance(c, dict)]
            out["carried_problems"] = [str(p) for p in (led.get("carried_problems") or [])]
            out["ledger_rows"] = {str(k): v for k, v in (led.get("rows") or {}).items() if isinstance(v, dict)}
            out["merged_at"] = ledger_merge_stamps(text, hermes_queue)
        except Exception as exc:  # noqa: BLE001 - a broken ledger is a banner, never a crash
            out["carried_err"] = f"ledger.md unreadable: {type(exc).__name__}: {exc}"
    if not os.path.isfile(asks_path):
        out["asks_err"] = f"upstream-asks.md not found ({asks_path})"
    else:
        try:
            with open(asks_path, encoding="utf-8") as fh:
                out["asks"] = [a for a in hermes_queue.parse_upstream_asks(fh.read()) if isinstance(a, dict)]
        except Exception as exc:  # noqa: BLE001
            out["asks_err"] = f"upstream-asks.md unreadable: {type(exc).__name__}: {exc}"
    return out


def load_json(path: str) -> tuple:
    try:
        with open(path, encoding="utf-8") as fh:
            v = json.load(fh)
        return (v, None) if isinstance(v, dict) else (None, f"{os.path.basename(path)} is not an object")
    except FileNotFoundError:
        return None, None
    except (OSError, ValueError) as exc:
        return None, f"{os.path.basename(path)} unreadable: {exc}"


def staleness(obj, err, name: str, now: datetime) -> str | None:
    """A banner line for a missing, unreadable or stale (generated_at older than STALE_H) file."""
    if err:
        return f"{name}: {err}"
    if obj is None:
        return f"no {name} yet (the first autopilot tick writes it)"
    gen = parse_iso(obj.get("generated_at"))
    if gen is None:
        return f"{name}: no generated_at"
    age_h = (now - gen).total_seconds() / 3600.0
    if age_h > STALE_H:
        return f"{name} is stale: generated {obj.get('generated_at')} ({fmt_age(age_h * 3600)} ago)"
    return None


def scan_cards(root: str) -> dict:
    """{thread: {group: {"dir": path, "thread": dir thread, "dirs": [paths], "cards": [card], "latest": {role: {ext: filename, "thread"}}}}}.

    The outer key is the CANONICAL thread (canon_thread): a `hermes-iso-f13` card dir is filed under `hermes-ISO-F13`.
    A card is {"file", "role", "outcome", "round", "ext", "mtime", "cls", "group", "thread", "dir"}; `thread` and `dir`
    are the card's real dir (the URL base cards/<group>/<thread>/ and the symlink use them); the PNG is the unit, its
    .html / .json siblings are attached as "html" / "json" when present. Two dirs of one group that spell the same row
    differently merge into one entry (`dirs` lists both; `latest` keeps the newest per role)."""
    out: dict = {}
    for d in sorted(glob.glob(os.path.join(root, "groups", "*", "reports", "hermes-*", "cards"))):
        if not os.path.isdir(d):
            continue
        parts = d.split(os.sep)
        group, thread = parts[-4], parts[-2]
        if not THREAD_RE.match(thread):
            continue
        try:
            names = sorted(os.listdir(d))
        except OSError as exc:
            log(f"cannot list {d}: {exc}")
            continue
        entry = {"dir": d, "thread": thread, "dirs": [d], "cards": [], "latest": {}}
        by_stem: dict = {}
        for name in names:
            m = LATEST_RE.match(name)
            if m:
                lat = entry["latest"].setdefault(m.group("role"), {"thread": thread})
                lat[m.group("ext")] = name
                try:
                    lat["mtime"] = max(lat.get("mtime", 0.0), os.path.getmtime(os.path.join(d, name)))
                except OSError:
                    pass
                continue
            m = CARD_RE.match(name)
            if not m:
                continue
            stem = name[: -(len(m.group("ext")) + 1)]
            by_stem.setdefault(stem, {}).update({m.group("ext"): name, "_m": m})
        for stem, files in by_stem.items():
            if "png" not in files and "html" not in files:
                continue
            m = files["_m"]
            main = files.get("png") or files["html"]
            try:
                mtime = os.path.getmtime(os.path.join(d, main))
            except OSError:
                mtime = 0.0
            outcome = m.group("outcome")
            entry["cards"].append({
                "file": main, "png": files.get("png"), "html": files.get("html"), "json": files.get("json"),
                "role": m.group("role"), "outcome": outcome, "round": int(m.group("round")), "mtime": mtime,
                "cls": OUTCOME_CLASS.get(outcome, "run"), "group": group, "thread": thread, "dir": d,
            })
        entry["cards"].sort(key=lambda c: (-c["mtime"], -c["round"], c["file"]))
        canon = canon_thread(thread)
        have = out.setdefault(canon, {}).get(group)
        if have is None:
            out[canon][group] = entry
        else:
            # the same group wrote cards under two spellings of one row: one entry, every card kept with its own dir
            have["dirs"].append(d)
            have["cards"] = sorted(have["cards"] + entry["cards"], key=lambda c: (-c["mtime"], -c["round"], c["file"]))
            for role, lat in entry["latest"].items():
                if role not in have["latest"] or lat.get("mtime", 0.0) > have["latest"][role].get("mtime", 0.0):
                    have["latest"][role] = lat
    return out


def link_card_dirs(www_rows: str, cards: dict) -> None:
    """<WWW>/rows/cards/<group>/<thread> -> the group's card dir (ln -sfn semantics), one link per real dir under
    its own spelling (a merged entry has several), so every card's URL resolves."""
    for groups in cards.values():
        for group, entry in groups.items():
            for d in entry.get("dirs") or [entry["dir"]]:
                link = os.path.join(www_rows, "cards", group, d.split(os.sep)[-2])
                try:
                    os.makedirs(os.path.dirname(link), exist_ok=True)
                    if os.path.islink(link):
                        if os.readlink(link) == d:
                            continue
                        os.unlink(link)
                    elif os.path.isdir(link):
                        log(f"{link} is a real directory, not replacing it")
                        continue
                    os.symlink(d, link)
                except OSError as exc:
                    log(f"symlink {link}: {exc}")


# --------------------------------------------------------------------------- demo path

def _demo_path():
    """demo_path.py (a sibling), imported late: its absence is a banner, not a crash."""
    sys.path.insert(0, HERE)
    import demo_path
    return demo_path


DEMO_NAV = '<p class="links"><a href="demo-path.html">Demo path →</a></p>'


def demo_tracker(board: dict, now: datetime, spec_path: str | None = None) -> tuple:
    """(result | None, body html, json text | None) — the demo-path tracker computed ONCE over the board's
    per-row records (demo_path.rows_from_board maps each record's canonical `state` → compute), never over
    state.json's rows again; state.json and config.json contribute only what the records do not carry
    (gating flags, WIP, the queue order — demo_path.live_gating over the objects load_board already read).
    `result` carries `slack_text` (render_slack) so slack-rows.py can post it without computing; the JSON
    text is the serialised result for <WWW>/rows/demo-path.json, produced here so a serialisation error is
    a tracker failure too. Any failure — a missing or broken demo-path.json spec, an import error, a bug —
    is (None, one banner, None) and a log line."""
    try:
        dp = _demo_path()
        spec = dp.load_spec(spec_path or dp.SPEC_PATH)
        gating = dp.live_gating(board.get("state"), board.get("config"), state_err=board.get("state_err"),
                                config_err=board.get("config_err"), ledger_err=(board.get("tables") or {}).get("carried_err"))
        result = dp.compute(spec, dp.rows_from_board(board.get("records") or {}, gating), now)
        result["slack_text"] = dp.render_slack(result)
        return result, dp.render_html(result), json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    except Exception as exc:  # noqa: BLE001 - the tracker must never take the board down
        log(f"demo path: {type(exc).__name__}: {exc}")
        return None, f'<div class="banner">demo path unavailable — {esc(f"{type(exc).__name__}: {exc}")}</div>', None


def write_demo_path(www_rows: str, body: str, json_text: str | None, now: datetime) -> bool:
    """demo-path.html (+ demo-path.json when the tracker succeeded) under <WWW>/rows/. A write failure is one
    log line and False — never an exception (main()'s catch-all would replace the whole board with a failure
    page, and the tracker must never take the board down)."""
    try:
        write_atomic(os.path.join(www_rows, "demo-path.html"), render_demo_page(body, now))
        if json_text is not None:
            write_atomic(os.path.join(www_rows, "demo-path.json"), json_text)
        return json_text is not None
    except Exception as exc:  # noqa: BLE001
        log(f"demo path: write failed: {type(exc).__name__}: {exc}")
        return False


def render_demo_page(body: str, now: datetime) -> str:
    """/rows/demo-path.html: the tracker on its own page (same CSS as the board, link back to the index)."""
    return page("Demo path", body, now.strftime("%Y-%m-%d %H:%M UTC"), crumbs='<p class="links"><a href="index.html">← rows board</a></p>')


# --------------------------------------------------------------------------- live status

LIVE_LABEL = {"green": "working", "amber": "idle", "red": "needs input", "grey": "no session"}
LIVE_RANK = {"red": 3, "green": 2, "amber": 1, "grey": 0}


def roles_by_group(threads) -> dict:
    """{agent_group_id: role} from threads.json's `roles` map ({role: agent_group_id}); {} when absent."""
    roles = (threads or {}).get("roles") if isinstance(threads, dict) else None
    if not isinstance(roles, dict):
        return {}
    return {str(v): str(k) for k, v in roles.items() if v}


def load_live_sessions(ncl_bin: str | None, group_role: dict, timeout_s: float = 25.0) -> tuple:
    """({row: {role: [session]}}, error). One `ncl sessions list --json` call; never raises."""
    if not ncl_bin:
        return {}, "no ncl binary (pass --ncl or set NANOCLAW_NCL)"
    if not group_role:
        return {}, "threads.json has no roles map; cannot attribute sessions to roles"
    try:
        r = subprocess.run([ncl_bin, "sessions", "list", "--limit", "2000", "--json"], capture_output=True, text=True, timeout=timeout_s, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {}, f"ncl sessions list: {exc}"
    if r.returncode != 0:
        return {}, f"ncl sessions list rc={r.returncode}: {(r.stderr or '').strip()[:160]}"
    try:
        data = json.loads(r.stdout)
    except ValueError as exc:
        return {}, f"ncl sessions list: bad JSON ({exc})"
    rows = data.get("data") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        return {}, "ncl sessions list: unexpected JSON shape"
    out: dict = {}
    for sess in rows:
        if not isinstance(sess, dict):
            continue
        raw = str(sess.get("thread_id") or "")
        m = THREAD_RE.match(canon_thread(raw))  # hermes-iso-f13 counts for ISO-F13; the real thread stays on the session
        role = group_role.get(str(sess.get("agent_group_id") or ""))
        if not m or not role:
            continue
        out.setdefault(m.group("row"), {}).setdefault(role, []).append({
            "id": sess.get("id"), "status": sess.get("status"), "container_status": sess.get("container_status"),
            "last_active": sess.get("last_active"), "group_folder": sess.get("group_folder"), "thread_id": raw,
        })
    return out, None


def miscased_sessions(live: dict) -> list:
    """[(row, role, session id, real thread)] for every live session whose thread is not the row's canonical one."""
    out = []
    for rid, roles in (live or {}).items():
        for role, sessions in roles.items():
            for x in sessions:
                t = x.get("thread_id")
                if t and t != f"hermes-{rid}":
                    out.append((rid, role, str(x.get("id") or ""), t))
    return out


def role_live(sessions: list | None, sup: dict | None, role: str, now: datetime) -> tuple:
    """(colour, label) for one role on one row.

    red   a human is needed: this role's session sits on a cost card, the row is on hold / blocked /
          escalated with this role as the target, or the row is blocked (orchestrator column)
    green a container of this role is running on the row right now
    amber the role has an active session but no running container (idle, waiting for its turn)
    grey  no session for this role on the row
    """
    sup = sup or {}
    sessions = sessions or []
    why = []
    if role in {str(x.get("role")) for x in (sup.get("cost_hold_sessions") or []) if isinstance(x, dict)}:
        why.append("cost card pending")
    if sup.get("hold") and sup.get("target_role") in (None, role):
        why.append(f"hold: {sup['hold']}")
    if sup.get("stage") == "blocked" and role in ("orchestrator", sup.get("target_role")):
        why.append("blocked — human decision")
    if sup.get("action") == "escalate" and sup.get("target_role") == role:
        why.append("escalated")
    if why:
        return "red", "needs input · " + "; ".join(why)
    running = [x for x in sessions if str(x.get("container_status") or "").lower() == "running"]
    if running:
        return "green", "working" + _since(running, now)
    active = [x for x in sessions if str(x.get("status") or "active").lower() == "active"]
    if active:
        return "amber", "idle" + _since(active, now)
    return "grey", "no session"


def _since(sessions: list, now: datetime) -> str:
    stamps = [parse_iso(x.get("last_active")) for x in sessions]
    stamps = [t for t in stamps if t]
    if not stamps:
        return ""
    return f" · last active {fmt_age((now - max(stamps)).total_seconds())} ago"


def row_live(role_dots: dict) -> str:
    """The row's own dot: red if any role needs input, else green if any works, else amber, else grey."""
    best = "grey"
    for colour, _ in role_dots.values():
        if LIVE_RANK.get(colour, 0) > LIVE_RANK[best]:
            best = colour
    return best


def live_cell(colour: str, label: str) -> str:
    return f'<div class="live" title="{esc(label)}"><span class="dot {colour}"></span>{esc(label)}</div>'


def row_state(rid: str, qrow: dict, sup: dict, ledger: dict | None, config: dict | None, state: dict | None) -> dict:
    """THE row's state, derived here once from the loaded objects and rendered everywhere alike (the index
    cell and the row page through row_stage(record), the demo-path tracker through demo_path.rows_from_board).
    First matching line wins:

      no state.json                                           → None      (state_reason "state.json unavailable")
      no queue row, no supervisor row, no ledger verdict      → None      ("not in state.json")
      ledger merged | queue merged | supervisor merged        → merged    (the ledger's merged/blocked cell is the
                                                                           merge fact; state.json lags it by a tick)
      queue.paused | config.paused_rows                       → paused    (state_reason names the source)
      ledger blocked | queue blocked | supervisor blocked     → blocked   (state_reason: the supervisor's reason,
                                                                           else the queue's, else the ledger's)
      queue deferred                                          → deferred
      supervisor in flight AND queue in flight                → the supervisor's finer stage (dispatched ·
                                                                spec_handoff · building · pr_open · testing · review · gate)
      exactly one of them in flight                           → that one (the supervisor's thread evidence, or the
                                                                queue's dispatch bookkeeping the supervisor has not seen)
      queue queued AND listed in state.queue.waiting          → waiting   (gates = its blocked_by)
      anything else                                           → the queue state as is (queued, carried …)

    Alongside the state:
      waived   the row is in config.waive (counted as done by the gates and the tracker; shown as `· waived`)
      paused   the row is in config.paused_rows or the queue row says paused
      gates    the unmet gate flags of a waiting row (state.queue.waiting[].blocked_by)
      holds    the supervisor's human-needed signals on the row, each {"kind", "label"}:
                 gate       a §4.3 merge hold (label 1a | batch2 | batch3+4): the PR merges when that batch has
                 hold       any other hold (core-change, …): a human decision
                 cost       a cost card is pending on one of the row's sessions
                 escalated  an SLO / env-fail / blocked-twice escalation (label = the alert kind); cost-card,
                            blocked and hold-too-long escalations are already carried by the fields above
    """
    if not isinstance(state, dict):
        return {"state": None, "state_reason": "state.json unavailable", "waived": False, "paused": False, "gates": (), "holds": []}
    qrow = qrow if isinstance(qrow, dict) else {}
    sup = sup if isinstance(sup, dict) else {}
    led = ledger if isinstance(ledger, dict) else {}
    cfg = config if isinstance(config, dict) else {}
    qs = str(qrow.get("state") or "") or None
    ss = str(sup.get("stage") or "") or None
    outcome = str(led.get("outcome") or "") or None
    waived = rid in {str(x) for x in (cfg.get("waive") or [])}
    in_paused_rows = rid in {str(x) for x in (cfg.get("paused_rows") or [])}
    paused = bool(qrow.get("paused")) or in_paused_rows
    holds = []
    if sup.get("hold"):
        hold = str(sup["hold"])
        holds.append({"kind": "gate" if hold in GATE_HOLDS else "hold", "label": hold})
    if sup.get("cost_hold"):
        holds.append({"kind": "cost", "label": "cost hold"})
    if sup.get("action") == "escalate" and str(sup.get("alert_kind") or "") not in ESCALATIONS_CARRIED:
        holds.append({"kind": "escalated", "label": str(sup.get("alert_kind") or "escalated")})
    out = {"state": None, "state_reason": None, "waived": waived, "paused": paused, "gates": (), "holds": holds}
    if not qrow and not sup and outcome not in ("merged", "blocked"):
        return dict(out, state_reason="not in state.json")
    if outcome == "merged" or qs == "merged" or ss == "merged":
        return dict(out, state="merged")
    if paused:
        return dict(out, state="paused", state_reason="config.paused_rows" if in_paused_rows else "queue row paused")
    if outcome == "blocked" or qs == "blocked" or ss == "blocked":
        reason = (sup.get("reason") if ss == "blocked" else None) or qrow.get("state_reason") or led.get("reason")
        return dict(out, state="blocked", state_reason=reason)
    if qs == "deferred":
        return dict(out, state="deferred")
    if ss in IN_FLIGHT_STATES and qs in IN_FLIGHT_STATES:
        return dict(out, state=ss)
    if ss in IN_FLIGHT_STATES:
        return dict(out, state=ss)
    if qs in IN_FLIGHT_STATES:
        return dict(out, state=qs)
    if qs == "queued":
        queue = state.get("queue") if isinstance(state.get("queue"), dict) else {}
        for w in queue.get("waiting") or []:
            if isinstance(w, dict) and str(w.get("id")) == rid:
                return dict(out, state="waiting", gates=tuple(str(g) for g in (w.get("blocked_by") or [])))
    return dict(out, state=qs or "queued")


def row_stage(rec: dict) -> str:
    """The stage text the index cell and the row page show: record["state"] plus its decorations — the
    unmet gates of a waiting row, `· hold X`, `· cost hold`, `· waived`. "" when the state is unknown."""
    s = rec.get("state")
    if not s:
        return ""
    if s == "waiting" and rec.get("gates"):
        s += " · " + ", ".join(rec["gates"])
    for h in rec.get("holds") or []:
        if h.get("kind") in ("gate", "hold"):
            s += f" · hold {h['label']}"
        elif h.get("kind") == "cost":
            s += " · cost hold"
    if rec.get("waived"):
        s += " · waived"
    return s


def latest_for_role(groups: dict, role: str):
    """(card, group entry) for the newest card of `role` on the thread, or (None, None)."""
    best = None
    for entry in groups.values():
        for c in entry["cards"]:
            if c["role"] == role and (best is None or c["mtime"] > best[0]["mtime"]):
                best = (c, entry)
    return best if best else (None, None)


def thumb_cell(groups: dict, role: str, rid: str, now_ts: float, link: bool = True, live: tuple | None = None) -> str:
    head = live_cell(*live) if live else ""
    card, entry = latest_for_role(groups or {}, role)
    if card is None:
        return f'<td class="cell">{head}<div class="v none">·</div></td>'
    lat = entry["latest"].get(role) or {}
    latest_png = lat.get("png")
    thread_dir = (lat.get("thread") if latest_png else None) or card["thread"]
    src = f"cards/{card['group']}/{thread_dir}/{latest_png or card['png'] or card['html']}"
    label = f"{card['outcome'].upper()} r{card['round']} · {fmt_age(now_ts - card['mtime'])}"
    img = (f'<img class="thumb {card["cls"]}" src="{esc(src)}" width="180" alt="{esc(label)}" loading="lazy">'
           if (latest_png or card["png"]) else f'<div class="thumb {card["cls"]}">html only</div>')
    if link:
        img = f'<a href="{esc(rid)}.html" title="{esc(card["file"])}">{img}</a>'
    return f'<td class="cell">{head}{img}<div class="v {card["cls"]}">{esc(label)}</div></td>'


# --------------------------------------------------------------------------- carried criteria + upstream asks

CARRIED_RANK = {"open": 0, "covered": 1, "dropped": 2}
CARRIED_CLASS = {"open": "open", "covered": "ok", "dropped": "off"}
UA_RANK = {"open": 0, "filed": 1, "adopted": 2, "bypassed": 3, "declined": 4}
UA_CLASS = {"open": "open", "filed": "ok", "adopted": "ok", "bypassed": "off", "declined": "off"}


def carried_status_cell(c: dict) -> str:
    """`open` / `covered (#12)` / `dropped (why)`; a status cell the parser could not read is shown
    as open (the parser's fail-safe reading) together with the raw text, in red."""
    status = str(c.get("status") or "open")
    detail = c.get("status_detail")
    raw = str(c.get("status_raw") or "").strip()
    label = f"{status} ({detail})" if detail else status
    if raw and not raw.lower().startswith(status):
        return f'<span class="st bad" title="status cell {esc(raw)} is not open | covered (…) | dropped (…); read as open">open · unparsed {esc(raw)}</span>'
    return f'<span class="st {CARRIED_CLASS.get(status, "bad")}">{esc(label)}</span>'


def row_ref(rid, plan_rows: dict | None, current: str | None = None) -> str:
    """A row id as a link to its page when it is a plan row with a safe id; flagged when the plan is
    readable and does not know it (a phase name such as `P4`, a typo) or when it is a DEFER row —
    the to-row of a carried criterion must be a dispatched plan row, never a phase."""
    rid = str(rid or "").strip()
    if not rid:
        return '<span class="st bad">no row</span>'
    if plan_rows is not None and rid not in plan_rows:
        return f'<span class="st bad" title="not a plan row: a deferral names a target ROW, never a phase">{esc(rid)} · not a plan row</span>'
    if plan_rows is not None and (plan_rows.get(rid) or {}).get("batch") == "defer":
        return f'<span class="st bad" title="DEFER rows are never dispatched">{esc(rid)} · DEFER row</span>'
    if rid == current:
        return f"<b>{esc(rid)}</b>"
    if SAFE_RID_RE.match(rid):
        return f'<a href="{esc(rid)}.html">{esc(rid)}</a>'
    return esc(rid)


def sort_carried(items: list) -> list:
    return sorted(enumerate(items), key=lambda t: (CARRIED_RANK.get(str(t[1].get("status") or "open"), 0), t[0]))


def carried_for(tables: dict | None, rid: str, key: str) -> list:
    """The carried criteria whose `key` (`to_row` / `from_row`) is `rid`, open first, file order within a status."""
    items = [c for c in ((tables or {}).get("carried") or []) if str(c.get(key) or "") == rid]
    return [c for _, c in sort_carried(items)]


def open_carried_for(tables: dict | None, rid: str) -> list:
    return [c for c in carried_for(tables, rid, "to_row") if str(c.get("status") or "open") == "open"]


def carried_badge(tables: dict | None, rid: str) -> str:
    ids = [str(c.get("criterion")) for c in open_carried_for(tables, rid)]
    if not ids:
        return ""
    return f'<span class="badge" title="carries open criteria: {esc(", ".join(ids))}">carries {len(ids)}</span>'


def table_banners(tables: dict | None) -> list:
    """Banner lines for the two tables: a missing or unreadable file, and malformed carried rows."""
    t = tables or {}
    out = []
    if t.get("carried_err"):
        out.append(f"carried criteria unavailable — {t['carried_err']}")
    for p in t.get("carried_problems") or []:
        out.append(f"ledger.md § Carried criteria: {p}")
    if t.get("asks_err"):
        out.append(f"upstream asks unavailable — {t['asks_err']}")
    return out


def carried_table(items: list, plan_rows: dict | None, current: str | None, direction: str) -> str:
    """One table of carried criteria. `direction` is "both" (criterion · from → to), "from" (the
    from-row column only: the row page's Carries block) or "to" (the Deferred-from block)."""
    head = {"both": "from → to", "from": "from", "to": "to"}[direction]
    out = [f'<table class="tbl"><tr><th>criterion</th><th>{head}</th><th>status</th><th>reason</th><th>decided</th></tr>']
    for c in items:
        frm, to = row_ref(c.get("from_row"), None, current), row_ref(c.get("to_row"), plan_rows, current)
        where = {"both": f"{frm} → {to}", "from": frm, "to": to}[direction]
        out.append(f'<tr><td><code>{esc(c.get("criterion"))}</code></td><td>{where}</td><td>{carried_status_cell(c)}</td>'
                   f'<td>{esc(c.get("reason") or "")}</td><td><small>{esc(c.get("decided") or "")}</small></td></tr>')
    out.append("</table>")
    return "".join(out)


def ua_disposition_cell(a: dict) -> str:
    disp = str(a.get("disposition") or "open")
    detail = a.get("disposition_detail")
    label = f"{disp} ({detail})" if detail else disp
    if not a.get("disposition_ok", True):
        raw = str(a.get("disposition_raw") or "").strip()
        return f'<span class="st bad" title="disposition {esc(raw)} is not open | filed (…) | bypassed (…) | declined (…) | adopted (…)">open · unparsed {esc(raw)}</span>'
    return f'<span class="st {UA_CLASS.get(disp, "bad")}">{esc(label)}</span>'


def sort_asks(items: list) -> list:
    return [a for _, a in sorted(enumerate(items), key=lambda t: (UA_RANK.get(str(t[1].get("disposition") or "open"), 0), t[0]))]


def asks_table(items: list, plan_rows: dict | None, current: str | None = None, with_source: bool = True) -> str:
    cols = "<th>id</th>" + ("<th>source row</th>" if with_source else "") + "<th>disposition</th><th>ask</th>"
    out = [f'<table class="tbl"><tr>{cols}</tr>']
    for a in items:
        uid = esc(a.get("id"))
        if not a.get("id_ok", True):
            uid = f'<span class="st bad" title="id is not UA-&lt;n&gt;">{uid}</span>'
        ask = str(a.get("ask") or "")
        cite = str(a.get("citation") or "").strip()
        ask_cell = f'<span title="{esc(ask)}">{esc(truncate(ask))}</span>' + (f'<br><small><code>{esc(cite)}</code></small>' if cite else "")
        src = f"<td>{row_ref(a.get('source_row'), None, current)}</td>" if with_source else ""
        out.append(f"<tr><td><b>{uid}</b></td>{src}<td>{ua_disposition_cell(a)}</td><td class=\"ask\">{ask_cell}</td></tr>")
    out.append("</table>")
    return "".join(out)


def render_tables_index(tables: dict | None, plan_rows: dict | None) -> str:
    """The index page's two sections. Every input optional: an unavailable table says so in place."""
    t = tables or {}
    out = []
    carried = [c for _, c in sort_carried(list(t.get("carried") or []))]
    n_open = sum(1 for c in carried if str(c.get("status") or "open") == "open")
    out.append(f'<h2>Carried criteria <small>{n_open} open · {len(carried)} total</small></h2>')
    out.append('<p class="muted">Criteria one row deferred onto another (ledger.md § Carried criteria, written by the Orchestrator the moment '
               'a criterion leaves a PR). An open criterion is dispatched with its target row and checked at that row\'s merge gate; '
               'the target is always a plan ROW, never a phase.</p>')
    if t.get("carried_err"):
        out.append(f'<div class="banner">{esc(t["carried_err"])}</div>')
    elif not carried:
        out.append("<p><em>no carried criteria recorded</em></p>")
    else:
        out.append(carried_table(carried, plan_rows, None, "both"))
    asks = sort_asks(list(t.get("asks") or []))
    n_open_asks = sum(1 for a in asks if str(a.get("disposition") or "open") == "open")
    out.append(f'<h2>Upstream asks <small>{n_open_asks} open · {len(asks)} total</small></h2>')
    out.append('<p class="muted">Core-change candidates the plugin surface cannot absorb (upstream-asks.md § Upstream asks, written by the '
               'Orchestrator the moment one is surfaced, disposition updated when filed / bypassed / declined / adopted).</p>')
    if t.get("asks_err"):
        out.append(f'<div class="banner">{esc(t["asks_err"])}</div>')
    elif not asks:
        out.append("<p><em>no upstream asks recorded</em></p>")
    else:
        out.append(asks_table(asks, plan_rows))
    return "".join(out)


def render_tables_row(tables: dict | None, rid: str, plan_rows: dict | None) -> str:
    """The row page's Carries / Deferred-from blocks (+ the row's upstream asks, when any)."""
    t = tables or {}
    out = []
    carries = carried_for(t, rid, "to_row")
    n_open = sum(1 for c in carries if str(c.get("status") or "open") == "open")
    out.append(f'<h2>Carries <small>{n_open} open · {len(carries)} total</small></h2>')
    out.append('<p class="muted">Criteria other rows deferred onto this row. Each open one must appear verbatim, under its own id, in this '
               'row\'s ADR § Acceptance criteria and be a PASS row in the Test Report — the merge gate (P5) is red otherwise.</p>')
    if t.get("carried_err"):
        out.append(f'<div class="banner">{esc(t["carried_err"])}</div>')
    elif not carries:
        out.append("<p><em>carries no criteria from other rows</em></p>")
    else:
        out.append(carried_table(carries, plan_rows, rid, "from"))
    deferred = carried_for(t, rid, "from_row")
    n_open_d = sum(1 for c in deferred if str(c.get("status") or "open") == "open")
    out.append(f'<h2>Deferred from this row <small>{n_open_d} open · {len(deferred)} total</small></h2>')
    if t.get("carried_err"):
        out.append(f'<div class="banner">{esc(t["carried_err"])}</div>')
    elif not deferred:
        out.append("<p><em>nothing deferred from this row</em></p>")
    else:
        out.append(carried_table(deferred, plan_rows, rid, "to"))
    asks = sort_asks([a for a in (t.get("asks") or []) if str(a.get("source_row") or "") == rid])
    if asks:
        out.append(f'<h2>Upstream asks from this row <small>{len(asks)}</small></h2>')
        out.append(asks_table(asks, plan_rows, rid, with_source=False))
    return "".join(out)


def page(title: str, body: str, generated: str, crumbs: str = "", nav: str = "") -> str:
    """`crumbs` sits above the <h1>, `nav` right under it (the index's one "Demo path →" link)."""
    return (
        f'<!doctype html><html><head><meta charset="utf-8"><title>{esc(title)}</title><style>{CSS}</style></head><body>'
        f'{crumbs}<h1>{esc(title)}</h1>{nav}{body}'
        f'<p><small>generated {esc(generated)} · source groups/*/reports/hermes-*/cards/ · '
        f'<a href="../status/autopilot.md">status/autopilot.md</a> · <a href="../explanations/">explanations</a></small></p></body></html>\n'
    )


def render_index(plan, plan_err, cards: dict, banners: list, now: datetime, records: dict, live_err: str | None = None,
                 tables: dict | None = None) -> str:
    """The board's index over the per-row records (build_records): the same objects the row pages and
    the demo-path tracker render from."""
    now_ts = now.timestamp()
    out = []
    for b in list(banners) + table_banners(tables):
        out.append(f'<div class="banner">{esc(b)}</div>')
    if live_err:
        out.append(f'<div class="banner">live status unavailable — {esc(live_err)}; dots show grey</div>')
    out.append('<p class="legend">live status per role (from <code>ncl sessions list</code> at generation time): '
               '<span class="dot green"></span>working (container running) <span class="dot amber"></span>idle (session, no container) '
               '<span class="dot red"></span>needs input (cost card / hold / blocked / escalated) <span class="dot grey"></span>no session</p>')
    if plan_err:
        out.append(f'<div class="banner bad">plan unreadable — {esc(plan_err)}; showing only threads that have cards</div>')
    out.append('<p class="muted">One 900×600 card per finished role task (a architect · b builder · t tester · r reviewer), '
               'newest per role; border colour is the verdict. Click a card for the row page.</p>')

    rows = (plan or {}).get("rows") or {}
    order = (plan or {}).get("order") or sorted(rows)
    by_batch: dict = {}
    for rid in order:
        by_batch.setdefault(rows[rid].get("batch") or "other", []).append(rid)
    planned = set(rows)
    extra = sorted(rid for rid in (THREAD_RE.match(t).group("row") for t in cards) if rid not in planned)
    sections = [(b, by_batch[b]) for b in BATCH_ORDER if b in by_batch]
    sections += [(b, ids) for b, ids in by_batch.items() if b not in BATCH_ORDER]
    if extra:
        sections.append(("unplanned", extra))
    if not sections:
        out.append('<p><em>no rows: no readable plan and no cards yet</em></p>')

    total = 0
    for batch, ids in sections:
        title = BATCH_TITLES.get(batch, "Threads with cards that are not in the plan" if batch == "unplanned" else f"Batch {batch}")
        n_cards = sum(len(e["cards"]) for rid in ids for e in (cards.get(f"hermes-{rid}") or {}).values())
        total += n_cards
        out.append(f'<h2>{esc(title)} <small>{len(ids)} rows · {n_cards} cards</small></h2>')
        out.append('<table><tr><th>row</th><th>name</th><th>stage</th><th>a</th><th>b</th><th>t</th><th>r</th></tr>')
        for rid in ids:
            rec = records[rid]
            groups = rec["cards"]
            prow = rec["plan"]
            name = rec["name"]
            disp = prow.get("plan_disposition") or ""
            meta = " · ".join(x for x in (disp, f"wave {prow['wave']}" if prow.get("wave") else "", prow.get("attaches_to") or "") if x)
            safe = rec["safe"]   # run() writes no page for an unsafe id: no link to it
            dots = rec["dots"]
            cells = "".join(thumb_cell(groups, role, rid, now_ts, link=safe, live=dots[role]) for _, role in ROLE_COLUMNS)
            row_dot = rec["row_dot"]
            orch = dots["orchestrator"]
            id_cell = (f'<a href="{esc(rid)}.html"><b>{esc(rid)}</b></a>' if safe else f'<b>{esc(rid)}</b>') + carried_badge(tables, rid)
            out.append(
                f'<tr><td><span class="dot {row_dot}" title="{esc(LIVE_LABEL[row_dot])}"></span>{id_cell}<br><code>hermes-{esc(rid)}</code>'
                f'<br><span class="live" title="orchestrator"><span class="dot {orch[0]}"></span>orchestrator: {esc(orch[1])}</span></td>'
                f'<td>{esc(name)}<br><small>{esc(meta)}</small></td><td class="stage">{esc(rec["stage"]) or "·"}</td>{cells}</tr>'
            )
        out.append("</table>")
    out.append(render_tables_index(tables, rows if plan else None))
    n_open = sum(1 for c in ((tables or {}).get("carried") or []) if str(c.get("status") or "open") == "open")
    n_asks = sum(1 for a in ((tables or {}).get("asks") or []) if str(a.get("disposition") or "open") == "open")
    out.insert(0, f'<p class="muted">{total} cards on disk · {len(cards)} threads with cards · {n_open} open carried criteria · {n_asks} open upstream asks</p>')
    return page("Hermes port · rows board", "".join(out), now.strftime("%Y-%m-%d %H:%M UTC"), nav=DEMO_NAV)


def render_row(rec: dict, plan, now: datetime, dashboard_url: str | None, live_err: str | None = None, tables: dict | None = None) -> str:
    """One row page from its record (build_records) — the same object the index and the tracker use."""
    now_ts = now.timestamp()
    rid = rec["id"]
    thread = rec["thread"]
    row = rec["plan"]
    groups = rec["cards"]
    links = ['<a href="index.html">← rows board</a>', '<a href="../adr/">/adr/</a>', f'<a href="../test-reports/{esc(thread)}/">/test-reports/{esc(thread)}/</a>']
    if dashboard_url:
        links.append(f'<a href="{esc(dashboard_url.rstrip("/"))}/#/cw/orchestrator/l/{esc(thread)}">dashboard lane</a>')
    body = [f'<p class="links">{" ".join(links)}</p>']
    meta = " · ".join(x for x in (f"batch {row.get('batch')}" if row.get("batch") else "", row.get("plan_disposition") or "",
                                  f"wave {row['wave']}" if row.get("wave") else "", row.get("attaches_to") or "") if x)
    body.append(f'<p>{esc(row.get("name") or "")}<br><small>{esc(meta)}</small></p>')
    body.append(f'<p class="stage">stage: <b>{esc(rec["stage"]) or "unknown"}</b> · thread <code>{esc(thread)}</code>{carried_badge(tables, rid)}</p>')
    body.append(render_tables_row(tables, rid, ((plan or {}).get("rows") or None) if plan else None))

    body.append("<h2>Live sessions</h2>")
    if live_err:
        body.append(f'<div class="banner">live status unavailable — {esc(live_err)}</div>')
    body.append('<table class="live-sessions"><tr><th></th><th>role</th><th>status</th><th>session</th><th>container</th><th>last active</th></tr>')
    for role in ROLE_ORDER:
        sessions = rec["sessions"][role]
        colour, label = rec["dots"][role]
        if not sessions:
            body.append(f'<tr><td><span class="dot {colour}"></span></td><td>{esc(role)}</td><td>{esc(label)}</td><td colspan="3" class="muted">—</td></tr>')
            continue
        for x in sorted(sessions, key=lambda y: str(y.get("last_active") or ""), reverse=True):
            sid = str(x.get("id") or "")
            link = (f'<a href="{esc(dashboard_url.rstrip("/"))}/#/cw/{esc(x.get("group_folder") or role)}/s/{esc(sid)}">{esc(sid)}</a>'
                    if dashboard_url and sid else esc(sid))
            stray = x.get("thread_id") if x.get("thread_id") and x.get("thread_id") != thread else None
            note = f' <span class="badge" title="this session lives on a mis-cased thread; messages to it must name that thread">thread {esc(stray)}</span>' if stray else ""
            body.append(f'<tr><td><span class="dot {colour}"></span></td><td>{esc(role)}</td><td>{esc(label)}</td><td><code>{link}</code>{note}</td>'
                        f'<td>{esc(x.get("container_status") or "?")} / {esc(x.get("status") or "?")}</td><td>{esc(x.get("last_active") or "")}</td></tr>')
    body.append("</table>")

    all_cards = sorted((c for e in groups.values() for c in e["cards"]), key=lambda c: (-c["mtime"], -c["round"], c["file"]))
    if not all_cards:
        body.append('<p><em>no cards yet on this thread</em></p>')
    for c in all_cards:
        base = f"cards/{c['group']}/{c['thread']}/"
        title = f"{c['role']} · {c['outcome'].upper()} · round {c['round']}"
        files = " · ".join(
            f'<a href="{esc(base + c[k])}">{k}</a>' for k in ("png", "html", "json") if c.get(k)
        )
        img = (f'<a href="{esc(base + c["png"])}"><img class="{c["cls"]}" src="{esc(base + c["png"])}" alt="{esc(title)}" loading="lazy"></a>'
               if c.get("png") else f'<p class="v {c["cls"]}">PNG missing — <a href="{esc(base + c["html"])}">open the HTML card</a></p>')
        body.append(
            f'<div class="card"><div class="v {c["cls"]}">{esc(title)} <span class="muted">· {esc(fmt_stamp(c["mtime"]))} '
            f'({esc(fmt_age(now_ts - c["mtime"]))} ago) · {files}</span></div>{img}</div>'
        )
    return page(f"{rid} · {row.get('name') or thread}", "".join(body), now.strftime("%Y-%m-%d %H:%M UTC"))


# --------------------------------------------------------------------------- per-row records (the one computation)

def build_record(rid: str, plan, state, groups: dict, live: dict, now: datetime, tables: dict | None, config: dict | None = None) -> dict:
    """One row's record — everything the index cell, the row page and the demo-path tracker show about it:

      id, thread, safe          `hermes-<ROW>`; safe = usable as a page filename / link target
      in_plan, plan, name       the dispatch-plan row ({} when the plan does not list it): batch, name,
                                plan_disposition, wave, attaches_to
      batch, disposition        the queue row's, else the plan's (Disp column, upper-cased); None when neither knows
      queue, queue_state        state.json rows[rid] (hermes_queue.build_state: state, state_reason,
                                disposition, batch, paused, dispatched_at, ledger …) and its `state` — raw inputs
      sup, sup_stage            state.json supervise.rows[rid] (hermes_supervise: stage, reason, hold,
                                cost_hold, action, alert_kind, target_role, pr, head …) and its `stage` — raw inputs
      state, state_reason,      THE row state (row_state — the one derivation every surface renders): merged |
      waived, paused, gates,    paused | blocked | deferred | an in-flight stage | waiting | queued | carried …,
      holds                     None when unknown (state_reason says why); config.waive / paused; a waiting row's
                                unmet gates; the supervisor's holds ({"kind": gate | hold | cost | escalated, "label"})
      stage                     the text the index cell and the row page show: row_stage(record) — the state plus
                                its decorations (`· hold X` · `· cost hold` · `· waived`), "" when unknown
      sessions, dots, row_dot   {role: [ncl session]} on the thread, {role: (colour, label)} (role_live)
                                and the row's own dot (row_live)
      cards, latest             scan_cards' {group: entry} for the thread; {role: newest card}
      ledger, merged_at         the ledger's work-item row (parse_ledger entry: dispatched, pr, verdict,
                                outcome merged | blocked | gate_red, merge_sha, reason, gate_red) plus
                                merged_at (ISO, merged rows only); None when the ledger has no row
      carries_open              ids of the open criteria other rows deferred onto this one
    """
    rows = (plan or {}).get("rows") or {}
    prow = rows.get(rid) if isinstance(rows.get(rid), dict) else {}
    st = state if isinstance(state, dict) else {}
    qrows = st.get("rows") if isinstance(st.get("rows"), dict) else {}
    qrow = qrows.get(rid) if isinstance(qrows.get(rid), dict) else {}
    sup_rows = (st.get("supervise") or {}).get("rows") if isinstance(st.get("supervise"), dict) else None
    sup = sup_rows.get(rid) if isinstance(sup_rows, dict) and isinstance(sup_rows.get(rid), dict) else {}
    sessions = {role: list((live.get(rid) or {}).get(role) or []) for role in ROLE_ORDER}
    dots = {role: role_live(sessions[role], sup, role, now) for role in ROLE_ORDER}
    t = tables or {}
    led = (t.get("ledger_rows") or {}).get(rid)
    ledger = dict(led, merged_at=(t.get("merged_at") or {}).get(rid)) if isinstance(led, dict) else None
    rec = {
        "id": rid, "thread": f"hermes-{rid}", "safe": bool(SAFE_RID_RE.match(rid)),
        "in_plan": rid in rows, "plan": prow, "name": prow.get("name") or "",
        "batch": qrow.get("batch") or prow.get("batch"),
        "disposition": (str(qrow.get("disposition") or prow.get("plan_disposition") or "").upper() or None),
        "queue": qrow, "queue_state": qrow.get("state"),
        "sup": sup, "sup_stage": sup.get("stage"),
        "sessions": sessions, "dots": dots, "row_dot": row_live(dots),
        "cards": groups, "latest": {role: latest_for_role(groups, role)[0] for _, role in ROLE_COLUMNS},
        "ledger": ledger, "merged_at": ledger.get("merged_at") if ledger else None,
        "carries_open": [str(c.get("criterion")) for c in open_carried_for(tables, rid)],
    }
    rec.update(row_state(rid, qrow, sup, ledger, config, state))
    rec["stage"] = row_stage(rec)
    return rec


def build_records(plan, state, cards: dict, live: dict | None, now: datetime, tables: dict | None = None, config: dict | None = None) -> dict:
    """{rid: record} for every plan row and every `hermes-<ROW>` card thread — the rows the board writes
    pages for — in plan order, unplanned card threads after, sorted."""
    rows = (plan or {}).get("rows") or {}
    order = list((plan or {}).get("order") or sorted(rows))
    order += sorted(rid for rid in (THREAD_RE.match(t).group("row") for t in cards) if rid not in rows)
    live = live or {}
    return {rid: build_record(rid, plan, state, cards.get(f"hermes-{rid}") or {}, live, now, tables, config) for rid in order}


def load_board(root: str, now: datetime, plan_paths: list | None = None, state_path: str | None = None, threads_path: str | None = None,
               ncl_bin: str | None = None, ledger_path: str | None = None, asks_path: str | None = None, config_path: str | None = None) -> dict:
    """Read every input once and build the per-row records. Pure reads (no write under <WWW>): run()
    renders and writes, demo_path.py's CLI calls this too. Never raises on a bad input — each becomes
    an error string / banner and the records still build.

    {"plan", "plan_err", "state", "state_err", "config", "config_err", "threads", "threads_err", "tables",
     "cards", "live", "live_err", "banners", "records", "paths": {...}}"""
    ap_dir = os.path.join(root, "data", "shared", "hermes", "autopilot")
    reports = os.path.join(root, "groups", "orchestrator", "reports")
    paths = {
        "plan": plan_paths or [os.path.join(root, "docs", "hermes-port", "dispatch-plan.md"), os.path.join(root, "data", "shared", "hermes", "dispatch-plan.md")],
        "state": state_path or os.path.join(ap_dir, "state.json"),
        "threads": threads_path or os.path.join(ap_dir, "threads.json"),
        "config": config_path or os.path.join(ap_dir, "config.json"),
        "ledger": ledger_path or os.path.join(reports, "ledger.md"),
        "asks": asks_path or os.path.join(reports, "upstream-asks.md"),
    }
    plan, plan_err = load_plan(paths["plan"])
    state, state_err = load_json(paths["state"])
    config, config_err = load_json(paths["config"])
    threads, threads_err = load_json(paths["threads"])
    tables = load_tables(paths["ledger"], paths["asks"])
    for b in table_banners(tables):
        log(b)
    banners = [b for b in (staleness(state, state_err, "state.json", now), staleness(threads, threads_err, "threads.json", now)) if b]
    if ROWID_ERR:
        banners.append(ROWID_ERR)
    try:
        cards = scan_cards(root)
    except Exception as exc:  # noqa: BLE001
        log(f"card scan failed: {type(exc).__name__}: {exc}")
        cards = {}
        banners.append(f"card scan failed: {exc}")
    live, live_err = load_live_sessions(ncl_bin, roles_by_group(threads))
    if live_err:
        log(f"live status: {live_err}")
    return {
        "plan": plan, "plan_err": plan_err, "state": state, "state_err": state_err, "config": config, "config_err": config_err,
        "threads": threads, "threads_err": threads_err, "tables": tables, "cards": cards, "live": live, "live_err": live_err,
        "banners": banners, "records": build_records(plan, state, cards, live, now, tables, config), "paths": paths,
    }


# --------------------------------------------------------------------------- main

def run(root: str, www: str, now: datetime, plan_paths: list, state_path: str, threads_path: str, dashboard_url: str | None, ncl_bin: str | None = None,
        ledger_path: str | None = None, asks_path: str | None = None, demo_spec: str | None = None, config_path: str | None = None) -> int:
    www_rows = os.path.join(www, "rows")
    os.makedirs(www_rows, exist_ok=True)

    board = load_board(root, now, plan_paths, state_path, threads_path, ncl_bin, ledger_path, asks_path, config_path)
    plan, plan_err, cards, tables = board["plan"], board["plan_err"], board["cards"], board["tables"]
    live, live_err, banners, records = board["live"], board["live_err"], board["banners"], board["records"]
    link_card_dirs(www_rows, cards)

    # The demo path: computed once over the records; its own page + the JSON slack-rows.py reads. A failure
    # (compute, serialise or write) is one banner on demo-path.html and the JSON is left as it was (slack-rows
    # sees it age out); the board below writes regardless.
    _result, demo_body, demo_json = demo_tracker(board, now, demo_spec)
    demo_ok = write_demo_path(www_rows, demo_body, demo_json, now)

    write_atomic(os.path.join(www_rows, "index.html"), render_index(plan, plan_err, cards, banners, now, records, live_err, tables))
    written = 0
    for rid in sorted(records):
        rec = records[rid]
        if not rec["safe"]:
            log(f"skipping row id {rid!r} (not a safe filename)")
            continue
        try:
            write_atomic(os.path.join(www_rows, f"{rid}.html"), render_row(rec, plan, now, dashboard_url, live_err, tables))
            written += 1
        except Exception as exc:  # noqa: BLE001 - one bad row must not take the board down
            log(f"row page {rid}: {type(exc).__name__}: {exc}")
    n_cards = sum(len(e["cards"]) for g in cards.values() for e in g.values())
    n_live = sum(len(v) for r in live.values() for v in r.values())
    n_open = sum(1 for c in tables["carried"] if str(c.get("status") or "open") == "open")
    stray = miscased_sessions(live)
    stray_dirs = sorted({c["thread"] for g in cards.values() for e in g.values() for c in e["cards"] if c["thread"] != canon_thread(c["thread"])})
    thread_case = ""
    if stray or stray_dirs:
        # a role opened its session / wrote its cards on a mis-cased row thread (attributed to the row above; the spine owns the fix)
        thread_case = "; thread-case: " + ", ".join(
            [f"{rid} {role} {sid} on {t}" for rid, role, sid, t in stray] + [f"card dir {t}" for t in stray_dirs])
    print(f"rows-board: wrote {www_rows}/index.html + {written} row pages + demo-path.html{' + demo-path.json' if demo_ok else ' (tracker failed; demo-path.json untouched)'} "
          f"({n_cards} cards, {len(cards)} threads, {n_live} live sessions on {len(live)} rows, "
          f"{n_open}/{len(tables['carried'])} carried criteria open, {len(tables['asks'])} upstream asks)"
          + (f"; plan: {plan_err}" if plan_err else "") + (f"; live: {live_err}" if live_err else "")
          + (f"; {'; '.join(banners + table_banners(tables))}" if banners or table_banners(tables) else "") + thread_case)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Hermes port rows board: task cards per gap-matrix row under <WWW>/rows/ (+ the demo-path tracker page)")
    ap.add_argument("--root", default=os.environ.get("NANOCLAW_ROOT") or os.getcwd(), help="nanoclaw checkout (groups/, data/, docs/)")
    ap.add_argument("--www", default=os.environ.get("NEMO_WWW_DIR") or os.path.expanduser("~/.local/share/nemo-www"), help="viewer root (8091)")
    ap.add_argument("--plan", default=None, help="dispatch-plan.md (default: <root>/docs/hermes-port/, then <root>/data/shared/hermes/)")
    ap.add_argument("--state", default=None, help="state.json (default: <root>/data/shared/hermes/autopilot/state.json)")
    ap.add_argument("--threads", default=None, help="threads.json (default: next to state.json)")
    ap.add_argument("--config", default=None, help="autopilot config.json, for the demo path's wip / waive / paused_rows (default: next to state.json)")
    ap.add_argument("--ledger", default=None, help="the Orchestrator's ledger.md, for its ## Carried criteria table (default: <root>/groups/orchestrator/reports/ledger.md)")
    ap.add_argument("--upstream-asks", default=None, help="the Orchestrator's upstream-asks.md (default: <root>/groups/orchestrator/reports/upstream-asks.md)")
    ap.add_argument("--dashboard-url", default=os.environ.get("DASHBOARD_URL"), help="dashboard base URL for the lane deep link (default: $DASHBOARD_URL)")
    ap.add_argument("--ncl", default=os.environ.get("NANOCLAW_NCL"), help="ncl binary for live session status (default: <root>/bin/ncl when present; '' disables)")
    ap.add_argument("--demo-spec", default=os.environ.get("DEMO_PATH_SPEC"), help="demo-path.json spec for the Demo path page (default: next to this script)")
    ap.add_argument("--now", default=None, help="ISO timestamp (tests)")
    try:
        args = ap.parse_args(argv)
        now = parse_iso(args.now) or datetime.now(timezone.utc)
        root = os.path.abspath(args.root)
        ap_dir = os.path.join(root, "data", "shared", "hermes", "autopilot")
        plan_paths = [args.plan] if args.plan else [
            os.path.join(root, "docs", "hermes-port", "dispatch-plan.md"),
            os.path.join(root, "data", "shared", "hermes", "dispatch-plan.md"),
        ]
        ncl_bin = args.ncl
        if ncl_bin is None:
            cand = os.path.join(root, "bin", "ncl")
            ncl_bin = cand if os.path.exists(cand) else None
        return run(
            root, os.path.abspath(args.www), now, plan_paths,
            args.state or os.path.join(ap_dir, "state.json"),
            args.threads or os.path.join(ap_dir, "threads.json"),
            args.dashboard_url or None,
            ncl_bin or None,
            args.ledger or None,
            args.upstream_asks or None,
            args.demo_spec or None,
            args.config or None,
        )
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - never raise to refresh-viewers.sh
        log(f"failed: {type(exc).__name__}: {exc}")
        try:
            www_rows = os.path.join(os.path.abspath(args.www), "rows")
            now = datetime.now(timezone.utc)
            write_atomic(os.path.join(www_rows, "index.html"),
                         page("Hermes port · rows board", f'<div class="banner bad">rows-board failed: {esc(exc)}</div>', now.strftime("%Y-%m-%d %H:%M UTC")))
        except Exception as exc2:  # noqa: BLE001
            log(f"could not write the failure page either: {exc2}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
