"""Exact nightly thread selection, without network calls or delivery state."""
import unittest

import slack_report as report

RUN = "https://github.com/shader-slang/slang/actions/runs/123"
CREATED = "2026-10-13T05:00:00Z"
CHANNEL = "CFFF96M6Z"
PARENT = "1791869748.464579"
POLICY = {"reporting": {"slack_channel_id": CHANNEL, "destination": "compile-perf-slack"}}


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


class LookupTests(unittest.TestCase):
    def test_returns_explicit_route_for_nanoclaw(self):
        route = report.lookup(123, CREATED, POLICY, Slack())
        self.assertEqual(route, {"to": "compile-perf-slack", "thread_id": f"slack:{CHANNEL}:{PARENT}",
                                 "run_url": RUN, "channel_id": CHANNEL, "parent_ts": PARENT})

    def test_lookup_is_repeatable_and_does_not_reserve_a_send(self):
        slack = Slack({"messages": [message()]}, {"messages": [message()]})
        self.assertEqual(report.lookup(123, CREATED, POLICY, slack),
                         report.lookup(123, CREATED, POLICY, slack))

    def test_missing_config_is_blocked_before_slack_access(self):
        slack = Slack()
        with self.assertRaisesRegex(report.DeliveryError, "policy.reporting"):
            report.lookup(123, CREATED, {}, slack)
        self.assertEqual(slack.calls, [])


if __name__ == "__main__":
    unittest.main()
