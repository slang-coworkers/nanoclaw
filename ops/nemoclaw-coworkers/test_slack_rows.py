#!/usr/bin/env python3
"""Tests for ops/nemoclaw-coworkers/slack-rows.py: a temp checkout with a small dispatch-plan.md, a
ledger and synthetic PNG cards, driven through main() with a fake Slack client. Covers: root posted
once, cards oldest-first and recorded, a second run posts nothing, the merge / blocked line once,
not_in_channel → exit 2 with the state untouched, dry-run makes no calls, --max-posts, a single card
failure never aborts, the token never reaches stdout/stderr, and the urllib client's three-step
upload + 429 retry against a fake urlopen.
Run: python3 -m unittest ops/nemoclaw-coworkers/test_slack_rows.py
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
import urllib.error
from pathlib import Path
from typing import ClassVar

HERE = Path(__file__).resolve().parent
TOKEN = "xoxb-TEST-SECRET-TOKEN-4242"  # a fixture value the tests assert is never printed
CHANNEL = "C0TESTCHAN"

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


def load_module():
    spec = importlib.util.spec_from_file_location("slack_rows", HERE / "slack-rows.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FakeClient:
    """Records every call; `fail` maps a (kind, key) to an exception to raise on that call."""

    instances: ClassVar[list] = []

    def __init__(self, token: str):
        self.token = token
        self.calls: list = []
        self.fail: dict = {}
        self.ts = 1000
        FakeClient.instances.append(self)

    def post_message(self, channel, text, thread_ts=None):
        exc = self.fail.get(("post", text.split(" · ")[0].split(" ")[0]))
        if exc:
            raise exc
        self.ts += 1
        self.calls.append(("post", channel, text, thread_ts))
        return f"{self.ts}.000100"

    def upload_file(self, channel, thread_ts, path, title, initial_comment):
        exc = self.fail.get(("upload", os.path.basename(path)))
        if exc:
            raise exc
        self.calls.append(("upload", channel, thread_ts, os.path.basename(path), title, initial_comment))
        return f"F{len(self.calls):04d}"


def put(path: Path, data, mtime: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, bytes):
        path.write_bytes(data)
    else:
        path.write_text(data, encoding="utf-8")
    os.utime(path, (mtime, mtime))


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
        # Three cards on LOOP-F35 written out of role order: architect (oldest), builder, tester (newest).
        put(arch / "card-hermes-architect-handoff-r1.png", b"\x89PNG arch", base + 10)
        put(arch / "card-hermes-architect-handoff-r1.json",
            json.dumps({"row": "LOOP-F35", "role": "hermes-architect", "outcome": "HANDOFF", "round": 1,
                        "headline": "ADR + 4 AC (pytest 3 / live 1)", "meta": {"cost": "n/a"}}), base + 10)
        put(builder / "card-hermes-builder-shipped-r1.png", b"\x89PNG build", base + 20)
        put(builder / "card-hermes-builder-shipped-r1.json",
            json.dumps({"row": "LOOP-F35", "role": "hermes-builder", "outcome": "SHIPPED", "round": 1,
                        "headline": "hermes-agent#7 draft, head e117c1c", "meta": {}}), base + 20)
        put(tester / "card-hermes-tester-pass-r2.png", b"\x89PNG test", base + 30)  # no .json: caption from the filename
        put(tester / "card-hermes-tester-latest.png", b"\x89PNG test", base + 30)  # the latest copy is not a card
        put(tester / "card-hermes-tester-fail-r1.html", "<html>fallback</html>", base + 5)  # html-only: not uploaded
        self.env_backup = {k: os.environ.pop(k) for k in ("SLACK_BOT_TOKEN", "SLACK_ROWS_CHANNEL") if k in os.environ}

    def tearDown(self):
        os.environ.update(self.env_backup)
        self.tmp.cleanup()

    def run_main(self, *extra: str, factory=FakeClient) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = self.mod.main(["--root", str(self.root), "--channel", CHANNEL, *extra], client_factory=factory)
        return code, out.getvalue(), err.getvalue()

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
            "LOOP-F35 · Lego coworker composition · batch 1a · dispatched 2026-09-09",
            "MEM-F44 · Memory retention · batch 1b · dispatched 2026-09-10",
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
            b"\x89PNG rev", 1.7e9 + 40)
        code, out, err = self.run_main()
        self.assertEqual(code, 0, err)
        calls = FakeClient.instances[2].calls
        self.assertEqual([c[0] for c in calls], ["upload"])
        self.assertEqual(calls[0][2], root_ts)
        self.assertEqual(calls[0][5], "LOOP-F35 · hermes-reviewer · APPROVE")
        self.assertEqual(len(self.read_state()["rows"]["LOOP-F35"]["cards"]), 4)

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

    def test_dry_run_makes_no_calls_and_writes_no_state(self):
        code, out, err = self.run_main("--dry-run")
        self.assertEqual(code, 0, err)
        self.assertEqual(FakeClient.instances, [], "dry-run never builds a client")
        self.assertFalse(self.state.exists())
        self.assertIn("would post root LOOP-F35: LOOP-F35 · Lego coworker composition · batch 1a · dispatched 2026-09-09", out)
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


class FakeResponse:
    def __init__(self, body: bytes):
        self.body = body

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class SlackClientTest(unittest.TestCase):
    """The urllib client against a fake urlopen: the upload flow, form vs JSON bodies, 429 and ok:false."""

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
            png = Path(d) / "card-hermes-tester-pass-r2.png"
            png.write_bytes(b"\x89PNG bytes")
            self.script = [
                json.dumps({"ok": True, "upload_url": "https://files.slack.com/upload/v1/abc", "file_id": "F123"}).encode(),
                b"OK - 10 bytes uploaded",
                json.dumps({"ok": True, "files": [{"id": "F123"}]}).encode(),
            ]
            fid = self.client().upload_file(CHANNEL, "1700.0001", str(png), "title", "LOOP-F35 · hermes-tester · PASS")
        self.assertEqual(fid, "F123")
        urls = [r.full_url for r in self.requests]
        self.assertEqual(urls, [
            "https://slack.com/api/files.getUploadURLExternal",
            "https://files.slack.com/upload/v1/abc",
            "https://slack.com/api/files.completeUploadExternal",
        ])
        step1 = dict(urllib.parse.parse_qsl(self.requests[0].data.decode()))
        self.assertEqual(step1, {"filename": "card-hermes-tester-pass-r2.png", "length": "10"})
        self.assertEqual(self.requests[0].get_header("Authorization"), f"Bearer {TOKEN}")
        self.assertEqual(self.requests[1].data, b"\x89PNG bytes")
        self.assertFalse(self.requests[1].has_header("Authorization"), "the pre-signed upload URL gets no token")
        step3 = json.loads(self.requests[2].data.decode())
        self.assertEqual(step3, {"files": [{"id": "F123", "title": "title"}], "channel_id": CHANNEL,
                                 "thread_ts": "1700.0001", "initial_comment": "LOOP-F35 · hermes-tester · PASS"})
        self.assertTrue(self.requests[2].get_header("Content-type").startswith("application/json"))

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

    def test_ok_false_and_not_in_channel(self):
        self.script = [json.dumps({"ok": False, "error": "not_in_channel"}).encode()]
        with self.assertRaises(self.mod.NotInChannel) as ctx:
            self.client().post_message(CHANNEL, "x")
        self.assertEqual(str(ctx.exception), "slack error chat.postMessage: not_in_channel")
        self.script = [json.dumps({"ok": False, "error": "invalid_auth"}).encode()]
        with self.assertRaises(self.mod.SlackError) as ctx:
            self.client().call("auth.test", {})
        self.assertEqual(ctx.exception.error, "invalid_auth")
        self.assertNotIn(TOKEN, str(ctx.exception))
        self.script = [urllib.error.HTTPError("u", 500, "boom", {}, None)]
        with self.assertRaises(self.mod.SlackError) as ctx:
            self.client().call("auth.test", {})
        self.assertEqual(ctx.exception.error, "http 500")
        self.assertEqual(self.sleeps, [], "only 429 sleeps")


if __name__ == "__main__":
    unittest.main()
