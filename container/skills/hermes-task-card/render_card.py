#!/usr/bin/env python3
"""render_card.py -- one 900x600 task card (JSON + HTML) per finished role task.

Stdlib only. Maps the small task-card payload onto the vendored status renderer
(render_status.py, same directory) and injects the CSS that pins the body to
exactly 900x600 with overflow hidden, plus a header bar (role chip, row id,
verdict badge). card.sh drives this; it then screenshots the HTML with
agent-browser and verifies the PNG (see `check-png`).

Subcommands:
  render <payload.json> --thread <id> --out-dir <dir>
        validate + normalise the payload, write <dir>/card-<role>-<outcome>-r<N>.json
        and .html, print two lines on stdout: the file stem, then the role.
        exit 0 ok / 1 payload invalid (message on stderr).
  check-png <file.png>
        exit 0 iff the file exists, is > 8 KB and its IHDR says 900x600; else 3.
  fake-png <file.png>
        write a synthetic 900x600 PNG (selftest on hosts without chromium).

Payload contract (validated, over-long strings truncated with an ellipsis,
never rejected for length):

  {"row": "LOOP-F35", "role": "hermes-tester", "outcome": "FAIL", "round": 2,
   "headline": "<=90 chars",
   "what":     [<=4 strings <=90],
   "evidence": [<=4 strings <=90],
   "next":     [<=2 strings <=90],
   "meta": {"elapsed": "2h04m", "cost": "n/a", "pr_url": "https://...",
            "report": "reports/hermes-LOOP-F35/test-report-e117c1c.md", "sha": "e117c1c"}}
"""

import argparse
import importlib.util
import json
import os
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))

CARD_W = 900
CARD_H = 600
PNG_MIN_BYTES = 8 * 1024
MAX_TEXT = 90
MAX_ROW = 40
MAX_ROLE = 32

# Per-role outcome tokens -- the verdict vocabulary each role is allowed to emit.
ROLE_OUTCOMES = {
    "hermes-architect": ("HANDOFF", "RESOLVED", "BLOCKED"),
    "hermes-builder": ("SHIPPED", "FIXED", "BLOCKED"),
    "hermes-tester": ("PASS", "FAIL", "ESCALATE"),
    "hermes-reviewer": ("APPROVE", "REQUEST_CHANGES"),
    "orchestrator": ("MERGED", "BLOCKED", "DISPATCHED"),
}

# Outcome token -> row state / colour class of the vendored renderer.
OUTCOME_STATE = {
    "PASS": "ok", "APPROVE": "ok", "MERGED": "ok", "SHIPPED": "ok", "FIXED": "ok",
    "HANDOFF": "ok", "RESOLVED": "ok",
    "FAIL": "bad", "REQUEST_CHANGES": "bad", "BLOCKED": "bad",
    "ESCALATE": "run", "DISPATCHED": "run",
}

LIST_LIMITS = {"what": 4, "evidence": 4, "next": 2}
META_KEYS = ("elapsed", "cost", "pr_url", "report", "sha")

# Injected AFTER the vendored CSS so it wins on every rule it touches. The body
# is the card: fixed 900x600, nothing scrolls, four cards in a 2x2 grid.
CARD_CSS = f"""
/* --- task-card overrides (render_card.py) --- */
html,body{{width:{CARD_W}px;height:{CARD_H}px;overflow:hidden}}
body{{padding:18px 24px 14px;display:flex;flex-direction:column;box-sizing:border-box}}
.hdr{{display:flex;align-items:center;gap:10px;margin:0 0 6px}}
.chip{{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;\
padding:2px 9px;border-radius:999px;border:1px solid var(--line);color:var(--acc);background:#161b22}}
.rowid{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:var(--fg)}}
.badge{{margin-left:auto;font-size:12px;font-weight:700;letter-spacing:.06em;padding:3px 12px;\
border-radius:6px;color:#0d1117}}
.badge.ok{{background:var(--ok)}}.badge.bad{{background:var(--bad)}}.badge.run{{background:var(--run)}}
h1{{font-size:18px;margin:0 0 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.sub{{margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.headline{{margin:0 0 12px;font-size:14px;display:-webkit-box;-webkit-line-clamp:2;\
-webkit-box-orient:vertical;overflow:hidden}}
.grid{{flex:1;min-height:0;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:12px}}
.card{{overflow:hidden;min-height:0;padding:11px 14px}}
.card h2{{margin:0 0 7px}}
.row{{padding:2px 0;font-size:13px;line-height:1.35}}
.row .t{{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;\
word-break:break-word}}
.row .n{{max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
.big{{font-size:30px;line-height:1.1;margin-bottom:6px}}
/* v-* not ok/bad/run: those are the vendored DOT classes and carry a background */
.big.v-ok{{color:var(--ok)}}.big.v-bad{{color:var(--bad)}}.big.v-run{{color:var(--run)}}
footer{{margin-top:8px;padding-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
"""


def _load_renderer():
    """Import the vendored renderer by path (the skill dir is not a package)."""
    spec = importlib.util.spec_from_file_location(
        "render_status_vendored", os.path.join(HERE, "render_status.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class PayloadError(ValueError):
    """The payload is structurally unusable (missing role/row/outcome, bad token)."""


def clip(value, limit=MAX_TEXT):
    """Coerce to a single-line string and truncate with an ellipsis at `limit`."""
    if value is None:
        return ""
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
    value = " ".join(value.split())
    if len(value) > limit:
        return value[: max(limit - 1, 1)].rstrip() + "…"
    return value


def clip_list(values, count, limit=MAX_TEXT):
    """List of up to `count` clipped non-empty strings (a scalar becomes a 1-list)."""
    if values is None:
        return []
    if not isinstance(values, list):
        values = [values]
    out = []
    for item in values:
        text = clip(item, limit)
        if text:
            out.append(text)
        if len(out) >= count:
            break
    return out


def canonical_role(raw):
    role = clip(raw, MAX_ROLE).lower().strip()
    if not role:
        raise PayloadError("payload.role is required (hermes-architect|hermes-builder|hermes-tester|hermes-reviewer|orchestrator)")
    if role in ROLE_OUTCOMES:
        return role
    if "hermes-" + role in ROLE_OUTCOMES:
        return "hermes-" + role
    if role in ("main", "hermes-orchestrator"):
        return "orchestrator"
    raise PayloadError(f"payload.role {role!r} is not a known role: {', '.join(ROLE_OUTCOMES)}")


def normalize(payload):
    """Validate + normalise. Raises PayloadError only for structural problems."""
    if not isinstance(payload, dict):
        raise PayloadError("payload must be a JSON object")
    role = canonical_role(payload.get("role"))
    row = clip(payload.get("row"), MAX_ROW)
    if not row:
        raise PayloadError("payload.row is required (the gap-matrix row id, e.g. LOOP-F35)")
    outcome = clip(payload.get("outcome"), 24).upper().replace(" ", "_").replace("-", "_")
    allowed = ROLE_OUTCOMES[role]
    if outcome not in allowed:
        raise PayloadError(f"payload.outcome {outcome!r} is not valid for {role}: {'|'.join(allowed)}")
    try:
        rnd = int(payload.get("round", 1) or 1)
    except (TypeError, ValueError):
        rnd = 1
    rnd = max(rnd, 1)

    meta_in = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
    meta = {k: clip(meta_in.get(k), 200 if k in ("pr_url", "report") else MAX_TEXT) for k in META_KEYS}
    if not meta["cost"]:
        meta["cost"] = "n/a"

    return {
        "row": row,
        "role": role,
        "outcome": outcome,
        "state": OUTCOME_STATE[outcome],
        "round": rnd,
        "headline": clip(payload.get("headline")),
        "what": clip_list(payload.get("what"), LIST_LIMITS["what"]),
        "evidence": clip_list(payload.get("evidence"), LIST_LIMITS["evidence"]),
        "next": clip_list(payload.get("next"), LIST_LIMITS["next"]),
        "meta": meta,
    }


def file_stem(norm):
    return f"card-{norm['role']}-{norm['outcome'].lower()}-r{norm['round']}"


def short_role(role):
    return role.removeprefix("hermes-")


def _short_pr(url):
    """'owner/repo#123' for a GitHub PR URL, else the URL itself."""
    if not url:
        return ""
    marker = "github.com/"
    if marker in url and "/pull/" in url:
        tail = url.split(marker, 1)[1]
        parts = tail.split("/")
        if len(parts) >= 4 and parts[2] == "pull":
            return f"{parts[0]}/{parts[1]}#{parts[3]}"
    return url


def to_status_payload(norm, thread_id):
    """The task card expressed in the vendored renderer's vocabulary."""
    meta = norm["meta"]
    ref = meta["sha"] or _short_pr(meta["pr_url"])
    subtitle = " · ".join(x for x in (f"round {norm['round']}", clip(thread_id, 60), ref) if x)

    def plain_rows(items, state=None):
        rows = []
        for text in items:
            row = {"text": text}
            if state:
                row["state"] = state
            rows.append(row)
        return rows or [{"text": "—", "note": "none reported"}]

    next_rows = [{"state": "todo", "text": t} for t in norm["next"]]
    meta_rows = [
        {"text": "elapsed", "note": meta["elapsed"] or "n/a"},
        {"text": "cost", "note": meta["cost"]},
        {"text": "PR", "note": _short_pr(meta["pr_url"]) or "none"},
    ]
    return {
        "title": f"{norm['row']} · {norm['role']}",
        "subtitle": subtitle,
        "headline": norm["headline"] or f"{norm['role']} reports {norm['outcome']} on {norm['row']}.",
        "footer": meta["report"] or f"{norm['row']} · {thread_id}",
        "cards": [
            {
                "title": "Verdict",
                "kind": "metric",
                "metric": {"value": norm["outcome"], "label": f"{short_role(norm['role'])} · round {norm['round']}"},
                "rows": [{"state": norm["state"], "text": f"{norm['role']} · {norm['row']}", "note": norm["outcome"]}],
            },
            {"title": "What changed", "kind": "rows", "rows": plain_rows(norm["what"])},
            {"title": "Evidence", "kind": "rows", "rows": plain_rows(norm["evidence"])},
            {"title": "Next + meta", "kind": "rows", "rows": next_rows + meta_rows},
        ],
    }


def render_html(norm, thread_id, renderer=None):
    """Vendored render() output + injected CSS + header bar (chip / row id / badge)."""
    renderer = renderer or _load_renderer()
    esc = renderer.esc
    html = renderer.render(to_status_payload(norm, thread_id))
    # Extra CSS goes after the vendored rules so the overrides win.
    html = html.replace("</style></head>", CARD_CSS + "</style></head>", 1)
    header = (
        f'<div class="hdr"><span class="chip">{esc(short_role(norm["role"]))}</span>'
        f'<span class="rowid">{esc(norm["row"])}</span>'
        f'<span class="badge {norm["state"]}">{esc(norm["outcome"])}</span></div>\n'
    )
    html = html.replace("<h1>", header + "<h1>", 1)
    # Colour the big verdict number like the badge.
    html = html.replace('<div class="big">', f'<div class="big v-{norm["state"]}">', 1)
    return html


def check_png(path):
    """(ok, reason). ok iff the PNG exists, is > 8 KB, and IHDR reads 900x600."""
    try:
        size = os.path.getsize(path)
    except OSError as exc:
        return False, f"png missing: {exc}"
    if size <= PNG_MIN_BYTES:
        return False, f"png too small: {size} bytes (need > {PNG_MIN_BYTES})"
    with open(path, "rb") as fh:
        head = fh.read(24)
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        return False, "not a PNG (bad signature / no IHDR)"
    width, height = struct.unpack(">II", head[16:24])
    if (width, height) != (CARD_W, CARD_H):
        return False, f"png is {width}x{height}, expected {CARD_W}x{CARD_H}"
    return True, f"png ok: {width}x{height}, {size} bytes"


def _png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def write_fake_png(path, width=CARD_W, height=CARD_H):
    """Deterministic synthetic 900x600 RGB PNG, > 8 KB, for selftest without chromium."""
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # filter: none
        for x in range(width):
            rows += bytes(((x * 255) // width, (y * 255) // height, (x ^ y) & 0xFF))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(bytes(rows), 6))
        + _png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)
    return path


def render_files(payload_path, thread_id, out_dir):
    """Write <stem>.json + <stem>.html under out_dir; return (stem, norm)."""
    with open(payload_path, encoding="utf-8") as fh:
        raw = fh.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except ValueError as exc:
        raise PayloadError(f"payload is not valid JSON: {exc}") from exc
    norm = normalize(payload)
    stem = file_stem(norm)
    os.makedirs(out_dir, exist_ok=True)
    norm_out = dict(norm, thread_id=thread_id)
    with open(os.path.join(out_dir, stem + ".json"), "w", encoding="utf-8") as fh:
        json.dump(norm_out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    with open(os.path.join(out_dir, stem + ".html"), "w", encoding="utf-8") as fh:
        fh.write(render_html(norm, thread_id))
    return stem, norm


def main(argv):
    ap = argparse.ArgumentParser(prog="render_card.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("render")
    r.add_argument("payload")
    r.add_argument("--thread", required=True)
    r.add_argument("--out-dir", required=True)
    c = sub.add_parser("check-png")
    c.add_argument("png")
    f = sub.add_parser("fake-png")
    f.add_argument("png")
    args = ap.parse_args(argv)

    if args.cmd == "render":
        try:
            stem, norm = render_files(args.payload, args.thread, args.out_dir)
        except (PayloadError, OSError) as exc:
            sys.stderr.write(f"render_card.py: {exc}\n")
            return 1
        sys.stdout.write(f"{stem}\n{norm['role']}\n")
        return 0
    if args.cmd == "check-png":
        ok, reason = check_png(args.png)
        sys.stderr.write(f"render_card.py: {reason}\n")
        return 0 if ok else 3
    if args.cmd == "fake-png":
        write_fake_png(args.png)
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
