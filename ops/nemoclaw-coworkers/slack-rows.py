#!/usr/bin/env python3
"""slack-rows.py: mirror every Hermes row into one Slack thread — the row's swim lane in #hermes-port.

One ROOT message per row, then every role card as a threaded file upload, then one closing line
when the ledger says the row merged (or is blocked). Idempotent: what was posted is recorded in a
state file, so running it every 5 minutes (refresh-viewers.sh) only posts what is new.

Reads (every input optional except the token and the channel):

  <ROOT>/docs/hermes-port/dispatch-plan.md        row name + batch (hermes_queue.parse_plan via rows-board.load_plan;
                                                   falls back to data/shared/hermes/dispatch-plan.md)
  <ROOT>/groups/orchestrator/reports/ledger.md    dispatched rows, the `merged/blocked` cell (hermes_queue.parse_ledger)
  <ROOT>/groups/<group>/reports/hermes-<ROW>/cards/card-<role>-<outcome>-r<N>.png (+ .json)
                                                   the cards, found by rows-board.scan_cards; the .json gives
                                                   row / role / outcome / headline for the caption
  SLACK_BOT_TOKEN                                  from the environment, else the `SLACK_BOT_TOKEN=` line of
                                                   <ROOT>/.env. Host-side only; never printed, never logged.

Writes <ROOT>/data/shared/hermes/slack-threads.json (tmp + rename), one entry per row:

  {"channel": "C…", "rows": {"<ROW>": {"channel": "C…", "thread_ts": "…", "root_posted_at": "…",
                                       "cards": {"<png path relative to ROOT>": {"file_id": "F…", "posted_at": "…"}},
                                       "merged_posted": "…", "blocked_posted": "…"}}}

Rows mirrored: every id the ledger lists as dispatched (its work-item table) plus every `hermes-<ROW>`
card directory. Posting order per run: missing roots (plan order), then cards oldest-first across
all rows, then merge / blocked lines for rows whose cards are all up — at most --max-posts API
posts per run (rate limits; the rest lands on the next run).

Slack: a tiny urllib client. chat.postMessage for text; the current three-step upload for files
(files.getUploadURLExternal → POST bytes → files.completeUploadExternal with channel_id, thread_ts,
initial_comment). ok:false is printed as `slack error <method>: <error>` and the run goes on;
`not_in_channel` stops the run (the bot must be /invite'd) with exit 2 and no state change;
HTTP 429 honours Retry-After once. Exit 0 on success, 2 when the bot is not in the channel, 1 on
other fatal errors. A single failed card never aborts the run.

Stdlib only, no hostname guard. `--dry-run` prints what would be posted and calls nothing.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SLACK_API = "https://slack.com/api/"
DEFAULT_MAX_POSTS = 12
DEFAULT_TOKEN_ENV = "SLACK_BOT_TOKEN"  # the variable NAME, not a secret
HTTP_TIMEOUT_S = 30
MERGED_CELL_MAX = 200
THREAD_RE = re.compile(r"^hermes-(?P<row>.+)$")


def log(msg: str) -> None:
    sys.stderr.write(f"slack-rows: {msg}\n")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def squash(s, n: int = MERGED_CELL_MAX) -> str:
    s = re.sub(r"\s+", " ", str(s if s is not None else "")).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


# --------------------------------------------------------------------------- siblings

_ROWS_BOARD = None


def _rows_board():
    """rows-board.py (a hyphenated filename, so importlib): scan_cards, load_plan, load_json, write_atomic
    and, through it, the autopilot's hermes_queue parsers. Imported late so its absence is one fatal
    error with a clear message rather than an import-time crash."""
    global _ROWS_BOARD
    if _ROWS_BOARD is None:
        path = os.path.join(HERE, "rows-board.py")
        spec = importlib.util.spec_from_file_location("rows_board", path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"cannot load {path}")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _ROWS_BOARD = mod
    return _ROWS_BOARD


# --------------------------------------------------------------------------- slack client

class SlackError(Exception):
    """One failed Slack call: `method` and Slack's `error` token (or `http <code>` / `network: …`).
    Never carries a request body or header, so it is safe to print."""

    def __init__(self, method: str, error: str):
        super().__init__(f"slack error {method}: {error}")
        self.method = method
        self.error = error


class NotInChannel(SlackError):
    """The bot is not a member of the channel: nothing can be posted until it is /invite'd."""


def retry_after_s(headers) -> float:
    try:
        return max(0.0, min(float(headers.get("Retry-After", "1")), 60.0))
    except (TypeError, ValueError):
        return 1.0


class SlackClient:
    """POST-only Slack Web API client over urllib. `opener` / `sleep` are injectable for tests."""

    def __init__(self, token: str, opener=None, sleep=None):
        self._token = token
        self._open = opener or urllib.request.urlopen
        self._sleep = sleep or time.sleep

    def _post(self, method: str, url: str, data: bytes, headers: dict) -> bytes:
        """POST once, retrying a single time on HTTP 429 (Retry-After). Returns the response body."""
        for attempt in (0, 1):
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            try:
                with self._open(req, timeout=HTTP_TIMEOUT_S) as resp:
                    return resp.read()
            except urllib.error.HTTPError as exc:
                if exc.code == 429 and attempt == 0:
                    self._sleep(retry_after_s(exc.headers))
                    continue
                raise SlackError(method, f"http {exc.code}") from None
            except urllib.error.URLError as exc:
                raise SlackError(method, f"network: {exc.reason}") from None
            except (OSError, TimeoutError) as exc:
                raise SlackError(method, f"network: {type(exc).__name__}") from None
        raise SlackError(method, "http 429 (after retry)")

    def call(self, method: str, params: dict, as_json: bool = False) -> dict:
        if as_json:
            data = json.dumps(params).encode("utf-8")
            ctype = "application/json; charset=utf-8"
        else:
            data = urllib.parse.urlencode(params).encode("utf-8")
            ctype = "application/x-www-form-urlencoded"
        headers = {"Authorization": f"Bearer {self._token}", "Content-Type": ctype}
        body = self._post(method, SLACK_API + method, data, headers)
        try:
            out = json.loads(body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise SlackError(method, "non-json response") from None
        if not isinstance(out, dict) or not out.get("ok"):
            err = str((out or {}).get("error") or "unknown") if isinstance(out, dict) else "non-object response"
            if err == "not_in_channel":
                raise NotInChannel(method, err)
            raise SlackError(method, err)
        return out

    def post_message(self, channel: str, text: str, thread_ts: str | None = None) -> str:
        params: dict = {"channel": channel, "text": text, "unfurl_links": False, "unfurl_media": False}
        if thread_ts:
            params["thread_ts"] = thread_ts
        out = self.call("chat.postMessage", params, as_json=True)
        ts = out.get("ts")
        if not ts:
            raise SlackError("chat.postMessage", "no ts in response")
        return str(ts)

    def upload_file(self, channel: str, thread_ts: str, path: str, title: str, initial_comment: str) -> str:
        """files.getUploadURLExternal → POST the bytes to upload_url → files.completeUploadExternal. Returns the file id."""
        with open(path, "rb") as fh:
            data = fh.read()
        got = self.call("files.getUploadURLExternal", {"filename": os.path.basename(path), "length": len(data)})
        upload_url, file_id = got.get("upload_url"), got.get("file_id")
        if not upload_url or not file_id:
            raise SlackError("files.getUploadURLExternal", "no upload_url / file_id in response")
        # The upload URL is pre-signed: the bytes go as the raw body, no token.
        self._post("upload", str(upload_url), data, {"Content-Type": "application/octet-stream"})
        self.call("files.completeUploadExternal", {
            "files": [{"id": file_id, "title": title}],
            "channel_id": channel,
            "thread_ts": thread_ts,
            "initial_comment": initial_comment,
        }, as_json=True)
        return str(file_id)


# --------------------------------------------------------------------------- inputs

def read_token(root: str, name: str) -> str | None:
    """The bot token: the environment first, else the `NAME=value` line of <root>/.env (quotes and a
    leading `export ` tolerated). Returned, never printed."""
    v = os.environ.get(name)
    if v and v.strip():
        return v.strip()
    try:
        with open(os.path.join(root, ".env"), encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except OSError:
        return None
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        key, sep, val = line.partition("=")
        if sep and key.strip() == name:
            val = val.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                val = val[1:-1]
            return val or None
    return None


def load_state(path: str) -> dict:
    """{"channel": …, "rows": {…}}; a missing file is an empty state, an unreadable one is fatal
    (posting again into threads we cannot remember would duplicate everything)."""
    rows_board = _rows_board()
    obj, err = rows_board.load_json(path)
    if err:
        raise RuntimeError(f"state {err}")
    if obj is None:
        return {"rows": {}}
    if not isinstance(obj.get("rows"), dict):
        obj["rows"] = {}
    return obj


def load_ledger(path: str) -> tuple[dict, dict, str | None]:
    """(parse_ledger result | {}, {row-id: raw `merged/blocked` cell}, error). The raw cell is what the
    merge line quotes; parse_ledger keeps only the parsed outcome, so it is re-read from the same table
    with the same cell splitter and header-located columns."""
    if not os.path.isfile(path):
        return {}, {}, f"ledger.md not found ({path})"
    try:
        hq = _rows_board()._hermes_queue()
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        led = hq.parse_ledger(text)
        main_text, _ = hq._split_ledger_sections(text)
        raw: dict = {}
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
            if rid and i is not None and i < len(cells):
                raw[rid] = cells[i]
        return led, raw, None
    except Exception as exc:  # noqa: BLE001 - a broken ledger means no merge lines this run, never a crash
        return {}, {}, f"ledger.md unreadable: {type(exc).__name__}: {exc}"


def plan_row(plan: dict | None, rid: str) -> dict:
    rows = (plan or {}).get("rows") if isinstance(plan, dict) else None
    row = rows.get(rid) if isinstance(rows, dict) else None
    return row if isinstance(row, dict) else {}


def clean_name(s) -> str:
    return re.sub(r"\s+", " ", str(s or "").replace("**", "").replace("`", "")).strip()


def root_text(rid: str, plan: dict | None, ledger_entry: dict | None) -> str:
    """`<ROW> · <plan name> · batch <b> · dispatched <date>`; segments without data are dropped,
    the name falls back to the row id."""
    prow = plan_row(plan, rid)
    parts = [rid, clean_name(prow.get("name")) or rid]
    if prow.get("batch"):
        parts.append(f"batch {prow['batch']}")
    at = (ledger_entry or {}).get("dispatched_at")
    if isinstance(at, str) and len(at) >= 10:
        parts.append(f"dispatched {at[:10]}")
    return " · ".join(parts)


def card_caption(card: dict, rid: str, root: str) -> tuple[str, str]:
    """(initial_comment, title) for one card: `<ROW> · <role> · <OUTCOME> — <headline>` from the
    sibling .json when present, else from the filename."""
    rows_board = _rows_board()
    meta: dict = {}
    if card.get("json"):
        obj, _err = rows_board.load_json(os.path.join(card["dir"], card["json"]))
        if isinstance(obj, dict):
            meta = obj
    row = clean_name(meta.get("row")) or rid
    role = clean_name(meta.get("role")) or card["role"]
    outcome = (clean_name(meta.get("outcome")) or card["outcome"]).upper()
    headline = squash(meta.get("headline"), 200)
    caption = f"{row} · {role} · {outcome}"
    if headline:
        caption += f" — {headline}"
    return caption, f"{row} · {role} · {outcome} · r{card['round']}"


def collect_cards(root: str) -> dict:
    """{row: [card]} from rows-board.scan_cards, PNGs only, oldest first (mtime, round, name).
    Each card gains "dir", "rel" (path relative to root, the state key) and "row"."""
    rows_board = _rows_board()
    out: dict = {}
    for thread, groups in rows_board.scan_cards(root).items():
        m = THREAD_RE.match(thread)
        if not m:
            continue
        rid = m.group("row")
        for entry in groups.values():
            for card in entry["cards"]:
                if not card.get("png"):
                    continue
                c = dict(card)
                c["dir"] = entry["dir"]
                c["row"] = rid
                c["rel"] = os.path.relpath(os.path.join(entry["dir"], card["png"]), root).replace(os.sep, "/")
                out.setdefault(rid, []).append(c)
    for cards in out.values():
        cards.sort(key=lambda c: (c["mtime"], c["round"], c["rel"]))
    return out


def row_order(plan: dict | None, ledger: dict, cards: dict) -> list[str]:
    """Every row to mirror: ledger-dispatched matrix rows ∪ card threads, in plan order then by id."""
    wanted = {rid for rid, e in (ledger.get("rows") or {}).items() if isinstance(e, dict) and e.get("dispatched")}
    wanted.update(cards.keys())
    order = [rid for rid in ((plan or {}).get("order") or []) if rid in wanted]
    order += sorted(wanted.difference(order))
    return order


# --------------------------------------------------------------------------- the run

class Budget:
    def __init__(self, n: int):
        self.left = max(0, n)
        self.posted = 0

    def take(self) -> bool:
        if self.left <= 0:
            return False
        self.left -= 1
        self.posted += 1
        return True


def run(root: str, channel: str, state_path: str, client, dry_run: bool, max_posts: int,
        plan_paths: list, ledger_path: str) -> int:
    rows_board = _rows_board()
    plan, plan_err = rows_board.load_plan(plan_paths)
    if plan_err:
        log(plan_err)
    ledger, raw_cells, ledger_err = load_ledger(ledger_path)
    if ledger_err:
        log(ledger_err)
    cards = collect_cards(root)
    state = load_state(state_path)
    if state.get("channel") and state["channel"] != channel:
        log(f"state was written for channel {state['channel']}; existing threads stay there, new roots go to {channel}")
    rows = row_order(plan, ledger, cards)
    srows: dict = state["rows"]
    budget = Budget(max_posts)
    verb = "would post" if dry_run else "posted"

    def save() -> None:
        if dry_run:
            return
        state["channel"] = state.get("channel") or channel
        state["updated_at"] = now_iso()
        rows_board.write_atomic(state_path, json.dumps(state, indent=2, sort_keys=True, ensure_ascii=False) + "\n")

    # Pass A — roots, plan order. Never a second root: a row present in state is skipped.
    for rid in rows:
        if rid in srows and srows[rid].get("thread_ts"):
            continue
        if not budget.take():
            break
        text = root_text(rid, plan, (ledger.get("rows") or {}).get(rid))
        if dry_run:
            ts = "dry-run"
        else:
            try:
                ts = client.post_message(channel, text)
            except NotInChannel:
                raise
            except SlackError as exc:
                log(str(exc))
                continue
        srows[rid] = {"channel": channel, "thread_ts": ts, "root_posted_at": now_iso(), "cards": {}}
        save()
        print(f"{verb} root {rid}: {text}")

    # Pass B — cards, oldest first across every row that has a root.
    pending = [c for rid, cs in cards.items() if srows.get(rid, {}).get("thread_ts")
               for c in cs if c["rel"] not in (srows[rid].get("cards") or {})]
    pending.sort(key=lambda c: (c["mtime"], c["round"], c["rel"]))
    for card in pending:
        if not budget.take():
            break
        rid = card["row"]
        entry = srows[rid]
        caption, title = card_caption(card, rid, root)
        if dry_run:
            file_id = "dry-run"
        else:
            try:
                file_id = client.upload_file(entry.get("channel") or channel, entry["thread_ts"],
                                             os.path.join(card["dir"], card["png"]), title, caption)
            except NotInChannel:
                raise
            except SlackError as exc:
                log(f"{exc} ({card['rel']})")
                continue
        entry.setdefault("cards", {})[card["rel"]] = {"file_id": file_id, "posted_at": now_iso()}
        save()
        print(f"{verb} card {card['rel']}: {caption}")

    # Pass C — the closing line, once, after the row's cards are all up.
    still_pending = {c["rel"] for c in pending if c["rel"] not in (srows[c["row"]].get("cards") or {})}
    for rid in rows:
        entry = srows.get(rid)
        led = (ledger.get("rows") or {}).get(rid) or {}
        if not entry or not entry.get("thread_ts") or not led:
            continue
        if any(c["rel"] in still_pending for c in cards.get(rid, [])):
            continue
        outcome = led.get("outcome")
        if outcome == "merged" and not entry.get("merged_posted"):
            sha = led.get("merge_sha")
            text = f"✅ {rid} merged" + (f" {sha}" if sha else "") + f" — {squash(raw_cells.get(rid))}"
            key = "merged_posted"
        elif outcome == "blocked" and not entry.get("blocked_posted"):
            text = f"⛔ {rid} blocked — {squash(led.get('reason') or raw_cells.get(rid))}"
            key = "blocked_posted"
        else:
            continue
        if not budget.take():
            break
        if not dry_run:
            try:
                client.post_message(entry.get("channel") or channel, text, thread_ts=entry["thread_ts"])
            except NotInChannel:
                raise
            except SlackError as exc:
                log(str(exc))
                continue
        entry[key] = now_iso()
        save()
        print(f"{verb} {key[:-7]} line {rid}: {text}")

    left = sum(1 for rid in rows if not srows.get(rid, {}).get("thread_ts")) + len(still_pending)
    log(f"{verb} {budget.posted} on {len(rows)} rows ({len(srows)} threads); {left} left for the next run")
    return 0


def main(argv=None, client_factory=None) -> int:
    ap = argparse.ArgumentParser(description="Mirror every Hermes row into a Slack thread: root message, role cards, merge line.")
    ap.add_argument("--root", default=os.getcwd(), help="nanoclaw checkout (groups/, data/, docs/, .env); default cwd")
    ap.add_argument("--channel", default=os.environ.get("SLACK_ROWS_CHANNEL"), help="Slack channel id (default: $SLACK_ROWS_CHANNEL)")
    ap.add_argument("--token-env", default=DEFAULT_TOKEN_ENV, help="name of the bot-token variable, read from the environment, else <root>/.env (default: SLACK_BOT_TOKEN)")
    ap.add_argument("--state", default=None, help="state file (default: <root>/data/shared/hermes/slack-threads.json)")
    ap.add_argument("--plan", default=None, help="dispatch-plan.md (default: <root>/docs/hermes-port/, then <root>/data/shared/hermes/)")
    ap.add_argument("--ledger", default=None, help="the Orchestrator's ledger.md (default: <root>/groups/orchestrator/reports/ledger.md)")
    ap.add_argument("--dry-run", action="store_true", help="print what would be posted; no API calls, no state change")
    ap.add_argument("--max-posts", type=int, default=DEFAULT_MAX_POSTS, help=f"API posts per run, roots + cards + lines (default {DEFAULT_MAX_POSTS})")
    args = ap.parse_args(argv)
    root = os.path.abspath(args.root)
    try:
        channel = (args.channel or "").strip()
        if not channel:
            if not args.dry_run:
                log("no channel: pass --channel or set SLACK_ROWS_CHANNEL")
                return 1
            channel = "(no channel)"
        client = None
        if not args.dry_run:
            token = read_token(root, args.token_env)
            if not token:
                log(f"no token: set {args.token_env} in the environment or in {os.path.join(root, '.env')}")
                return 1
            client = (client_factory or SlackClient)(token)
        plan_paths = [args.plan] if args.plan else [
            os.path.join(root, "docs", "hermes-port", "dispatch-plan.md"),
            os.path.join(root, "data", "shared", "hermes", "dispatch-plan.md"),
        ]
        return run(
            root, channel,
            args.state or os.path.join(root, "data", "shared", "hermes", "slack-threads.json"),
            client, args.dry_run, args.max_posts, plan_paths,
            args.ledger or os.path.join(root, "groups", "orchestrator", "reports", "ledger.md"),
        )
    except NotInChannel as exc:
        log(f"{exc} — the bot is not a member of {channel}: /invite it there (channels:join is not granted), then rerun")
        return 2
    except Exception as exc:  # noqa: BLE001 - one line on stderr, exit 1; never a traceback with request details
        log(f"failed: {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
