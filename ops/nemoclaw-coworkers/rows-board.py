#!/usr/bin/env python3
"""rows-board.py: the /rows viewer for the Hermes port — one task card per finished role task.

Reads (every input optional; a missing or broken one becomes a banner, never a crash):

  <ROOT>/docs/hermes-port/dispatch-plan.md      the rows per batch (hermes_queue.parse_plan; falls
                                                 back to data/shared/hermes/dispatch-plan.md)
  <ROOT>/data/shared/hermes/autopilot/state.json  per-row stage (supervise.rows / rows) + generated_at
  <ROOT>/data/shared/hermes/autopilot/threads.json generated_at only (staleness banner)
  <ROOT>/groups/<group>/reports/hermes-<ROW>/cards/card-<role>-<outcome>-r<N>.{png,html,json}
                                                 plus the card-<role>-latest.{png,html} copies
  `ncl sessions list --json` (--ncl, default <ROOT>/bin/ncl)  LIVE per-role status on every row:
                                                 green = a container is running, amber = session idle,
                                                 red = needs a human (cost card / hold / blocked / escalated),
                                                 grey = no session. Roles come from threads.json `roles`.

Writes under <WWW>/rows/ (tmp + rename):

  index.html      batch → rows → a | b | t | r: the latest card per role as a 180 px thumbnail,
                  bordered in the verdict colour (ok / bad / run), linking to the row page
  <ROW>.html      every card on the row newest-first with its .html / .json, links to /adr/,
                  /test-reports/<thread>/ and the dashboard lane ($DASHBOARD_URL/#/cw/orchestrator/l/hermes-<ROW>)
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
ROLE_COLUMNS = (("a", "hermes-architect"), ("b", "hermes-builder"), ("t", "hermes-tester"), ("r", "hermes-reviewer"))
ROLE_ORDER = [r for _, r in ROLE_COLUMNS] + ["orchestrator"]
BATCH_ORDER = ("1a", "1b", "2", "3", "4", "adopt", "defer")
BATCH_TITLES = {
    "1a": "Batch 1a · P2 · the compose plugin",
    "1b": "Batch 1b · P2 · CONFIGURE rows the render must emit",
    "2": "Batch 2 · P3-waveA · gates, ledgers, the cap",
    "3": "Batch 3 · P4-sandbox",
    "4": "Batch 4 · P5-rooms-veto",
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
"""


def log(msg: str) -> None:
    sys.stderr.write(f"rows-board: {msg}\n")


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


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

def load_plan(paths: list) -> tuple:
    """(plan dict from hermes_queue.parse_plan | None, error string | None)."""
    path = next((p for p in paths if p and os.path.isfile(p)), None)
    if path is None:
        return None, "dispatch-plan.md not found (" + ", ".join(p for p in paths if p) + ")"
    try:
        sys.path.insert(0, os.path.join(HERE, "autopilot"))
        import hermes_queue  # deliberately late: its absence is a banner, not a crash
        with open(path, encoding="utf-8") as fh:
            plan = hermes_queue.parse_plan(fh.read())
        if not isinstance(plan, dict) or not isinstance(plan.get("rows"), dict):
            return None, f"parse_plan returned no rows for {path}"
        plan["path"] = path
        return plan, None
    except Exception as exc:  # noqa: BLE001 - any failure renders as "plan unreadable"
        return None, f"plan unreadable: {type(exc).__name__}: {exc}"


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
    """{thread: {group: {"dir": path, "cards": [card], "latest": {role: {ext: filename}}}}}.

    A card is {"file", "role", "outcome", "round", "ext", "mtime", "cls"}; the PNG is the unit,
    its .html / .json siblings are attached as "html" / "json" when present."""
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
        entry = {"dir": d, "cards": [], "latest": {}}
        by_stem: dict = {}
        for name in names:
            m = LATEST_RE.match(name)
            if m:
                entry["latest"].setdefault(m.group("role"), {})[m.group("ext")] = name
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
                "cls": OUTCOME_CLASS.get(outcome, "run"), "group": group, "thread": thread,
            })
        entry["cards"].sort(key=lambda c: (-c["mtime"], -c["round"], c["file"]))
        out.setdefault(thread, {})[group] = entry
    return out


def link_card_dirs(www_rows: str, cards: dict) -> None:
    """<WWW>/rows/cards/<group>/<thread> -> the group's card dir (ln -sfn semantics)."""
    for thread, groups in cards.items():
        for group, entry in groups.items():
            link = os.path.join(www_rows, "cards", group, thread)
            try:
                os.makedirs(os.path.dirname(link), exist_ok=True)
                if os.path.islink(link):
                    if os.readlink(link) == entry["dir"]:
                        continue
                    os.unlink(link)
                elif os.path.isdir(link):
                    log(f"{link} is a real directory, not replacing it")
                    continue
                os.symlink(entry["dir"], link)
            except OSError as exc:
                log(f"symlink {link}: {exc}")


# --------------------------------------------------------------------------- views


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
        m = THREAD_RE.match(str(sess.get("thread_id") or ""))
        role = group_role.get(str(sess.get("agent_group_id") or ""))
        if not m or not role:
            continue
        out.setdefault(m.group("row"), {}).setdefault(role, []).append({
            "id": sess.get("id"), "status": sess.get("status"), "container_status": sess.get("container_status"),
            "last_active": sess.get("last_active"), "group_folder": sess.get("group_folder"),
        })
    return out, None


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


def row_stage(state: dict | None, rid: str) -> str:
    if not isinstance(state, dict):
        return ""
    sup = ((state.get("supervise") or {}).get("rows") or {}).get(rid) or {}
    if sup.get("stage"):
        s = sup["stage"]
        if sup.get("hold"):
            s += f" · hold {sup['hold']}"
        if sup.get("cost_hold"):
            s += " · cost hold"
        return s
    row = (state.get("rows") or {}).get(rid) or {}
    return row.get("state") or ""


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
    latest_png = (entry["latest"].get(role) or {}).get("png")
    src = f"cards/{card['group']}/{card['thread']}/{latest_png or card['png'] or card['html']}"
    label = f"{card['outcome'].upper()} r{card['round']} · {fmt_age(now_ts - card['mtime'])}"
    img = (f'<img class="thumb {card["cls"]}" src="{esc(src)}" width="180" alt="{esc(label)}" loading="lazy">'
           if (latest_png or card["png"]) else f'<div class="thumb {card["cls"]}">html only</div>')
    if link:
        img = f'<a href="{esc(rid)}.html" title="{esc(card["file"])}">{img}</a>'
    return f'<td class="cell">{head}{img}<div class="v {card["cls"]}">{esc(label)}</div></td>'


def page(title: str, body: str, generated: str, crumbs: str = "") -> str:
    return (
        f'<!doctype html><html><head><meta charset="utf-8"><title>{esc(title)}</title><style>{CSS}</style></head><body>'
        f'{crumbs}<h1>{esc(title)}</h1>{body}'
        f'<p><small>generated {esc(generated)} · source groups/*/reports/hermes-*/cards/ · '
        f'<a href="../status/autopilot.md">status/autopilot.md</a> · <a href="../explanations/">explanations</a></small></p></body></html>\n'
    )


def render_index(plan, plan_err, state, cards: dict, banners: list, now: datetime, live: dict | None = None, live_err: str | None = None) -> str:
    now_ts = now.timestamp()
    live = live or {}
    sup_rows = ((state or {}).get("supervise") or {}).get("rows") or {} if isinstance(state, dict) else {}
    out = []
    for b in banners:
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
            groups = cards.get(f"hermes-{rid}") or {}
            name = rows.get(rid, {}).get("name") or ""
            disp = rows.get(rid, {}).get("plan_disposition") or ""
            meta = " · ".join(x for x in (disp, f"wave {rows[rid]['wave']}" if rows.get(rid, {}).get("wave") else "", rows.get(rid, {}).get("attaches_to") or "") if x)
            safe = bool(SAFE_RID_RE.match(rid))   # run() writes no page for an unsafe id: no link to it
            sup = sup_rows.get(rid) or {}
            dots = {role: role_live((live.get(rid) or {}).get(role), sup, role, now) for role in ROLE_ORDER}
            cells = "".join(thumb_cell(groups, role, rid, now_ts, link=safe, live=dots[role]) for _, role in ROLE_COLUMNS)
            row_dot = row_live(dots)
            orch = dots["orchestrator"]
            id_cell = f'<a href="{esc(rid)}.html"><b>{esc(rid)}</b></a>' if safe else f'<b>{esc(rid)}</b>'
            out.append(
                f'<tr><td><span class="dot {row_dot}" title="{esc(LIVE_LABEL[row_dot])}"></span>{id_cell}<br><code>hermes-{esc(rid)}</code>'
                f'<br><span class="live" title="orchestrator"><span class="dot {orch[0]}"></span>orchestrator: {esc(orch[1])}</span></td>'
                f'<td>{esc(name)}<br><small>{esc(meta)}</small></td><td class="stage">{esc(row_stage(state, rid)) or "·"}</td>{cells}</tr>'
            )
        out.append("</table>")
    out.insert(0, f'<p class="muted">{total} cards on disk · {len(cards)} threads with cards</p>')
    return page("Hermes port · rows board", "".join(out), now.strftime("%Y-%m-%d %H:%M UTC"))


def render_row(rid: str, plan, state, groups: dict, now: datetime, dashboard_url: str | None, live: dict | None = None, live_err: str | None = None) -> str:
    now_ts = now.timestamp()
    thread = f"hermes-{rid}"
    row = ((plan or {}).get("rows") or {}).get(rid) or {}
    links = ['<a href="index.html">← rows board</a>', '<a href="../adr/">/adr/</a>', f'<a href="../test-reports/{esc(thread)}/">/test-reports/{esc(thread)}/</a>']
    if dashboard_url:
        links.append(f'<a href="{esc(dashboard_url.rstrip("/"))}/#/cw/orchestrator/l/{esc(thread)}">dashboard lane</a>')
    body = [f'<p class="links">{" ".join(links)}</p>']
    meta = " · ".join(x for x in (f"batch {row.get('batch')}" if row.get("batch") else "", row.get("plan_disposition") or "",
                                  f"wave {row['wave']}" if row.get("wave") else "", row.get("attaches_to") or "") if x)
    body.append(f'<p>{esc(row.get("name") or "")}<br><small>{esc(meta)}</small></p>')
    stage = row_stage(state, rid)
    body.append(f'<p class="stage">stage: <b>{esc(stage) or "unknown"}</b> · thread <code>{esc(thread)}</code></p>')

    sup = (((state or {}).get("supervise") or {}).get("rows") or {}).get(rid) or {} if isinstance(state, dict) else {}
    body.append("<h2>Live sessions</h2>")
    if live_err:
        body.append(f'<div class="banner">live status unavailable — {esc(live_err)}</div>')
    body.append('<table class="live-sessions"><tr><th></th><th>role</th><th>status</th><th>session</th><th>container</th><th>last active</th></tr>')
    for role in ROLE_ORDER:
        sessions = (live or {}).get(rid, {}).get(role) or []
        colour, label = role_live(sessions, sup, role, now)
        if not sessions:
            body.append(f'<tr><td><span class="dot {colour}"></span></td><td>{esc(role)}</td><td>{esc(label)}</td><td colspan="3" class="muted">—</td></tr>')
            continue
        for x in sorted(sessions, key=lambda y: str(y.get("last_active") or ""), reverse=True):
            sid = str(x.get("id") or "")
            link = (f'<a href="{esc(dashboard_url.rstrip("/"))}/#/cw/{esc(x.get("group_folder") or role)}/s/{esc(sid)}">{esc(sid)}</a>'
                    if dashboard_url and sid else esc(sid))
            body.append(f'<tr><td><span class="dot {colour}"></span></td><td>{esc(role)}</td><td>{esc(label)}</td><td><code>{link}</code></td>'
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


# --------------------------------------------------------------------------- main

def run(root: str, www: str, now: datetime, plan_paths: list, state_path: str, threads_path: str, dashboard_url: str | None, ncl_bin: str | None = None) -> int:
    www_rows = os.path.join(www, "rows")
    os.makedirs(www_rows, exist_ok=True)

    plan, plan_err = load_plan(plan_paths)
    state, state_err = load_json(state_path)
    threads, threads_err = load_json(threads_path)
    banners = [b for b in (staleness(state, state_err, "state.json", now), staleness(threads, threads_err, "threads.json", now)) if b]
    try:
        cards = scan_cards(root)
    except Exception as exc:  # noqa: BLE001
        log(f"card scan failed: {type(exc).__name__}: {exc}")
        cards = {}
        banners.append(f"card scan failed: {exc}")
    link_card_dirs(www_rows, cards)
    live, live_err = load_live_sessions(ncl_bin, roles_by_group(threads))
    if live_err:
        log(f"live status: {live_err}")

    write_atomic(os.path.join(www_rows, "index.html"), render_index(plan, plan_err, state, cards, banners, now, live, live_err))
    rids = set((plan or {}).get("rows") or {}) | {THREAD_RE.match(t).group("row") for t in cards}
    written = 0
    for rid in sorted(rids):
        if not SAFE_RID_RE.match(rid):
            log(f"skipping row id {rid!r} (not a safe filename)")
            continue
        try:
            write_atomic(os.path.join(www_rows, f"{rid}.html"), render_row(rid, plan, state, cards.get(f"hermes-{rid}") or {}, now, dashboard_url, live, live_err))
            written += 1
        except Exception as exc:  # noqa: BLE001 - one bad row must not take the board down
            log(f"row page {rid}: {type(exc).__name__}: {exc}")
    n_cards = sum(len(e["cards"]) for g in cards.values() for e in g.values())
    n_live = sum(len(v) for r in live.values() for v in r.values())
    print(f"rows-board: wrote {www_rows}/index.html + {written} row pages ({n_cards} cards, {len(cards)} threads, {n_live} live sessions on {len(live)} rows)"
          + (f"; plan: {plan_err}" if plan_err else "") + (f"; live: {live_err}" if live_err else "") + (f"; {'; '.join(banners)}" if banners else ""))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Hermes port rows board: task cards per gap-matrix row under <WWW>/rows/")
    ap.add_argument("--root", default=os.environ.get("NANOCLAW_ROOT") or os.getcwd(), help="nanoclaw checkout (groups/, data/, docs/)")
    ap.add_argument("--www", default=os.environ.get("NEMO_WWW_DIR") or os.path.expanduser("~/.local/share/nemo-www"), help="viewer root (8091)")
    ap.add_argument("--plan", default=None, help="dispatch-plan.md (default: <root>/docs/hermes-port/, then <root>/data/shared/hermes/)")
    ap.add_argument("--state", default=None, help="state.json (default: <root>/data/shared/hermes/autopilot/state.json)")
    ap.add_argument("--threads", default=None, help="threads.json (default: next to state.json)")
    ap.add_argument("--dashboard-url", default=os.environ.get("DASHBOARD_URL"), help="dashboard base URL for the lane deep link (default: $DASHBOARD_URL)")
    ap.add_argument("--ncl", default=os.environ.get("NANOCLAW_NCL"), help="ncl binary for live session status (default: <root>/bin/ncl when present; '' disables)")
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
