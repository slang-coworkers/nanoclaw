"""Thread selection and delivery receipts, with no network calls or live DBs."""
import contextlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import slack_report as report

RUN = "https://github.com/shader-slang/slang/actions/runs/123"
CREATED = "2026-10-13T05:00:00Z"
CHANNEL = "CFFF96M6Z"
PARENT = "1791869748.464579"
POLICY = {"reporting": {"slack_channel_id": CHANNEL, "destination": "compile-perf-slack"}}


@contextlib.contextmanager
def fixture_db(path):
    with contextlib.closing(sqlite3.connect(path)) as db, db:
        yield db


def message(ts=PARENT, url=RUN, **extra):
    return {"ts": ts, "subtype": "bot_message", "text": f"Compile-perf nightly\nRun: <{url}>", **extra}


class Slack:
    def __init__(self, *pages):
        self.pages = list(pages) or [{"messages": [message()]}]
        self.calls = []

    def history(self, **args):
        self.calls.append(args)
        return self.pages.pop(0)


class ThreadTests(unittest.TestCase):
    def resolve(self, slack):
        return report.resolve_thread(slack, CHANNEL, RUN, CREATED)

    def test_exact_run_url_and_bot_parent_are_required(self):
        slack = Slack({"messages": [message(url=RUN + "4"), message(ts="1.1", subtype=""),
                                     message(ts="2.2", thread_ts="1.1"), message()]})
        self.assertEqual(self.resolve(slack), PARENT)
        self.assertEqual(slack.calls[0]["channel"], CHANNEL)
        self.assertEqual(slack.calls[0]["oldest"], "1791867540")

    def test_link_labels_are_supported(self):
        self.assertEqual(self.resolve(Slack({"messages": [message(text=f"Compile-perf nightly <{RUN}|run>")]})), PARENT)

    def test_all_pages_are_checked(self):
        slack = Slack({"messages": [], "response_metadata": {"next_cursor": "next"}},
                      {"messages": [message()]})
        self.assertEqual(self.resolve(slack), PARENT)
        self.assertEqual(slack.calls[1]["cursor"], "next")

    def test_ambiguous_matches_do_not_select_the_latest_thread(self):
        slack = Slack({"messages": [message()], "response_metadata": {"next_cursor": "next"}},
                      {"messages": [message(ts="2.2")]})
        with self.assertRaisesRegex(report.DeliveryError, "found 2"):
            self.resolve(slack)

    def test_no_match_never_falls_back_to_channel_root(self):
        with self.assertRaisesRegex(report.DeliveryError, "found 0"):
            self.resolve(Slack({"messages": [message(url=RUN + "4")]}))

    def test_partial_history_cannot_establish_a_unique_match(self):
        with self.assertRaisesRegex(report.DeliveryError, "incomplete"):
            self.resolve(Slack({"messages": [message()], "has_more": True}))

    def test_cursor_loop_is_not_a_valid_lookup(self):
        page = {"messages": [], "response_metadata": {"next_cursor": "same"}}
        with self.assertRaisesRegex(report.DeliveryError, "repeated a cursor"):
            self.resolve(Slack(page, page))


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.inbound, self.outbound = self.root / "inbound.db", self.root / "outbound.db"
        with fixture_db(self.inbound) as db:
            db.executescript("CREATE TABLE destinations (name, type, channel_type, platform_id);"
                             "CREATE TABLE delivered (message_out_id, status, platform_message_id);")
            db.execute("INSERT INTO destinations VALUES (?, 'channel', 'slack', ?)",
                       ("compile-perf-slack", f"slack:{CHANNEL}"))
        with fixture_db(self.outbound) as db:
            db.execute("CREATE TABLE messages_out (id, content, channel_type, platform_id, thread_id, kind)")
        self.body = self.root / "analysis.md"
        self.body.write_text("*Finding:* measured 8% overhead.\nClass: avoidable-overhead.")
        self.slack = Slack()

    def prepare(self, **kw):
        return report.prepare(self.root, 123, CREATED, self.body, kw.get("policy", POLICY),
                              self.inbound, self.outbound, self.slack)

    def state(self):
        return json.loads((self.root / "123.json").read_text())

    def enqueue(self, args, msg_id="out-1", **overrides):
        with fixture_db(self.outbound) as db:
            db.execute("INSERT INTO messages_out VALUES (?, ?, 'slack', ?, ?, 'chat')",
                       (msg_id, json.dumps({"text": overrides.get("text", args["text"])}),
                        f"slack:{CHANNEL}", overrides.get("thread_id", args["thread_id"])))

    def receipt(self, status="delivered", platform_id="slack-message-1"):
        with fixture_db(self.inbound) as db:
            db.execute("INSERT INTO delivered VALUES ('out-1', ?, ?)", (status, platform_id))

    def test_prepares_one_explicit_threaded_mcp_send(self):
        result = self.prepare()
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["tool"], "mcp__nanoclaw__send_message")
        self.assertEqual(result["arguments"]["to"], "compile-perf-slack")
        self.assertEqual(result["arguments"]["thread_id"], f"slack:{CHANNEL}:{PARENT}")
        self.assertTrue(result["arguments"]["text"].startswith("[Perf Finding]"))
        self.assertIn(self.body.read_text(), result["arguments"]["text"])
        self.assertEqual(self.state()["status"], "reserved")
        with fixture_db(self.outbound) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM messages_out").fetchone()[0], 0)

    def test_crash_before_enqueue_does_not_grant_a_second_send(self):
        self.prepare()
        resumed = self.prepare()
        self.assertEqual(resumed["status"], "reserved")
        self.assertNotIn("arguments", resumed)
        self.assertEqual(len(self.slack.calls), 1)

    def test_crash_after_enqueue_is_recovered_without_sending_again(self):
        self.enqueue(self.prepare()["arguments"])
        resumed = self.prepare()
        self.assertEqual(resumed["status"], "queued")
        self.assertEqual(resumed["message_id"], "out-1")
        self.assertNotIn("arguments", resumed)
        self.assertEqual(resumed["check_after"], 0)

    def test_host_receipt_is_required_before_completion(self):
        self.enqueue(self.prepare()["arguments"])
        self.assertEqual(self.prepare()["status"], "queued")
        self.receipt()
        done = self.prepare()
        self.assertEqual(done["status"], "delivered")
        self.assertEqual(done["platform_message_id"], "slack-message-1")
        self.assertNotIn("arguments", done)
        # The durable receipt still prevents duplicates after session DB GC.
        with fixture_db(self.outbound) as db:
            db.execute("DELETE FROM messages_out")
        self.assertEqual(self.prepare()["status"], "delivered")

    def test_failed_delivery_is_not_completion_or_permission_to_retry(self):
        self.enqueue(self.prepare()["arguments"])
        self.receipt("failed", None)
        result = self.prepare()
        self.assertEqual(result["status"], "failed")
        self.assertNotIn("arguments", result)
        self.assertGreater(result["check_after"], 0)

    def test_wrong_thread_or_text_cannot_satisfy_the_receipt(self):
        args = self.prepare()["arguments"]
        self.enqueue(args, thread_id="slack:CFFF96M6Z:9.9")
        self.enqueue(args, msg_id="out-2", text="another report")
        self.receipt()
        self.assertEqual(self.prepare()["status"], "reserved")

    def test_missing_destination_fails_before_lookup_or_reservation(self):
        with fixture_db(self.inbound) as db:
            db.execute("DELETE FROM destinations")
        with self.assertRaisesRegex(report.DeliveryError, "must authorize"):
            self.prepare()
        self.assertFalse((self.root / "123.json").exists())
        self.assertEqual(self.slack.calls, [])

    def test_changed_destination_cannot_redirect_an_existing_delivery(self):
        self.prepare()
        other = {"reporting": {"destination": "other", "slack_channel_id": CHANNEL}}
        with fixture_db(self.inbound) as db:
            db.execute("INSERT INTO destinations VALUES ('other', 'channel', 'slack', ?)", (f"slack:{CHANNEL}",))
        with self.assertRaisesRegex(report.DeliveryError, "target changed"):
            self.prepare(policy=other)

    def test_missing_match_leaves_no_send_reservation(self):
        self.slack = Slack({"messages": []})
        with self.assertRaisesRegex(report.DeliveryError, "found 0"):
            self.prepare()
        self.assertFalse((self.root / "123.json").exists())

    def test_report_is_not_silently_truncated(self):
        self.body.write_text("x" * 12001)
        with self.assertRaisesRegex(report.DeliveryError, "shorten it"):
            self.prepare()

    def test_receipt_without_slack_message_id_is_not_success(self):
        self.enqueue(self.prepare()["arguments"])
        self.receipt(platform_id=None)
        with self.assertRaisesRegex(report.DeliveryError, "no confirmed Slack message id"):
            self.prepare()


if __name__ == "__main__":
    unittest.main()
