#!/usr/bin/env python3
"""Tests for ops/nemoclaw-coworkers/slack-rows.py: a temp checkout with a small dispatch-plan.md, a
ledger and synthetic PNG cards, driven through main() with a fake Slack client (or the real urllib
client over a fake urlopen). Covers: root posted once, cards oldest-first and recorded, a second run
posts nothing, the merge / blocked / gate-red line once, not_in_channel → exit 2 with the state
untouched, a fatal token/channel error → exit 1 after one call, dry-run makes no calls, --max-posts,
a single card failure (Slack error, truncated response, unreadable or torn PNG) never aborts, a fresh
card waits to settle, the run lock, a corrupt state file is fatal, mrkdwn escaping end to end, the
token never reaches stdout/stderr, and the urllib client's three-step upload + 429 retry. DemoPathMessageTest
covers the one edited-in-place `*Demo path*` message, driven ONLY by rows-board's <www>/rows/demo-path.json
(`slack_text`, never computed here): posted once and remembered, unchanged text makes no call, changed text is
one chat.update, a failed update is logged and retried, the update is not budgeted, state_ok false means no
first post, a missing / unreadable / stale (> 45 min) JSON is one log line and the message is left untouched,
the default path derives from NEMO_WWW_DIR like rows-board's --www, dry-run prints and writes nothing, escaping
end to end, and rows-board.py → slack-rows.py agree end to end.
Run: python3 -m unittest ops/nemoclaw-coworkers/test_slack_rows.py
"""

from __future__ import annotations

import contextlib
import fcntl
import http.client
import importlib.util
import io
import json
import os
import stat
import tempfile
import time
import unittest
import urllib.error
from pathlib import Path
from typing import ClassVar

HERE = Path(__file__).resolve().parent
TOKEN = "xoxb-TEST-SECRET-TOKEN-4242"  # a fixture value the tests assert is never printed
CHANNEL = "C0TESTCHAN"
PNG_HEAD = b"\x89PNG\r\n\x1a\n"
PNG_TAIL = b"\x00\x00\x00\x00IEND\xaeB`\x82"


def png(tag: str) -> bytes:
    """A byte string shaped like a PNG (signature … IEND) — what the client's sanity check wants."""
    return PNG_HEAD + tag.encode() + PNG_TAIL


PLAN = """# Hermes port — dispatch plan (fixture)

## Batch 1a — phase P2 — the compose plugin

| Row | Name | Disp | Deliverable | AC kind |
|---|---|---|---|---|
| **LOOP-F35** | Lego coworker composition | BUILD | one plugin | pytest |

## Batch 1b — phase P2 — CONFIGURE rows

**Wave 1 — retention**

| Row | Name | Deliverable | AC |
|---|---|---|---|
| MEM-F44 | Memory retention | keys | pytest |
| GOV-F24 | Governance gate | keys | pytest |
"""

LEDGER_HEAD = (
    "# Hermes PORT — work-item ledger\n\n"
    "| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |\n"
    "| --- | --- | --- | --- | --- | --- | --- |\n"
)
LEDGER_OPEN = LEDGER_HEAD + (
    "| LOOP-F35 | 2026-09-09 12:20 IST (to hermes-architect, thread `hermes-LOOP-F35`) | 2026-09-09 15:27 IST | #7 | PASS | — | batch 1a |\n"
    "| MEM-F44 | 2026-09-10 09:00 IST (to hermes-architect) | — | — | — | — | batch 1b |\n"
    "| GOV-F24 | — | — | — | — | — | not dispatched yet |\n"
)
LEDGER_MERGED = LEDGER_HEAD + (
    "| LOOP-F35 | 2026-09-09 12:20 IST (to hermes-architect) | 2026-09-09 15:27 IST | #7 | PASS · APPROVE | "
    "MERGED `0f12e89` (squash) into `release/v2026.8.31-e2e-fixed` — 2026-09-10 06:35Z — 4/4 AC | batch 1a |\n"
    "| MEM-F44 | 2026-09-10 09:00 IST (to hermes-architect) | — | — | test round 2/2 = FAIL | blocked: STOP — cap: FAIL x2, no round 3 | batch 1b |\n"
)
# The merge-gate's red-gate shape: hermes_queue.parse_outcome_cell → outcome 'gate_red', reason 'P3 — …'.
LEDGER_GATE_RED = LEDGER_HEAD + (
    "| LOOP-F35 | 2026-09-09 12:20 IST (to hermes-architect) | 2026-09-09 15:27 IST | #7 | PASS · APPROVE | "
    "blocked: P3 — creds expired, <!here> retry after rotation | batch 1a |\n"
    "| MEM-F44 | 2026-09-10 09:00 IST (to hermes-architect) | — | — | — | — | batch 1b |\n"
)


def load_module():
    spec = importlib.util.spec_from_file_location("slack_rows", HERE / "slack-rows.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FakeClient:
    """Records every call; `fail` maps a (kind, key) to an exception to raise on that call.
    `attempts` counts calls including the failed ones."""

    instances: ClassVar[list] = []

    def __init__(self, token: str):
        self.token = token
        self.calls: list = []
        self.fail: dict = {}
        self.attempts = 0
        self.ts = 1000
        FakeClient.instances.append(self)

    def post_message(self, channel, text, thread_ts=None):
        self.attempts += 1
        # roots read `hermes-<ROW> · …`; closing lines `✅ <ROW> …` — key failures by the bare row id
        exc = self.fail.get(("post", text.split(" · ")[0].split(" ")[0].removeprefix("hermes-")))
        if exc:
            raise exc
        self.ts += 1
        self.calls.append(("post", channel, text, thread_ts))
        return f"{self.ts}.000100"

    def update_message(self, channel, ts, text):
        self.attempts += 1
        exc = self.fail.get(("update", ts))
        if exc:
            raise exc
        self.calls.append(("update", channel, ts, text))
        return ts

    def upload_file(self, channel, thread_ts, path, title, initial_comment):
        self.attempts += 1
        exc = self.fail.get(("upload", os.path.basename(path)))
        if exc:
            raise exc
        self.calls.append(("upload", channel, thread_ts, os.path.basename(path), title, initial_comment))
        return f"F{len(self.calls):04d}"


class FakeResponse:
    def __init__(self, body: bytes):
        self.body = body

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeSlackHTTP:
    """A urlopen stand-in that answers the Web API by URL, so the REAL SlackClient can drive a run:
    chat.postMessage → ok + ts, files.getUploadURLExternal → ok + upload_url + file_id, the pre-signed
    upload URL → OK, files.completeUploadExternal → ok. `fail_once` is a list of (predicate(req), exc):
    the first request a predicate matches raises exc and the pair is consumed."""

    def __init__(self):
        self.requests: list = []
        self.fail_once: list = []
        self.ts = 2000

    def __call__(self, req, timeout=None):
        self.requests.append(req)
        for i, (pred, exc) in enumerate(self.fail_once):
            if pred(req):
                del self.fail_once[i]
                raise exc
        url = req.full_url
        if url.endswith("chat.postMessage"):
            self.ts += 1
            body: dict = {"ok": True, "ts": f"{self.ts}.000100"}
        elif url.endswith("files.getUploadURLExternal"):
            n = len(self.requests)
            body = {"ok": True, "upload_url": f"https://files.slack.com/upload/v1/u{n}", "file_id": f"F{n:04d}"}
        elif "files.slack.com/upload/" in url:
            return FakeResponse(b"OK - uploaded")
        elif url.endswith("files.completeUploadExternal"):
            body = {"ok": True, "files": [{"id": "x"}]}
        elif url.endswith("chat.update"):
            body = {"ok": True, "ts": json.loads(req.data.decode()).get("ts")}
        else:
            body = {"ok": False, "error": "unknown_method"}
        return FakeResponse(json.dumps(body).encode())

    def bodies(self, suffix: str) -> list:
        """Decoded JSON bodies of every request to the Web API method `suffix`."""
        return [json.loads(r.data.decode()) for r in self.requests if r.full_url.endswith(suffix)]

    def uploaded(self) -> list:
        """The raw bytes POSTed to the pre-signed upload URLs, in order."""
        return [r.data for r in self.requests if "files.slack.com/upload/" in r.full_url]


def put(path: Path, data, mtime: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, bytes):
        path.write_bytes(data)
    else:
        path.write_text(data, encoding="utf-8")
    os.utime(path, (mtime, mtime))


def make_unreadable(path: Path) -> None:
    """chmod 000; when that does not bite (root), swap the file for a directory of the same name
    (IsADirectoryError on open) — either way open(path, 'rb') raises an OSError."""
    path.chmod(0)
    if os.access(path, os.R_OK):
        path.unlink()
        path.mkdir()


class SlackRowsTest(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()
        FakeClient.instances = []
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "checkout"
        self.state = self.root / "data" / "shared" / "hermes" / "slack-threads.json"
        put(self.root / "docs" / "hermes-port" / "dispatch-plan.md", PLAN, 1.0e9)
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_OPEN, 1.0e9)
        # The token lives in <root>/.env only (host-side), never in this process's environment.
        put(self.root / ".env", f"# nemoclaw\nexport OTHER=1\nSLACK_BOT_TOKEN='{TOKEN}'\n", 1.0e9)
        base = 1.7e9
        tester = self.root / "groups" / "hermes-tester" / "reports" / "hermes-LOOP-F35" / "cards"
        builder = self.root / "groups" / "hermes-builder" / "reports" / "hermes-LOOP-F35" / "cards"
        arch = self.root / "groups" / "hermes-architect" / "reports" / "hermes-LOOP-F35" / "cards"
        self.builder_png = builder / "card-hermes-builder-shipped-r1.png"
        # Three cards on LOOP-F35 written out of role order: architect (oldest), builder, tester (newest).
        put(arch / "card-hermes-architect-handoff-r1.png", png("arch"), base + 10)
        put(arch / "card-hermes-architect-handoff-r1.json",
            json.dumps({"row": "LOOP-F35", "role": "hermes-architect", "outcome": "HANDOFF", "round": 1,
                        "headline": "ADR + 4 AC (pytest 3 / live 1)", "meta": {"cost": "n/a"}}), base + 10)
        put(self.builder_png, png("build"), base + 20)
        put(builder / "card-hermes-builder-shipped-r1.json",
            json.dumps({"row": "LOOP-F35", "role": "hermes-builder", "outcome": "SHIPPED", "round": 1,
                        "headline": "hermes-agent#7 draft, head e117c1c", "meta": {}}), base + 20)
        put(tester / "card-hermes-tester-pass-r2.png", png("test"), base + 30)  # no .json: caption from the filename
        put(tester / "card-hermes-tester-latest.png", png("test"), base + 30)  # the latest copy is not a card
        put(tester / "card-hermes-tester-fail-r1.html", "<html>fallback</html>", base + 5)  # html-only: not uploaded
        self.env_backup = {k: os.environ.pop(k) for k in ("SLACK_BOT_TOKEN", "SLACK_ROWS_CHANNEL") if k in os.environ}

    def tearDown(self):
        os.environ.update(self.env_backup)
        if self.builder_png.exists() and not self.builder_png.is_dir():
            self.builder_png.chmod(stat.S_IRUSR | stat.S_IWUSR)
        self.tmp.cleanup()

    def run_main(self, *extra: str, factory=FakeClient) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = self.mod.main(["--root", str(self.root), "--channel", CHANNEL, *extra], client_factory=factory)
        return code, out.getvalue(), err.getvalue()

    def real_client(self, http_fake: FakeSlackHTTP):
        """A factory building the real SlackClient over the fake urlopen (no sleeping on 429)."""
        return lambda token: self.mod.SlackClient(token, opener=http_fake, sleep=lambda _s: None)

    def read_state(self) -> dict:
        return json.loads(self.state.read_text(encoding="utf-8"))

    # ------------------------------------------------------------------ the happy path

    def test_roots_once_cards_oldest_first_then_nothing_new(self):
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        client = FakeClient.instances[0]
        self.assertEqual(client.token, TOKEN, "the token must come from <root>/.env when the environment lacks it")
        posts = [c for c in client.calls if c[0] == "post"]
        uploads = [c for c in client.calls if c[0] == "upload"]
        # Two dispatched rows → two roots, plan order; GOV-F24 (not dispatched, no cards) gets none.
        self.assertEqual([p[2] for p in posts], [
            "hermes-LOOP-F35 · Lego coworker composition · batch 1a · dispatched 2026-09-09",
            "hermes-MEM-F44 · Memory retention · batch 1b · dispatched 2026-09-10",
        ])
        self.assertTrue(all(p[3] is None for p in posts), "roots are not thread replies")
        # Cards oldest-first, all in LOOP-F35's thread, PNG only, the -latest copy skipped.
        self.assertEqual([u[3] for u in uploads], [
            "card-hermes-architect-handoff-r1.png", "card-hermes-builder-shipped-r1.png", "card-hermes-tester-pass-r2.png",
        ])
        root_ts = posts[0][3] or self.read_state()["rows"]["LOOP-F35"]["thread_ts"]
        self.assertTrue(all(u[2] == root_ts for u in uploads))
        self.assertEqual(uploads[0][5], "LOOP-F35 · hermes-architect · HANDOFF — ADR + 4 AC (pytest 3 / live 1)")
        self.assertEqual(uploads[2][5], "LOOP-F35 · hermes-tester · PASS")
        self.assertEqual(uploads[1][4], "LOOP-F35 · hermes-builder · SHIPPED · r1")
        st = self.read_state()
        self.assertEqual(st["channel"], CHANNEL)
        self.assertEqual(set(st["rows"]), {"LOOP-F35", "MEM-F44"})
        row = st["rows"]["LOOP-F35"]
        self.assertEqual(row["channel"], CHANNEL)
        self.assertEqual(row["thread_ts"], root_ts)
        self.assertIn("root_posted_at", row)
        self.assertEqual(set(row["cards"]), {
            "groups/hermes-architect/reports/hermes-LOOP-F35/cards/card-hermes-architect-handoff-r1.png",
            "groups/hermes-builder/reports/hermes-LOOP-F35/cards/card-hermes-builder-shipped-r1.png",
            "groups/hermes-tester/reports/hermes-LOOP-F35/cards/card-hermes-tester-pass-r2.png",
        })
        self.assertTrue(all(v["file_id"].startswith("F") for v in row["cards"].values()))
        self.assertNotIn("merged_posted", row)
        self.assertIn("posted root LOOP-F35", out)
        self.assertIn("posted card groups/hermes-tester/", out)

        # Second run: same inputs, nothing new.
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances[1].calls, [])
        self.assertEqual(self.read_state()["rows"]["LOOP-F35"]["thread_ts"], root_ts)

        # A new card appears → exactly one upload, into the existing thread; no second root.
        put(self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-LOOP-F35" / "cards" / "card-hermes-reviewer-approve-r1.png",
            png("rev"), 1.7e9 + 40)
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[2].calls
        self.assertEqual([c[0] for c in calls], ["upload"])
        self.assertEqual(calls[0][2], root_ts)
        self.assertEqual(calls[0][5], "LOOP-F35 · hermes-reviewer · APPROVE")
        self.assertEqual(len(self.read_state()["rows"]["LOOP-F35"]["cards"]), 4)

    def test_card_under_a_miscased_thread_dir_is_mirrored_into_the_rows_thread(self):
        """ISO-F13, 2026-09-16: a reviewer addressed with `hermes-loop-f35` writes its card under that dir. The mirror
        files it under LOOP-F35 (the canonical row) — same Slack thread, `LOOP-F35 · hermes-reviewer · REQUEST_CHANGES`
        caption — while the state key keeps the card's real path, so nothing is re-posted on the next run."""
        put(self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-loop-f35" / "cards" / "card-hermes-reviewer-request_changes-r1.png",
            png("rc"), 1.7e9 + 40)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        client = FakeClient.instances[0]
        posts = [c for c in client.calls if c[0] == "post"]
        uploads = [c for c in client.calls if c[0] == "upload"]
        self.assertEqual([p[2].split(" · ")[0] for p in posts], ["hermes-LOOP-F35", "hermes-MEM-F44"])  # no `hermes-loop-f35` root
        self.assertEqual([u[3] for u in uploads][-1], "card-hermes-reviewer-request_changes-r1.png")
        root_ts = self.read_state()["rows"]["LOOP-F35"]["thread_ts"]
        self.assertTrue(all(u[2] == root_ts for u in uploads))
        self.assertEqual(uploads[-1][5], "LOOP-F35 · hermes-reviewer · REQUEST_CHANGES")
        st = self.read_state()
        self.assertEqual(set(st["rows"]), {"LOOP-F35", "MEM-F44"})
        self.assertIn("groups/hermes-reviewer/reports/hermes-loop-f35/cards/card-hermes-reviewer-request_changes-r1.png", st["rows"]["LOOP-F35"]["cards"])
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances[1].calls, [])
        cards = self.mod.collect_cards(str(self.root))
        self.assertEqual(sorted(cards), ["LOOP-F35"])
        rc = next(c for c in cards["LOOP-F35"] if c["file"] == "card-hermes-reviewer-request_changes-r1.png")
        self.assertTrue(rc["dir"].endswith("/reports/hermes-loop-f35/cards"))
        self.assertEqual(rc["thread"], "hermes-loop-f35")

    def test_merged_and_blocked_lines_posted_once(self):
        self.run_main()  # roots + cards
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_MERGED, 1.0e9)
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        st = self.read_state()
        calls = FakeClient.instances[1].calls
        self.assertEqual(len(calls), 2)
        merged = next(c for c in calls if c[2].startswith("✅"))
        blocked = next(c for c in calls if c[2].startswith("⛔"))
        self.assertEqual(merged[3], st["rows"]["LOOP-F35"]["thread_ts"], "the merge line is a thread reply")
        self.assertTrue(merged[2].startswith("✅ LOOP-F35 merged 0f12e89 — MERGED `0f12e89` (squash) into"), merged[2])
        self.assertIn("4/4 AC", merged[2])
        self.assertEqual(blocked[3], st["rows"]["MEM-F44"]["thread_ts"])
        self.assertEqual(blocked[2], "⛔ MEM-F44 blocked — STOP — cap: FAIL x2, no round 3")
        self.assertIn("merged_posted", st["rows"]["LOOP-F35"])
        self.assertIn("blocked_posted", st["rows"]["MEM-F44"])
        self.assertIn("posted merged line LOOP-F35", out)
        # Third run: the lines are not repeated.
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances[2].calls, [])

    def test_gate_red_posts_the_blocked_line_once_and_a_later_merge_still_posts(self):
        self.run_main()  # roots + cards
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_GATE_RED, 1.0e9)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[1].calls
        self.assertEqual(len(calls), 1, calls)
        self.assertEqual(calls[0][2], "⛔ LOOP-F35 blocked — P3 — creds expired, <!here> retry after rotation")
        self.assertEqual(calls[0][3], self.read_state()["rows"]["LOOP-F35"]["thread_ts"])
        self.assertIn("blocked_posted", self.read_state()["rows"]["LOOP-F35"])
        # Same red gate again: nothing. Then the row merges: the ✅ line still posts.
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances[2].calls, [])
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_MERGED, 1.0e9)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        texts = [c[2] for c in FakeClient.instances[3].calls]
        self.assertEqual(len(texts), 2, texts)
        self.assertTrue(texts[0].startswith("✅ LOOP-F35 merged 0f12e89"), texts)
        self.assertTrue(texts[1].startswith("⛔ MEM-F44 blocked — STOP"), texts)

    def test_merge_line_waits_for_the_rows_pending_cards(self):
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_MERGED, 1.0e9)
        code, _out, err = self.run_main("--max-posts", "3")  # 2 roots + 1 card: LOOP-F35 still has cards pending
        self.assertEqual(code, 0, err)
        kinds = [c[0] for c in FakeClient.instances[0].calls]
        self.assertEqual(kinds, ["post", "post", "upload"])
        self.assertNotIn("merged_posted", self.read_state()["rows"]["LOOP-F35"])
        # MEM-F44 has no cards, so its blocked line could go — but the budget was spent; next run catches up.
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[1].calls
        self.assertEqual([c[0] for c in calls], ["upload", "upload", "post", "post"])
        self.assertTrue(calls[2][2].startswith("✅ LOOP-F35 merged 0f12e89"))
        self.assertTrue(calls[3][2].startswith("⛔ MEM-F44 blocked"))

    def test_fresh_card_waits_to_settle_and_holds_the_closing_line(self):
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_MERGED, 1.0e9)
        fresh = self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-LOOP-F35" / "cards" / "card-hermes-reviewer-approve-r1.png"
        put(fresh, png("rev"), time.time())  # just written: may still be mid-write
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[0].calls
        uploads = [c[3] for c in calls if c[0] == "upload"]
        self.assertEqual(len(uploads), 3)
        self.assertNotIn("card-hermes-reviewer-approve-r1.png", uploads)
        self.assertIn("1 card(s) younger than", err)
        self.assertIn("1 left for the next run", err)
        texts = [c[2] for c in calls if c[0] == "post"]
        self.assertFalse(any(t.startswith("✅") for t in texts), "the merge line waits for the settling card")
        self.assertTrue(any(t.startswith("⛔ MEM-F44") for t in texts))
        # Settled: uploaded, then the merge line.
        os.utime(fresh, (1.7e9 + 50, 1.7e9 + 50))
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[1].calls
        self.assertEqual([c[0] for c in calls], ["upload", "post"])
        self.assertEqual(calls[0][3], "card-hermes-reviewer-approve-r1.png")
        self.assertTrue(calls[1][2].startswith("✅ LOOP-F35 merged"))

    # ------------------------------------------------------------------ limits and failures

    def test_max_posts_caps_a_run_and_the_next_run_continues(self):
        code, _out, err = self.run_main("--max-posts", "1")
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[0].calls], ["post"])
        self.assertEqual(set(self.read_state()["rows"]), {"LOOP-F35"})
        self.assertIn("left for the next run", err)
        _code, _out, _err = self.run_main("--max-posts", "2")
        self.assertEqual([c[0] for c in FakeClient.instances[1].calls], ["post", "upload"])
        self.assertEqual(FakeClient.instances[1].calls[1][3], "card-hermes-architect-handoff-r1.png", "oldest card first")
        _code, _out, _err = self.run_main()
        self.assertEqual([c[0] for c in FakeClient.instances[2].calls], ["upload", "upload"])
        self.assertEqual(len(self.read_state()["rows"]["LOOP-F35"]["cards"]), 3)

    def test_not_in_channel_exits_2_and_leaves_state_untouched(self):
        mod = self.mod

        class Kicked(FakeClient):
            def __init__(self, token):
                super().__init__(token)
                self.fail[("post", "LOOP-F35")] = mod.NotInChannel("chat.postMessage", "not_in_channel")

        code, out, err = self.run_main(factory=Kicked)
        self.assertEqual(code, 2)
        self.assertFalse(self.state.exists(), "no state file may be written when the bot is not in the channel")
        self.assertEqual(Kicked.instances[0].calls, [])
        self.assertIn("slack error chat.postMessage: not_in_channel", err)
        self.assertIn("/invite", err)
        self.assertEqual(out, "")

    def test_fatal_slack_error_exits_1_after_exactly_one_call(self):
        mod = self.mod

        class Revoked(FakeClient):
            def __init__(self, token):
                super().__init__(token)
                self.fail[("post", "LOOP-F35")] = mod.SlackFatal("chat.postMessage", "invalid_auth")

        code, out, err = self.run_main(factory=Revoked)
        self.assertEqual(code, 1)
        self.assertEqual(Revoked.instances[0].attempts, 1, "no budget is burnt after a token/channel error")
        self.assertEqual(Revoked.instances[0].calls, [])
        self.assertIn("slack error chat.postMessage: invalid_auth", err)
        self.assertIn("token/channel problem", err)
        self.assertFalse(self.state.exists())
        self.assertEqual(out, "")
        # Mid-run: what was posted before the fatal call stays recorded.
        class RevokedLater(FakeClient):
            def __init__(self, token):
                super().__init__(token)
                self.fail[("upload", "card-hermes-builder-shipped-r1.png")] = mod.SlackFatal("files.completeUploadExternal", "token_revoked")

        code, _out, err = self.run_main(factory=RevokedLater)
        self.assertEqual(code, 1)
        self.assertEqual([c[0] for c in RevokedLater.instances[1].calls], ["post", "post", "upload"])
        self.assertEqual(len(self.read_state()["rows"]["LOOP-F35"]["cards"]), 1)

    def test_one_failed_card_does_not_abort_the_run(self):
        mod = self.mod

        class Flaky(FakeClient):
            def __init__(self, token):
                super().__init__(token)
                self.fail[("upload", "card-hermes-builder-shipped-r1.png")] = mod.SlackError("files.completeUploadExternal", "invalid_arguments")

        code, _out, err = self.run_main(factory=Flaky)
        self.assertEqual(code, 0)
        uploads = [c[3] for c in Flaky.instances[0].calls if c[0] == "upload"]
        self.assertEqual(uploads, ["card-hermes-architect-handoff-r1.png", "card-hermes-tester-pass-r2.png"])
        self.assertIn("slack error files.completeUploadExternal: invalid_arguments", err)
        cards = self.read_state()["rows"]["LOOP-F35"]["cards"]
        self.assertEqual(len(cards), 2)
        self.assertFalse(any("builder" in k for k in cards), "a failed card is not recorded, so the next run retries it")
        # Next run picks up only the failed one.
        _code, _out, _err = self.run_main()
        self.assertEqual([c[3] for c in FakeClient.instances[1].calls], ["card-hermes-builder-shipped-r1.png"])

    def test_unreadable_card_is_skipped_not_fatal(self):
        """The real client + fake urlopen: a PNG the host cannot read (chmod 000 — cards are written by
        containers) is one `slack error read: …` line; the other cards post, the run exits 0."""
        make_unreadable(self.builder_png)
        http_fake = FakeSlackHTTP()
        code, out, err = self.run_main(factory=self.real_client(http_fake))
        self.assertEqual(code, 0, err)
        self.assertIn("slack error read: ", err)
        self.assertTrue("PermissionError" in err or "IsADirectoryError" in err, err)
        self.assertIn("(groups/hermes-builder/reports/hermes-LOOP-F35/cards/card-hermes-builder-shipped-r1.png)", err)
        self.assertEqual(http_fake.uploaded(), [png("arch"), png("test")])
        cards = self.read_state()["rows"]["LOOP-F35"]["cards"]
        self.assertEqual(len(cards), 2)
        self.assertFalse(any("builder" in k for k in cards))
        self.assertIn("posted card groups/hermes-tester/", out)
        self.assertNotIn(str(self.root), err, "no absolute path leaks into the log")

    def test_truncated_response_on_one_card_does_not_abort(self):
        """http.client.IncompleteRead is not an OSError: it must still be one failed card, not a dead run."""
        http_fake = FakeSlackHTTP()
        http_fake.fail_once.append((lambda req: req.data == png("build"), http.client.IncompleteRead(b"")))
        code, _out, err = self.run_main(factory=self.real_client(http_fake))
        self.assertEqual(code, 0, err)
        self.assertIn("slack error upload: network: IncompleteRead (groups/hermes-builder/", err)
        self.assertEqual(http_fake.uploaded(), [png("arch"), png("build"), png("test")], "the builder bytes were sent once (and lost)")
        self.assertEqual(len(http_fake.bodies("files.completeUploadExternal")), 2)
        cards = self.read_state()["rows"]["LOOP-F35"]["cards"]
        self.assertEqual(len(cards), 2)
        self.assertFalse(any("builder" in k for k in cards))
        # Next run: only the lost card, through the real three-step flow.
        http_fake = FakeSlackHTTP()
        code, _out, err = self.run_main(factory=self.real_client(http_fake))
        self.assertEqual(code, 0, err)
        self.assertEqual(http_fake.uploaded(), [png("build")])
        self.assertEqual(len(self.read_state()["rows"]["LOOP-F35"]["cards"]), 3)

    def test_torn_png_is_retried_not_frozen_in(self):
        """A PNG without its IEND tail (card.sh screenshots in place) is skipped this run and uploaded
        once the file is whole — never recorded as posted while truncated."""
        self.builder_png.write_bytes(PNG_HEAD + b"only half the ima")
        os.utime(self.builder_png, (1.7e9 + 20, 1.7e9 + 20))
        http_fake = FakeSlackHTTP()
        code, _out, err = self.run_main(factory=self.real_client(http_fake))
        self.assertEqual(code, 0, err)
        self.assertIn("slack error read: incomplete png (groups/hermes-builder/", err)
        self.assertEqual(http_fake.uploaded(), [png("arch"), png("test")])
        self.assertFalse(any("builder" in k for k in self.read_state()["rows"]["LOOP-F35"]["cards"]))
        self.builder_png.write_bytes(png("build"))
        os.utime(self.builder_png, (1.7e9 + 20, 1.7e9 + 20))
        http_fake = FakeSlackHTTP()
        code, _out, err = self.run_main(factory=self.real_client(http_fake))
        self.assertEqual(code, 0, err)
        self.assertEqual(http_fake.uploaded(), [png("build")])
        self.assertEqual(len(self.read_state()["rows"]["LOOP-F35"]["cards"]), 3)

    def test_mrkdwn_control_characters_are_escaped_end_to_end(self):
        """Agent-written headlines and ledger cells reach Slack escaped: no @channel ping, no smuggled link."""
        put(self.root / "groups" / "hermes-builder" / "reports" / "hermes-LOOP-F35" / "cards" / "card-hermes-builder-shipped-r1.json",
            json.dumps({"row": "LOOP-F35", "role": "hermes-builder", "outcome": "SHIPPED", "round": 1,
                        "headline": "<!channel> all green & <https://evil.example|click>"}), 1.7e9 + 20)
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_GATE_RED, 1.0e9)
        http_fake = FakeSlackHTTP()
        code, _out, err = self.run_main(factory=self.real_client(http_fake))
        self.assertEqual(code, 0, err)
        completes = http_fake.bodies("files.completeUploadExternal")
        builder = next(c for c in completes if "hermes-builder" in c["initial_comment"])
        self.assertEqual(builder["initial_comment"],
                         "LOOP-F35 · hermes-builder · SHIPPED — &lt;!channel&gt; all green &amp; &lt;https://evil.example|click&gt;")
        self.assertEqual(builder["files"][0]["title"], "LOOP-F35 · hermes-builder · SHIPPED · r1")
        posts = [b["text"] for b in http_fake.bodies("chat.postMessage")]
        self.assertIn("⛔ LOOP-F35 blocked — P3 — creds expired, &lt;!here&gt; retry after rotation", posts)
        all_sent = b"".join(r.data for r in http_fake.requests if r.full_url.startswith("https://slack.com/api/"))
        self.assertNotIn(b"<!channel>", all_sent)
        self.assertNotIn(b"<!here>", all_sent)

    def test_another_run_holding_the_lock_exits_0_without_calls(self):
        lock_path = Path(str(self.state) + ".lock")
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with open(lock_path, "w") as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, out, err = self.run_main()
            self.assertEqual(code, 0)
            self.assertEqual(FakeClient.instances[0].calls, [], "the second run must not post")
            self.assertIn("another run holds the lock", err)
            self.assertEqual(out, "")
            self.assertFalse(self.state.exists())
        # Lock released: the next run proceeds normally, and the lock is free again afterwards.
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(len(FakeClient.instances[1].calls), 5)
        with open(lock_path, "w") as probe:
            fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)  # would raise if main() leaked its handle
        # A dry run never takes the lock.
        with open(lock_path, "w") as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, out, _err = self.run_main("--dry-run")
            self.assertEqual(code, 0)
            self.assertEqual(out.count("would post"), 0, "everything is already posted")

    def test_corrupt_state_rows_is_fatal_and_posts_nothing(self):
        put(self.state, json.dumps({"channel": CHANNEL, "rows": ["LOOP-F35"]}), 1.0e9)
        code, out, err = self.run_main()
        self.assertEqual(code, 1)
        self.assertEqual(FakeClient.instances[0].calls, [])
        self.assertIn("'rows' is not an object", err)
        self.assertEqual(out, "")
        self.assertEqual(json.loads(self.state.read_text())["rows"], ["LOOP-F35"], "the file is left for the operator")

    def test_dry_run_makes_no_calls_and_writes_no_state(self):
        code, out, err = self.run_main("--dry-run")
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances, [], "dry-run never builds a client")
        self.assertFalse(self.state.exists())
        self.assertFalse(Path(str(self.state) + ".lock").exists(), "dry-run touches nothing under data/")
        self.assertIn("would post root LOOP-F35: hermes-LOOP-F35 · Lego coworker composition · batch 1a · dispatched 2026-09-09", out)
        self.assertIn("would post card groups/hermes-architect/reports/hermes-LOOP-F35/cards/card-hermes-architect-handoff-r1.png", out)
        self.assertEqual(out.count("would post"), 5)  # 2 roots + 3 cards

    def test_missing_token_or_channel_is_fatal(self):
        (self.root / ".env").unlink()
        code, _out, err = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("no token", err)
        self.assertEqual(FakeClient.instances, [])
        out_io, err_io = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out_io), contextlib.redirect_stderr(err_io):
            code = self.mod.main(["--root", str(self.root)], client_factory=FakeClient)
        self.assertEqual(code, 1)
        self.assertIn("no channel", err_io.getvalue())

    def test_token_never_appears_in_output(self):
        outputs = []
        for extra in ((), ("--dry-run",)):
            _code, out, err = self.run_main(*extra)
            outputs.append(out + err)
        mod = self.mod

        class Kicked(FakeClient):
            def __init__(self, token):
                super().__init__(token)
                self.fail[("post", "MEM-F44")] = mod.NotInChannel("chat.postMessage", "not_in_channel")

        _code, out, err = self.run_main(factory=Kicked)
        outputs.append(out + err)
        (self.root / ".env").unlink()
        _code, out, err = self.run_main()
        outputs.append(out + err)
        for text in outputs:
            self.assertNotIn(TOKEN, text)
            self.assertNotIn("SECRET", text)
        self.assertTrue(any(o for o in outputs), "the runs did print something")
        self.assertNotIn(TOKEN, self.state.read_text(encoding="utf-8"))

    def test_env_token_wins_over_dotenv(self):
        os.environ["SLACK_BOT_TOKEN"] = "xoxb-from-env"
        try:
            self.run_main("--max-posts", "0")
        finally:
            del os.environ["SLACK_BOT_TOKEN"]
        self.assertEqual(FakeClient.instances[0].token, "xoxb-from-env")
        self.assertEqual(self.mod.read_token(str(self.root), "SLACK_BOT_TOKEN"), TOKEN)
        self.assertIsNone(self.mod.read_token(str(self.root), "NOPE"))


class SlackClientTest(unittest.TestCase):
    """The urllib client against a fake urlopen: the upload flow, form vs JSON bodies, escaping, 429,
    ok:false, fatal errors, non-OSError transport failures, a malformed upload url."""

    def setUp(self):
        self.mod = load_module()
        self.requests: list = []
        self.sleeps: list = []
        self.script: list = []

    def opener(self, req, timeout=None):
        self.requests.append(req)
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return FakeResponse(item)

    def client(self):
        return self.mod.SlackClient(TOKEN, opener=self.opener, sleep=self.sleeps.append)

    def test_upload_flow(self):
        with tempfile.TemporaryDirectory() as d:
            card = Path(d) / "card-hermes-tester-pass-r2.png"
            card.write_bytes(png("bytes"))
            self.script = [
                json.dumps({"ok": True, "upload_url": "https://files.slack.com/upload/v1/abc", "file_id": "F123"}).encode(),
                b"OK - 10 bytes uploaded",
                json.dumps({"ok": True, "files": [{"id": "F123"}]}).encode(),
            ]
            fid = self.client().upload_file(CHANNEL, "1700.0001", str(card), "title <r2>",
                                            "LOOP-F35 · hermes-tester · PASS — <!channel> a & b")
        self.assertEqual(fid, "F123")
        urls = [r.full_url for r in self.requests]
        self.assertEqual(urls, [
            "https://slack.com/api/files.getUploadURLExternal",
            "https://files.slack.com/upload/v1/abc",
            "https://slack.com/api/files.completeUploadExternal",
        ])
        step1 = dict(urllib.parse.parse_qsl(self.requests[0].data.decode()))
        self.assertEqual(step1, {"filename": "card-hermes-tester-pass-r2.png", "length": str(len(png("bytes")))})
        self.assertEqual(self.requests[0].get_header("Authorization"), f"Bearer {TOKEN}")
        self.assertEqual(self.requests[1].data, png("bytes"))
        self.assertFalse(self.requests[1].has_header("Authorization"), "the pre-signed upload URL gets no token")
        step3 = json.loads(self.requests[2].data.decode())
        self.assertEqual(step3, {"files": [{"id": "F123", "title": "title <r2>"}], "channel_id": CHANNEL, "thread_ts": "1700.0001",
                                 "initial_comment": "LOOP-F35 · hermes-tester · PASS — &lt;!channel&gt; a &amp; b"})
        self.assertTrue(self.requests[2].get_header("Content-type").startswith("application/json"))

    def test_unreadable_or_torn_file_is_a_read_error_before_any_call(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(self.mod.SlackError) as ctx:
                self.client().upload_file(CHANNEL, "1700.0001", os.path.join(d, "missing.png"), "t", "c")
            self.assertEqual((ctx.exception.method, ctx.exception.error), ("read", "FileNotFoundError"))
            self.assertNotIn(d, str(ctx.exception), "no path in the error")
            torn = Path(d) / "card-x-pass-r1.png"
            torn.write_bytes(PNG_HEAD + b"half")
            with self.assertRaises(self.mod.SlackError) as ctx:
                self.client().upload_file(CHANNEL, "1700.0001", str(torn), "t", "c")
            self.assertEqual(ctx.exception.error, "incomplete png")
            (Path(d) / "card-x-pass-r1.png").write_bytes(b"not a png at all")
            with self.assertRaises(self.mod.SlackError) as ctx:
                self.client().upload_file(CHANNEL, "1700.0001", str(torn), "t", "c")
            self.assertEqual(ctx.exception.error, "incomplete png")
        self.assertEqual(self.requests, [], "nothing goes to Slack for a file that cannot be read")

    def test_post_message_and_429_retry(self):
        err = urllib.error.HTTPError("https://slack.com/api/chat.postMessage", 429, "Too Many Requests",
                                     {"Retry-After": "3"}, io.BytesIO(b'{"ok":false,"error":"ratelimited"}'))
        self.script = [err, json.dumps({"ok": True, "ts": "1700.42"}).encode()]
        ts = self.client().post_message(CHANNEL, "hello", thread_ts="1700.0001")
        self.assertEqual(ts, "1700.42")
        self.assertEqual(self.sleeps, [3.0])
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(json.loads(self.requests[1].data.decode()), {
            "channel": CHANNEL, "text": "hello", "unfurl_links": False, "unfurl_media": False, "thread_ts": "1700.0001"})

    def test_update_message_hits_chat_update_and_escapes(self):
        self.script = [json.dumps({"ok": True, "ts": "1700000000.000100"}).encode()]
        ts = self.client().update_message("C1", "1700000000.000100", "*Demo path* <!channel> a & b")
        self.assertEqual(ts, "1700000000.000100")
        self.assertEqual(len(self.requests), 1)
        req = self.requests[0]
        self.assertTrue(req.full_url.endswith("/chat.update"))
        self.assertEqual(req.get_header("Content-type"), "application/json; charset=utf-8")
        self.assertEqual(json.loads(req.data.decode()), {"channel": "C1", "ts": "1700000000.000100", "text": "*Demo path* &lt;!channel&gt; a &amp; b"})
        self.script = [urllib.error.HTTPError("u", 500, "boom", {}, None)]
        with self.assertRaises(self.mod.SlackError) as cm:
            self.client().update_message("C1", "1.2", "x")
        self.assertEqual((cm.exception.method, cm.exception.error), ("chat.update", "http 500"))
        self.script = [json.dumps({"ok": False, "error": "message_not_found"}).encode()]
        with self.assertRaises(self.mod.SlackError) as cm:
            self.client().update_message("C1", "1.2", "x")
        self.assertEqual(cm.exception.error, "message_not_found")
        self.assertNotIsInstance(cm.exception, self.mod.SlackFatal)

    def test_post_message_escapes_mrkdwn(self):
        self.script = [json.dumps({"ok": True, "ts": "1700.43"}).encode()]
        self.client().post_message(CHANNEL, "⛔ LOOP-F35 blocked — <!channel> a & b <https://x|y>")
        sent = json.loads(self.requests[0].data.decode())["text"]
        self.assertEqual(sent, "⛔ LOOP-F35 blocked — &lt;!channel&gt; a &amp; b &lt;https://x|y&gt;")
        self.assertEqual(self.mod.mrkdwn_escape("plain · text"), "plain · text")

    def test_ok_false_not_in_channel_and_fatal_errors(self):
        mod = self.mod
        self.script = [json.dumps({"ok": False, "error": "not_in_channel"}).encode()]
        with self.assertRaises(mod.NotInChannel) as ctx:
            self.client().post_message(CHANNEL, "x")
        self.assertEqual(str(ctx.exception), "slack error chat.postMessage: not_in_channel")
        self.assertIsInstance(ctx.exception, mod.SlackFatal, "not_in_channel is run-wide too")
        for err in ("invalid_auth", "token_revoked", "missing_scope", "channel_not_found", "is_archived"):
            self.script = [json.dumps({"ok": False, "error": err}).encode()]
            with self.assertRaises(mod.SlackFatal) as ctx:
                self.client().call("auth.test", {})
            self.assertEqual(ctx.exception.error, err)
            self.assertNotIsInstance(ctx.exception, mod.NotInChannel)
            self.assertNotIn(TOKEN, str(ctx.exception))
        # A per-call error is a plain SlackError, not fatal.
        self.script = [json.dumps({"ok": False, "error": "invalid_arguments"}).encode()]
        with self.assertRaises(mod.SlackError) as ctx:
            self.client().call("files.completeUploadExternal", {})
        self.assertNotIsInstance(ctx.exception, mod.SlackFatal)
        self.script = [urllib.error.HTTPError("u", 500, "boom", {}, None)]
        with self.assertRaises(mod.SlackError) as ctx:
            self.client().call("auth.test", {})
        self.assertEqual(ctx.exception.error, "http 500")
        self.assertEqual(self.sleeps, [], "only 429 sleeps")

    def test_incomplete_read_and_other_http_exceptions_are_slack_errors(self):
        for exc, name in ((http.client.IncompleteRead(b""), "IncompleteRead"),
                          (http.client.BadStatusLine("garbage"), "BadStatusLine"),
                          (http.client.RemoteDisconnected("gone"), "RemoteDisconnected")):
            self.script = [exc]
            with self.assertRaises(self.mod.SlackError) as ctx:
                self.client().call("chat.postMessage", {"text": "x"})
            self.assertEqual(ctx.exception.error, f"network: {name}")
            self.assertNotIsInstance(ctx.exception, self.mod.SlackFatal)

    def test_malformed_upload_url_is_a_slack_error_without_the_url(self):
        with tempfile.TemporaryDirectory() as d:
            card = Path(d) / "card-hermes-tester-pass-r2.png"
            card.write_bytes(png("bytes"))
            self.script = [json.dumps({"ok": True, "upload_url": "bogus-capability-url", "file_id": "F1"}).encode()]
            with self.assertRaises(self.mod.SlackError) as ctx:
                self.client().upload_file(CHANNEL, "1700.0001", str(card), "t", "c")
        self.assertEqual((ctx.exception.method, ctx.exception.error), ("upload", "bad url"))
        self.assertNotIn("bogus", str(ctx.exception))
        self.assertEqual(len(self.requests), 1, "Request() failed before anything was sent")


if __name__ == "__main__":
    unittest.main()


DEMO_GEN = "2026-09-15T10:00:00Z"


def demo_text(*rows: str, state_note: str | None = None) -> str:
    """A `slack_text` the way demo_path.render_slack shapes it (the content is opaque to slack-rows)."""
    lines = [f"*Demo path* · updated 2026-09-15 10:00Z · WIP 3 · state {state_note or '2026-09-15 09:50'}"]
    if state_note == "unknown":
        lines.append("_state.json not found (the first autopilot tick writes it)_")
    lines.append("🔨 *R1* Governed 5-bot fleet — *in progress* · ETA 2026-09-22 (≈7.2d left)")
    lines.append("    • " + " · ".join(rows or ("LOOP-F35 merged", "LOOP-F37 building")))
    lines.append("_model: planning hours × stage factor; details on the rows board_")
    return "\n".join(lines)


def demo_json(text: str, state_ok: bool = True, generated_at: str | None = DEMO_GEN, **extra) -> str:
    """rows-board's <www>/rows/demo-path.json: the compute() result (abridged) + slack_text."""
    data = {"rungs": [{"id": "R1", "status": "in_progress"}], "state_ok": state_ok, "slack_text": text, "wip_limit": 3}
    if generated_at is not None:
        data["generated_at"] = generated_at
    data.update(extra)
    return json.dumps(data)


class DemoPathMessageTest(unittest.TestCase):
    """The `*Demo path*` message: a checkout with the plan, an open ledger, one card and rows-board's demo-path.json
    under a www dir, driven through main() with FakeClient (or the real client over FakeSlackHTTP)."""

    def setUp(self):
        self.mod = load_module()
        FakeClient.instances = []
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "checkout"
        self.www = Path(self.tmp.name) / "www"
        self.state = self.root / "data" / "shared" / "hermes" / "slack-threads.json"
        self.demo = self.www / "rows" / "demo-path.json"
        put(self.root / "docs" / "hermes-port" / "dispatch-plan.md", PLAN, 1.0e9)
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER_OPEN, 1.0e9)
        put(self.root / ".env", f"SLACK_BOT_TOKEN={TOKEN}\n", 1.0e9)
        self.cards = self.root / "groups" / "hermes-tester" / "reports" / "hermes-LOOP-F35" / "cards"
        put(self.cards / "card-hermes-tester-pass-r1.png", png("t1"), 1.7e9)
        self.now = time.time()
        self.write_demo(demo_text())
        self.env_backup = {k: os.environ.pop(k) for k in ("SLACK_BOT_TOKEN", "SLACK_ROWS_CHANNEL", "NEMO_WWW_DIR") if k in os.environ}

    def tearDown(self):
        os.environ.update(self.env_backup)
        self.tmp.cleanup()

    def write_demo(self, text: str, state_ok: bool = True, age_s: float = 0.0, generated_at: str | None = "now", mtime: float | None = None) -> None:
        """demo-path.json generated `age_s` seconds ago (generated_at="now" derives it; None omits the field)."""
        gen = generated_at
        if gen == "now":
            gen = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self.now - age_s))
        put(self.demo, demo_json(text, state_ok=state_ok, generated_at=gen), self.now - age_s if mtime is None else mtime)

    def run_main(self, *extra: str, factory=FakeClient, demo_flag: bool = True) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        args = ["--root", str(self.root), "--channel", CHANNEL, *extra]
        if demo_flag:
            args += ["--demo-json", str(self.demo)]
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = self.mod.main(args, client_factory=factory)
        return code, out.getvalue(), err.getvalue()

    def read_state(self) -> dict:
        return json.loads(self.state.read_text(encoding="utf-8"))

    @staticmethod
    def demo_calls(client) -> list:
        return [c for c in client.calls if (c[0] == "post" and c[2].startswith("*Demo path*")) or c[0] == "update"]

    def test_first_run_posts_the_json_text_once_after_the_rows_then_nothing(self):
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        client = FakeClient.instances[0]
        kinds = [c[0] for c in client.calls]
        self.assertEqual(kinds, ["post", "post", "upload", "post"], "roots, the card, then the demo path last")
        demo = self.demo_calls(client)
        self.assertEqual(len(demo), 1)
        _kind, channel, text, thread_ts = demo[0]
        self.assertEqual(channel, CHANNEL)
        self.assertIsNone(thread_ts, "a root message, not a thread reply")
        self.assertEqual(text, demo_text(), "exactly the JSON's slack_text — nothing computed here")
        self.assertIn("posted demo path", out)
        entry = self.read_state()["demo_path"]
        self.assertEqual(entry["channel"], CHANNEL)
        self.assertEqual(entry["ts"], "1003.000100", "the third chat.postMessage of the run")
        self.assertEqual(entry["text_hash"], self.mod.text_hash(text))
        self.assertIn("posted_at", entry)
        self.assertIn("posted 4 on 2 rows", err)
        self.assertNotIn("demo path:", err, "no complaint about the JSON")
        # Second run, nothing changed: no call at all.
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances[1].calls, [])
        self.assertEqual(FakeClient.instances[1].attempts, 0)
        self.assertNotIn("demo path", out)
        self.assertEqual(self.read_state()["demo_path"], entry, "the state entry is untouched")

    def test_changed_json_text_is_one_chat_update_never_a_second_post(self):
        self.run_main()
        entry = self.read_state()["demo_path"]
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 review"))
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        client = FakeClient.instances[1]
        self.assertEqual([c[0] for c in client.calls], ["update"])
        _kind, channel, ts, text = client.calls[0]
        self.assertEqual((channel, ts), (CHANNEL, entry["ts"]))
        self.assertIn("LOOP-F37 review", text)
        self.assertIn("updated demo path", out)
        new = self.read_state()["demo_path"]
        self.assertEqual(new["ts"], entry["ts"], "the same message, edited in place")
        self.assertNotEqual(new["text_hash"], entry["text_hash"])
        self.assertEqual(new["text_hash"], self.mod.text_hash(text))
        self.assertEqual(new["posted_at"], entry["posted_at"])
        # Third run, unchanged again: nothing.
        self.run_main()
        self.assertEqual(FakeClient.instances[2].calls, [])

    def test_failed_update_is_logged_hash_kept_and_the_run_is_not_aborted(self):
        self.run_main()
        entry = self.read_state()["demo_path"]
        mod = self.mod
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 review"))
        put(self.cards / "card-hermes-tester-fail-r2.png", png("t2"), 1.7e9 + 20)  # new lane work on the same run

        class Flaky(FakeClient):
            def __init__(self, token):
                super().__init__(token)
                self.fail[("update", entry["ts"])] = mod.SlackError("chat.update", "message_not_found")

        code, _out, err = self.run_main(factory=Flaky)
        self.assertEqual(code, 0, "a failed update is never fatal")
        client = FakeClient.instances[-1]  # the Flaky one (instances is shared with the base class)
        self.assertEqual([c[0] for c in client.calls], ["upload"], "the card still posted; no repost of the demo path")
        self.assertEqual(client.attempts, 2)
        self.assertIn("slack error chat.update: message_not_found (demo path update; retried next run)", err)
        self.assertIn("posted 1 on 2 rows", err, "the run's summary line still prints")
        self.assertEqual(self.read_state()["demo_path"]["text_hash"], entry["text_hash"], "the hash is kept so the next run retries")
        # Next run: the update goes through.
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[-1].calls], ["update"])
        self.assertNotEqual(self.read_state()["demo_path"]["text_hash"], entry["text_hash"])
        # A fatal error on the update is still fatal (token / channel problem), like everywhere else.
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 gate"))
        ts = self.read_state()["demo_path"]["ts"]

        class Revoked(FakeClient):
            def __init__(self, token):
                super().__init__(token)
                self.fail[("update", ts)] = mod.SlackFatal("chat.update", "token_revoked")

        code, _out, err = self.run_main(factory=Revoked)
        self.assertEqual(code, 1)
        self.assertIn("token/channel problem", err)

    def test_update_does_not_count_against_max_posts_but_the_first_post_does(self):
        # Budget 3 on the first run: two roots + the card use it up, so the demo path waits.
        code, _out, err = self.run_main("--max-posts", "3")
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[0].calls], ["post", "post", "upload"])
        self.assertNotIn("demo_path", self.read_state())
        self.assertIn("demo path: no budget left this run; posted next run", err)
        # Next run: only the demo path is left; it takes one unit.
        code, _out, err = self.run_main("--max-posts", "1")
        self.assertEqual([c[0] for c in FakeClient.instances[1].calls], ["post"])
        self.assertIn("demo_path", self.read_state())
        # Now a changed tracker + two new cards on a budget of 1: one card (budget) AND the update (free).
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 review"))
        put(self.cards / "card-hermes-tester-fail-r2.png", png("t2"), 1.7e9 + 20)
        put(self.cards / "card-hermes-tester-pass-r3.png", png("t3"), 1.7e9 + 30)
        code, _out, err = self.run_main("--max-posts", "1")
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[2].calls], ["upload", "update"])
        self.assertIn("posted 1 on 2 rows", err, "the update is not in the budget count")

    def test_state_ok_false_means_no_first_post_but_an_existing_message_is_updated(self):
        self.write_demo(demo_text(state_note="unknown"), state_ok=False)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[0].calls], ["post", "post", "upload"])
        self.assertNotIn("demo_path", self.read_state())
        self.assertIn("demo path: no live state.json yet; the first message waits for it", err)
        # An earlier message exists (state.json vanished later): it is edited to the JSON's text.
        st = self.read_state()
        st["demo_path"] = {"channel": CHANNEL, "ts": "999.000001", "text_hash": "stale", "posted_at": "2026-09-14T00:00:00Z"}
        put(self.state, json.dumps(st), 1.7e9)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[1].calls
        self.assertEqual([c[0] for c in calls], ["update"])
        self.assertEqual(calls[0][2], "999.000001")
        self.assertIn("state.json not found", calls[0][3])

    def test_missing_json_is_one_log_line_and_the_message_is_left_untouched(self):
        self.demo.unlink()
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[0].calls], ["post", "post", "upload"], "the lanes are unaffected")
        self.assertNotIn("demo_path", self.read_state())
        self.assertEqual(err.count("demo path:"), 1)
        self.assertIn(f"demo path: {self.demo} missing (rows-board.py writes it); message left untouched", err)
        self.assertNotIn("demo path", out)
        # An existing message: no update either — the message is exactly as it was.
        self.write_demo(demo_text())
        self.run_main()
        entry = self.read_state()["demo_path"]
        self.demo.unlink()
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances[-1].calls, [])
        self.assertEqual(FakeClient.instances[-1].attempts, 0)
        self.assertEqual(self.read_state()["demo_path"], entry)
        self.assertIn("message left untouched", err)

    def test_stale_json_older_than_45_min_is_one_log_line_and_the_message_is_left_untouched(self):
        self.run_main()
        entry = self.read_state()["demo_path"]
        # 46 min old by generated_at, with a changed text: untouched.
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 review"), age_s=46 * 60)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances[-1].calls, [])
        self.assertEqual(err.count("demo path:"), 1)
        self.assertIn("is stale (46 min old, limit 45 min", err)
        self.assertIn("message left untouched", err)
        self.assertEqual(self.read_state()["demo_path"], entry)
        # 44 min old: fresh enough, the update goes through.
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 review"), age_s=44 * 60)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[-1].calls], ["update"])
        self.assertNotIn("demo path:", err)
        # No generated_at: the file's mtime decides — fresh mtime updates, an old mtime is stale.
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 gate"), generated_at=None, mtime=self.now - 60)
        self.run_main()
        self.assertEqual([c[0] for c in FakeClient.instances[-1].calls], ["update"])
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 merged"), generated_at=None, mtime=self.now - 50 * 60)
        code, _out, err = self.run_main()
        self.assertEqual(FakeClient.instances[-1].calls, [])
        self.assertIn("is stale (50 min old", err)
        # Stale on the very first run: no first post either.
        self.state.unlink()
        self.write_demo(demo_text(), age_s=3 * 3600)
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        self.assertEqual([c[0] for c in FakeClient.instances[-1].calls], ["post", "post", "upload"])
        self.assertNotIn("demo_path", self.read_state())
        self.assertIn("is stale (180 min old", err)

    def test_unreadable_or_shapeless_json_is_one_log_line_never_a_crash(self):
        self.run_main()
        entry = self.read_state()["demo_path"]
        for body, needle in (("{not json", "unreadable (JSONDecodeError"), ("[]", "has no slack_text"), (json.dumps({"slack_text": "  ", "generated_at": DEMO_GEN}), "has no slack_text")):
            put(self.demo, body, self.now)
            code, _out, err = self.run_main()
            self.assertEqual(code, 0, err)
            self.assertEqual(FakeClient.instances[-1].calls, [], body)
            self.assertIn(needle, err)
            self.assertIn("message left untouched", err)
            self.assertEqual(self.read_state()["demo_path"], entry)
        # load_demo_json directly: the contract in one place.
        text, ok, err = self.mod.load_demo_json(str(self.demo), now=self.now)
        self.assertEqual((text, ok), (None, False))
        self.assertIn("has no slack_text", err)
        self.write_demo(demo_text(), state_ok=False, generated_at=DEMO_GEN)
        t0 = self.mod.parse_iso_ts(DEMO_GEN)
        self.assertEqual(self.mod.load_demo_json(str(self.demo), now=t0), (demo_text(), False, None))
        self.assertEqual(self.mod.load_demo_json(str(self.demo), now=t0 + 45 * 60)[2], None, "exactly 45 min is not stale")
        self.assertIn("is stale", self.mod.load_demo_json(str(self.demo), now=t0 + 45 * 60 + 1)[2])
        self.assertEqual(self.mod.DEMO_JSON_MAX_AGE_S, 45 * 60)

    def test_default_json_path_derives_from_nemo_www_dir_like_rows_board(self):
        os.environ["NEMO_WWW_DIR"] = str(self.www)
        self.assertEqual(self.mod.default_demo_json(), str(self.www / "rows" / "demo-path.json"))
        code, out, err = self.run_main(demo_flag=False)
        self.assertEqual(code, 0, err)
        self.assertIn("posted demo path", out)
        self.assertTrue(self.read_state()["demo_path"]["ts"])
        del os.environ["NEMO_WWW_DIR"]
        self.assertEqual(self.mod.default_demo_json(), os.path.expanduser("~/.local/share/nemo-www/rows/demo-path.json"))

    def test_dry_run_prints_would_post_or_update_and_writes_nothing(self):
        code, out, err = self.run_main("--dry-run")
        self.assertEqual(code, 0, err)
        self.assertIn("would post demo path (", out)
        self.assertFalse(self.state.exists())
        self.assertEqual(FakeClient.instances, [])
        self.run_main()
        self.write_demo(demo_text("LOOP-F35 merged", "LOOP-F37 review"))
        before = self.read_state()
        code, out, _err = self.run_main("--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("would update demo path (", out)
        self.assertEqual(self.read_state(), before)

    def test_text_is_escaped_end_to_end_with_the_real_client(self):
        self.write_demo(demo_text("LOOP-F35 merged", "GOV-F24 blocked — <!channel> pay & <http://x|link>"))
        http_fake = FakeSlackHTTP()
        code, _out, err = self.run_main(factory=lambda token: self.mod.SlackClient(token, opener=http_fake, sleep=lambda _s: None))
        self.assertEqual(code, 0, err)
        posts = http_fake.bodies("chat.postMessage")
        demo = [b for b in posts if b["text"].startswith("*Demo path*")]
        self.assertEqual(len(demo), 1)
        self.assertIn("GOV-F24 blocked", demo[0]["text"])
        self.assertIn("&lt;!channel&gt; pay &amp; &lt;http://x|link&gt;", demo[0]["text"])
        self.assertNotIn("<!channel>", demo[0]["text"])
        self.assertTrue(self.read_state()["demo_path"]["ts"])
        # And the update path too.
        self.write_demo(demo_text("LOOP-F35 merged", "GOV-F24 blocked — <!here> & co", "LOOP-F37 review"))
        code, _out, err = self.run_main(factory=lambda token: self.mod.SlackClient(token, opener=http_fake, sleep=lambda _s: None))
        self.assertEqual(code, 0, err)
        ups = http_fake.bodies("chat.update")
        self.assertEqual(len(ups), 1)
        self.assertEqual(ups[0]["ts"], self.read_state()["demo_path"]["ts"])
        self.assertIn("&lt;!here&gt; &amp; co", ups[0]["text"])
        self.assertNotIn("<!here>", ups[0]["text"])

    def test_rows_board_then_slack_rows_agree_end_to_end(self):
        """refresh-viewers.sh's order: rows-board.py writes <www>/rows/demo-path.json from the board's records,
        slack-rows.py posts exactly its slack_text; a second board run with new state → one update with the new text."""
        import subprocess
        import sys
        self.demo.unlink()
        ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        rows = {"LOOP-F35": {"state": "merged", "disposition": "BUILD", "batch": "1a"},
                "MEM-F44": {"state": "building", "disposition": "CONFIGURE", "batch": "1b"},
                "GOV-F24": {"state": "queued", "disposition": "BUILD", "batch": "1b"}}
        state = {"generated_at": DEMO_GEN, "rows": rows, "gating": {"1a_first_pass": True}, "wip": {"limit": 3},
                 "queue": {"eligible": ["GOV-F24"], "waiting": []}}
        put(ap / "state.json", json.dumps(state), 1.7e9)
        board = Path(__file__).resolve().parent / "rows-board.py"

        def run_board() -> None:
            r = subprocess.run([sys.executable, str(board), "--root", str(self.root), "--www", str(self.www), "--ncl", ""], capture_output=True, text=True, check=False)
            self.assertEqual(r.returncode, 0, r.stderr)

        run_board()
        data = json.loads(self.demo.read_text(encoding="utf-8"))
        self.assertTrue(data["state_ok"])
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        demo = self.demo_calls(FakeClient.instances[0])
        self.assertEqual(len(demo), 1)
        self.assertEqual(demo[0][2], data["slack_text"])
        self.assertIn("LOOP-F35 merged", demo[0][2])
        self.assertIn("GOV-F24 queued", demo[0][2])
        self.assertIn("LOOP-F37 unknown", demo[0][2], "not a row of this fixture's plan: unknown on the tracker")
        # The board runs again on a new state: the JSON changes, slack-rows edits the message once.
        rows["GOV-F24"]["state"] = "review"
        state["queue"] = {"eligible": [], "waiting": []}
        put(ap / "state.json", json.dumps(state), 1.7e9 + 10)
        run_board()
        data2 = json.loads(self.demo.read_text(encoding="utf-8"))
        self.assertNotEqual(data2["slack_text"], data["slack_text"])
        code, _out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[1].calls
        self.assertEqual([c[0] for c in calls], ["update"])
        self.assertEqual(calls[0][3], data2["slack_text"])
        self.assertIn("GOV-F24 review", calls[0][3])
