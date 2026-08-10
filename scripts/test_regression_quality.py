#!/usr/bin/env python3
"""Tests for regression-quality.py — the producer behind the dashboard's
"regressions per 100 bot/human PRs" panel.

Each test pins a way this metric can be confidently WRONG rather than obviously
broken: an outage that reads as a quality improvement, a numerator divided by a
denominator describing different PRs, a joint bot+human regression charged
entirely to the bot. None of those show up as an error anywhere; they show up as
a plausible number. Run: python3 test_regression_quality.py
"""

import contextlib
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import ClassVar

SCRIPT = Path(__file__).resolve().parent / "regression-quality.py"
_spec = importlib.util.spec_from_file_location("regression_quality", SCRIPT)
rq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rq)

REPO = "shader-slang/slang"
LABELS = f"repos/{REPO}/labels?per_page=100"
ISSUES = f"repos/{REPO}/issues?labels=regression&state=all&per_page=100"
MERGED = f"repos/{REPO}/pulls?state=closed&per_page=100&sort=updated&direction=desc"


def issue(number, created, body="", title="regression", **kw):
    return dict(number=number, created_at=created, body=body, title=title, **kw)


def pr(number, login, merged_at):
    return {"number": number, "user": {"login": login}, "merged_at": merged_at}


class Fail:
    """Route marker: this fetch returns a transport/API error."""

    def __init__(self, stderr="gh: connection refused"):
        self.stderr = stderr


class Raw:
    """Route marker: return this exact stdout text, unencoded."""

    def __init__(self, text):
        self.text = text


class FakeGh:
    """Stands in for `gh api`. Unrouted paths 404 — which is what GitHub really
    does for a `#1234` that turns out to be an issue rather than a PR."""

    def __init__(self, routes):
        self.routes = routes
        self.calls = []

    def __call__(self, cmd, capture_output=True, text=True, timeout=None, check=False):
        path = cmd[2]
        self.calls.append(path)
        if path not in self.routes:
            return SimpleNamespace(returncode=1, stdout="", stderr="gh: Not Found (HTTP 404)")
        v = self.routes[path]
        if isinstance(v, Fail):
            return SimpleNamespace(returncode=1, stdout="", stderr=v.stderr)
        if isinstance(v, Raw):
            return SimpleNamespace(returncode=0, stdout=v.text, stderr="")
        return SimpleNamespace(returncode=0, stdout=json.dumps(v), stderr="")


class Harness(unittest.TestCase):
    def run_main(self, routes, extra_argv=()):
        """Run main() against a fake GitHub. Returns (exit_code, json_doc, stdout)."""
        fake = FakeGh(routes)
        out_dir = tempfile.mkdtemp()
        # A path two levels below anything that exists, so the writer has to
        # create the directory rather than assume it.
        out = os.path.join(out_dir, "reports", "regression-quality.json")
        argv = ["regression-quality.py", "--repo", REPO, "--json", out, *extra_argv]
        buf = io.StringIO()
        real_run = rq.subprocess.run
        rq.subprocess.run = fake
        try:
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
                old_argv, sys.argv = sys.argv, argv
                try:
                    code = rq.main()
                finally:
                    sys.argv = old_argv
        finally:
            rq.subprocess.run = real_run
        doc = json.loads(Path(out).read_text()) if os.path.exists(out) else None
        return code, doc, buf.getvalue(), fake


class TestCohort(Harness):
    """The numerator and the denominator must describe the same PRs."""

    ROUTES: ClassVar[dict] = {
        LABELS: [{"name": "regression"}],
        ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Since #500 this crashes.")],
        f"repos/{REPO}/pulls/500": pr(500, "nv-slang-bot[bot]", "2026-04-02T00:00:00Z"),
        MERGED: [pr(500, "nv-slang-bot[bot]", "2026-04-02T00:00:00Z"),
                 pr(501, "nv-slang-bot[bot]", "2026-04-09T00:00:00Z")]
                + [pr(600 + i, "nv-slang-bot[bot]", "2026-07-05T00:00:00Z") for i in range(50)],
    }

    def test_regression_is_bucketed_by_the_culprit_merge_month(self):
        # Filed in July, caused by a PR merged in April. Bucketing by the filing
        # month put it in July's cohort, next to July's merge volume.
        code, doc, _, _ = self.run_main(self.ROUTES)
        self.assertEqual(code, 0)
        self.assertEqual(doc["cohort"], "culprit-merge-month")
        self.assertEqual(doc["cohort_bot"], {"2026-04": 1})
        self.assertEqual(doc["filed_month"], {"2026-07": 1})  # still reported, separately

    def test_the_rate_divides_by_the_cohort_that_caused_it(self):
        # 1 regression from April's 2 bot PRs is 50 per 100. The old cohort
        # divided it by July's 50 bot PRs and reported 2.0 — a 25x understatement
        # that gets BETTER the faster the bot ships in unrelated months.
        _, doc, _, _ = self.run_main(self.ROUTES)
        self.assertEqual(doc["rate_bot_per_100"]["2026-04"], 50.0)
        self.assertEqual(doc["rate_bot_per_100"]["2026-07"], 0.0)

    def test_multi_culprit_issue_lands_in_exactly_one_bucket(self):
        routes = dict(self.ROUTES)
        routes[ISSUES] = [issue(1, "2026-07-20T00:00:00Z", body="Since #500/#502 this crashes.")]
        routes[f"repos/{REPO}/pulls/502"] = pr(502, "nv-slang-bot[bot]", "2026-05-11T00:00:00Z")
        _, doc, _, _ = self.run_main(routes)
        # The latest-merged culprit is the one that landed closest to the report.
        self.assertEqual(doc["cohort_bot"], {"2026-05": 1})
        self.assertEqual(sum(doc["cohort_bot"].values()), 1)

    def test_a_culprit_that_merged_after_the_filing_is_rejected(self):
        # A PR that merged after the regression was reported cannot have caused
        # it; without this the "culprit" is usually the FIX being cited.
        routes = dict(self.ROUTES)
        routes[f"repos/{REPO}/pulls/500"] = pr(500, "nv-slang-bot[bot]", "2026-08-01T00:00:00Z")
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 0)
        self.assertEqual(doc["cohort_bot"], {})
        self.assertEqual(doc["unattributed"], 1)


class TestMixedAuthorship(Harness):
    def test_mixed_bot_and_human_culprits_are_named_not_charged_to_the_bot(self):
        routes = {
            LABELS: [{"name": "regression"}],
            ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Bisected to #500 and #501.")],
            f"repos/{REPO}/pulls/500": pr(500, "nv-slang-bot[bot]", "2026-04-02T00:00:00Z"),
            f"repos/{REPO}/pulls/501": pr(501, "alice", "2026-04-03T00:00:00Z"),
            MERGED: [pr(500, "nv-slang-bot[bot]", "2026-04-02T00:00:00Z"),
                     pr(501, "alice", "2026-04-03T00:00:00Z")],
        }
        _, doc, _, _ = self.run_main(routes)
        # `any(bot) -> bot` charged this entirely to the bot.
        self.assertEqual(doc["cohort_mixed"], {"2026-04": 1})
        self.assertEqual(doc["cohort_bot"], {})
        self.assertEqual(doc["rate_bot_per_100"]["2026-04"], 0.0)


class TestFailClosed(Harness):
    """An outage must never be publishable as a clean number."""

    GOOD: ClassVar[dict] = {
        LABELS: [{"name": "regression"}],
        ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Since #500 this crashes.")],
        f"repos/{REPO}/pulls/500": pr(500, "nv-slang-bot[bot]", "2026-04-02T00:00:00Z"),
        MERGED: [pr(500, "nv-slang-bot[bot]", "2026-04-02T00:00:00Z")],
    }

    def test_the_happy_path_really_does_publish(self):
        # Guards the guard: if this failed, every fail-closed test below would
        # pass for the wrong reason.
        code, doc, _, _ = self.run_main(self.GOOD)
        self.assertEqual(code, 0)
        self.assertTrue(doc["complete"])
        self.assertEqual(doc["errors"], [])
        self.assertIn("cohort_bot", doc)

    def test_a_failed_issue_fetch_withholds_the_metrics_and_exits_nonzero(self):
        routes = dict(self.GOOD, **{ISSUES: Fail()})
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 1)
        self.assertFalse(doc["complete"])
        self.assertTrue(doc["errors"])
        # The old script printed zeros here and exited 0.
        self.assertNotIn("cohort_bot", doc)
        self.assertNotIn("rate_bot_per_100", doc)

    def test_a_failed_denominator_fetch_fails_closed(self):
        routes = dict(self.GOOD, **{MERGED: Fail()})
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 1)
        self.assertFalse(doc["complete"])
        self.assertNotIn("rate_bot_per_100", doc)

    def test_a_failed_culprit_lookup_fails_closed(self):
        # `or []` used to swallow this: the issue silently became unattributed
        # and the month's bot count dropped by one, which reads as improvement.
        routes = dict(self.GOOD, **{f"repos/{REPO}/pulls/500": Fail()})
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 1)
        self.assertFalse(doc["complete"])
        self.assertNotIn("cohort_bot", doc)

    def test_a_failed_comment_fetch_is_unknown_not_unattributed(self):
        routes = dict(self.GOOD)
        routes[ISSUES] = [issue(1, "2026-07-20T00:00:00Z", body="no causal wording here")]
        routes[f"repos/{REPO}/issues/1/comments?per_page=100"] = Fail()
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 1)
        self.assertEqual(doc["partial"]["attributionFailed"], 1)
        self.assertEqual(doc["partial"]["unattributed"], 0)

    def test_errors_name_what_failed(self):
        routes = dict(self.GOOD, **{MERGED: Fail("gh: API rate limit exceeded")})
        _, doc, _, _ = self.run_main(routes)
        self.assertEqual([e["what"] for e in doc["errors"]], ["merged-prs"])
        self.assertIn("rate limit", doc["errors"][0]["detail"])

    def test_a_missing_label_is_reported_as_nothing_to_measure(self):
        routes = dict(self.GOOD, **{LABELS: [{"name": "bug"}]})
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 2)
        self.assertNotIn("cohort_bot", doc)

    def test_zero_labelled_issues_is_not_a_clean_zero(self):
        routes = dict(self.GOOD, **{ISSUES: []})
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 2)
        self.assertFalse(doc["complete"])


class TestNotAnOutage(Harness):
    """Things that LOOK like failures but are real answers."""

    def test_a_404_on_a_reference_that_is_not_a_pr_is_data_not_an_outage(self):
        # Issue bodies routinely cite issue numbers. If every 404 failed the run,
        # the collector would never publish anything at all.
        routes = {
            LABELS: [{"name": "regression"}],
            ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Caused by #999 (an issue, not a PR).")],
            MERGED: [pr(500, "alice", "2026-04-02T00:00:00Z")],
        }
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 0)
        self.assertTrue(doc["complete"])
        self.assertEqual(doc["unattributed"], 1)
        self.assertEqual(doc["attributionFailed"], 0)

    def test_an_unmerged_culprit_is_simply_not_a_culprit(self):
        routes = {
            LABELS: [{"name": "regression"}],
            ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Since #500.")],
            f"repos/{REPO}/pulls/500": {"number": 500, "user": {"login": "alice"}, "merged_at": None},
            MERGED: [pr(501, "alice", "2026-04-02T00:00:00Z")],
        }
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 0)
        self.assertEqual(doc["unattributed"], 1)


class TestPagination(Harness):
    def test_a_multi_page_response_is_spliced_into_one_flat_list(self):
        # `gh --paginate` emits "[...][...]"; the old repair wrapped the splice in
        # a second pair of brackets, so the first response that actually needed
        # paginating crashed the caller on .get().
        routes = {
            LABELS: Raw('[{"name":"other"}][{"name":"regression"}]'),
            ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Since #500.")],
            f"repos/{REPO}/pulls/500": pr(500, "alice", "2026-04-02T00:00:00Z"),
            MERGED: [pr(500, "alice", "2026-04-02T00:00:00Z")],
        }
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 0)  # the label WAS found, on page 2
        self.assertEqual(doc["cohort_human"], {"2026-04": 1})


class TestAttribution(Harness):
    def test_a_culprit_named_only_in_a_comment_is_found(self):
        # Maintainers very often bisect in a comment, not in the body.
        routes = {
            LABELS: [{"name": "regression"}],
            ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Shader output is wrong.")],
            f"repos/{REPO}/issues/1/comments?per_page=100": [{"body": "Bisected to #500."}],
            f"repos/{REPO}/pulls/500": pr(500, "nv-slang-bot", "2026-04-02T00:00:00Z"),
            MERGED: [pr(500, "nv-slang-bot", "2026-04-02T00:00:00Z")],
        }
        code, doc, _, _ = self.run_main(routes)
        self.assertEqual(code, 0)
        self.assertEqual(doc["cohort_bot"], {"2026-04": 1})
        self.assertEqual(doc["rows"][0]["source"], "comment")

    def test_the_body_is_preferred_so_comments_cost_nothing_when_it_suffices(self):
        routes = {
            LABELS: [{"name": "regression"}],
            ISSUES: [issue(1, "2026-07-20T00:00:00Z", body="Since #500.")],
            f"repos/{REPO}/pulls/500": pr(500, "alice", "2026-04-02T00:00:00Z"),
            MERGED: [pr(500, "alice", "2026-04-02T00:00:00Z")],
        }
        _, _, _, fake = self.run_main(routes)
        self.assertNotIn(f"repos/{REPO}/issues/1/comments?per_page=100", fake.calls)

    def test_a_bare_bot_login_is_still_the_bot(self):
        # `nv-slang-bot` without the "[bot]" suffix used to classify as human on
        # BOTH sides of the ratio.
        self.assertTrue(rq.is_bot("nv-slang-bot"))
        self.assertTrue(rq.is_bot("nv-slang-bot[bot]"))
        self.assertTrue(rq.is_bot(" NV-Slang-Bot[BOT] "))
        self.assertFalse(rq.is_bot("alice"))
        self.assertFalse(rq.is_bot(None))


class TestCausalWindow(unittest.TestCase):
    """The window is a block, not a character count."""

    def test_a_cause_heading_reaches_its_paragraph(self):
        body = "## Cause\n\nThe culprit is #12345, introduced last week.\n"
        self.assertEqual(rq.causal_refs(body), {12345})

    def test_a_since_list_captures_every_reference_not_just_the_first(self):
        # Capturing only the first blamed a human PR when the bot PR beside it
        # was the actual cause.
        self.assertEqual(rq.causal_refs("Since #11524/#11558 the tests fail."), {11524, 11558})

    def test_the_window_stops_at_the_end_of_the_causal_block(self):
        body = "Caused by #12345.\n\nUnrelated section mentioning #99999.\n"
        self.assertEqual(rq.causal_refs(body), {12345})

    def test_the_window_stops_at_the_next_heading(self):
        body = "Caused by #12345.\n## Workaround\nUse #99999 instead.\n"
        self.assertEqual(rq.causal_refs(body), {12345})

    def test_a_bare_reference_with_no_causal_wording_is_not_a_culprit(self):
        self.assertEqual(rq.causal_refs("See #12345 for context."), set())

    def test_an_empty_body_is_not_an_error(self):
        self.assertEqual(rq.causal_refs(None), set())
        self.assertEqual(rq.causal_refs(""), set())


class TestAtomicWrite(unittest.TestCase):
    def test_it_creates_the_output_directory(self):
        d = tempfile.mkdtemp()
        out = os.path.join(d, "reports", "regression-quality.json")
        rq.write_json(out, {"ok": True})
        self.assertEqual(json.loads(Path(out).read_text()), {"ok": True})

    def test_it_replaces_atomically_and_leaves_no_temp_files(self):
        d = tempfile.mkdtemp()
        out = os.path.join(d, "regression-quality.json")
        rq.write_json(out, {"n": 1})
        rq.write_json(out, {"n": 2})
        self.assertEqual(json.loads(Path(out).read_text()), {"n": 2})
        self.assertEqual(sorted(os.listdir(d)), ["regression-quality.json"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
