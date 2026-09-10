#!/usr/bin/env python3
"""Tests for mine_select.py, the deterministic half of review-cycle mining.

Each test pins a way the daily task could go quietly wrong: a threshold that
drifts from "> 5" to ">= 5", a PR mined twice, a batch whose order depends on
dict iteration, a gate that answers "nothing to do" when the snapshot is
missing or still on the old shape, a merge that clips an explanation or leaves
a torn file behind. Run: python3 -m unittest scripts/test_mine_select.py
"""

import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import mine_select as ms

NOW = datetime(2026, 9, 10, 5, 20, tzinfo=timezone.utc)
REPO = "shader-slang/slang"


def pr(number, rounds, comments, repo=REPO, **extra):
    row = {
        "repo": repo,
        "number": number,
        "url": f"https://github.com/{repo}/pull/{number}",
        "title": f"PR {number}",
        "author": "nv-slang-bot",
        "authorClass": "bot",
        "state": "merged",
        "rounds": rounds,
        "comments": comments,
        "reviewers": ["jkwak-work"],
        "classification": {"question": 1, "change_request": 2, "nit": 0, "ack": 0, "process": 0, "other": 0},
        "longestComments": [],
        "activityWeeks": ["2026-08-31"],
        "truncated": False,
        "irrelevantProducerKey": {"x": 1},
    }
    row.update(extra)
    return row


def snapshot(per_pr, generated=None, complete=True, schema=3):
    return {
        "schema": schema,
        "generatedAt": ms.iso(generated or NOW - timedelta(hours=1)),
        "since": "2026-04-10",
        "metric": "review-cycles",
        "complete": complete,
        "errors": [],
        "perPR": per_pr,
    }


def record(number, repo=REPO, mined_at="2026-09-10T05:30:00Z", **overrides):
    rec = {
        "repo": repo,
        "number": number,
        "url": f"https://github.com/{repo}/pull/{number}",
        "rounds": 7,
        "comments": 29,
        "minedAt": mined_at,
        "whyShort": "Six-week design review: reviewers disagreed on the SPIR-V representation.",
        "whyLong": "Opened in July as a design PR; three reviewers pushed back on the representation "
        "choice over 21 inline threads, and the author reworked the approach twice.",
        "categories": ["design_disagreement", "understanding"],
        "quotes": [
            {
                "author": "jkwak-work",
                "date": "2026-07-22T15:48:56Z",
                "text": "I am having a trouble understanding how this condition translates to NV extensions.",
            }
        ],
        "suggestedRule": "Open a short design note before a representation-changing PR so reviewers agree on the shape first.",
    }
    rec.update(overrides)
    return rec


class Files:
    """A temp dir holding a snapshot and (optionally) a why file."""

    def __init__(self, per_pr=None, snap=None, why=None):
        self.dir = tempfile.TemporaryDirectory()
        self.rounds = os.path.join(self.dir.name, "review-rounds.json")
        self.why = os.path.join(self.dir.name, "review-cycles-why.json")
        if snap is None and per_pr is not None:
            snap = snapshot(per_pr)
        if snap is not None:
            self.write(self.rounds, snap)
        if why is not None:
            self.write(self.why, why)

    def write(self, path, value):
        with open(path, "w", encoding="utf-8") as fh:
            if isinstance(value, str):
                fh.write(value)
            else:
                json.dump(value, fh)

    def cleanup(self):
        self.dir.cleanup()


def run_main(argv):
    out = io.StringIO()
    err = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = ms.main(argv)
    return rc, out.getvalue(), err.getvalue()


class SelectionTest(unittest.TestCase):
    def setUp(self):
        self.files = Files(
            [
                pr(1, 5, 15),  # exactly at both thresholds: NOT a candidate
                pr(2, 6, 0),  # rounds over
                pr(3, 0, 16),  # comments over
                pr(4, 6, 40),  # both over, most comments
                pr(5, 9, 2),  # most rounds
                pr(6, 6, 0, repo="shader-slang/slangpy"),
                pr(7, 0, 0),
                {"repo": REPO, "number": "not-an-int", "rounds": 99, "comments": 99},
            ]
        )

    def tearDown(self):
        self.files.cleanup()

    def test_thresholds_are_strict_and_either_suffices(self):
        sel = ms.selection(self.files.rounds, self.files.why, NOW)
        numbers = [r["number"] for r in sel["batch"]]
        self.assertNotIn(1, numbers, "rounds == 5 and comments == 15 must not qualify")
        self.assertIn(2, numbers)
        self.assertIn(3, numbers)
        self.assertNotIn(7, numbers)
        self.assertEqual(sel["candidates"], 5)
        self.assertEqual(sel["alreadyMined"], 0)

    def test_order_is_rounds_then_comments_then_number(self):
        sel = ms.selection(self.files.rounds, self.files.why, NOW)
        self.assertEqual([r["number"] for r in sel["batch"]], [5, 4, 6, 2, 3])

    def test_limit_caps_batch_but_not_the_candidate_count(self):
        sel = ms.selection(self.files.rounds, self.files.why, NOW, limit=2)
        self.assertEqual([r["number"] for r in sel["batch"]], [5, 4])
        self.assertEqual(sel["candidates"], 5)

    def test_already_mined_prs_are_skipped(self):
        self.files.write(self.files.why, {"schema": 1, "records": [record(5), record(4)]})
        sel = ms.selection(self.files.rounds, self.files.why, NOW)
        self.assertEqual([r["number"] for r in sel["batch"]], [6, 2, 3])
        self.assertEqual(sel["alreadyMined"], 2)

    def test_bare_list_why_file_is_accepted(self):
        self.files.write(self.files.why, [record(5)])
        sel = ms.selection(self.files.rounds, self.files.why, NOW)
        self.assertNotIn(5, [r["number"] for r in sel["batch"]])

    def test_repo_filter(self):
        sel = ms.selection(self.files.rounds, self.files.why, NOW, repo="shader-slang/slangpy")
        self.assertEqual([r["number"] for r in sel["batch"]], [6])

    def test_rows_are_trimmed_to_known_fields(self):
        sel = ms.selection(self.files.rounds, self.files.why, NOW)
        row = sel["batch"][0]
        self.assertNotIn("irrelevantProducerKey", row)
        for key in ("repo", "number", "url", "rounds", "comments", "reviewers", "classification", "longestComments"):
            self.assertIn(key, row)

    def test_select_cli_prints_json_and_exits_zero(self):
        rc, out, _ = run_main(["select", "--rounds", self.files.rounds, "--why", self.files.why, "--limit", "1"])
        self.assertEqual(rc, 0)
        payload = json.loads(out)
        self.assertEqual(payload["batch"][0]["number"], 5)
        self.assertEqual(payload["thresholds"], {"rounds": "> 5", "comments": "> 15"})


class GateTest(unittest.TestCase):
    def gate(self, files, **kw):
        return ms.gate_payload(ms.selection(files.rounds, files.why, kw.pop("now", NOW), **kw))

    def test_candidates_wake_with_brief_batch(self):
        files = Files([pr(2, 6, 0), pr(3, 0, 16), pr(7, 0, 0)])
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertTrue(out["wakeAgent"])
        self.assertEqual(out["data"]["candidates"], 2)
        self.assertEqual(out["data"]["batchSize"], 2)
        self.assertEqual([b["number"] for b in out["data"]["batch"]], [2, 3])
        self.assertEqual(set(out["data"]["batch"][0]), {"repo", "number", "url", "rounds", "comments", "state", "authorClass"})
        self.assertNotIn("error", out["data"])

    def test_no_candidates_gates_quietly(self):
        files = Files([pr(7, 0, 0), pr(1, 5, 15)])
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertFalse(out["wakeAgent"])
        self.assertEqual(out["data"]["reason"], "no new candidates")

    def test_all_candidates_already_mined_gates_quietly(self):
        files = Files([pr(2, 6, 0)], why={"schema": 1, "records": [record(2)]})
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertFalse(out["wakeAgent"])
        self.assertEqual(out["data"]["alreadyMined"], 1)

    def test_missing_snapshot_is_loud(self):
        files = Files()
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertTrue(out["wakeAgent"], "a missing snapshot must not read as 'nothing to do'")
        self.assertIn("missing", out["data"]["error"])

    def test_unreadable_snapshot_is_loud(self):
        files = Files(snap="{not json")
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertTrue(out["wakeAgent"])
        self.assertIn("unreadable", out["data"]["error"])

    def test_old_shape_schema_2_is_loud(self):
        old = snapshot([pr(2, 6, 0)], schema=2)
        del old["perPR"]
        old["weekly"] = []
        files = Files(snap=old)
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertTrue(out["wakeAgent"])
        self.assertIn("schema 2", out["data"]["error"])

    def test_incomplete_snapshot_gates_quietly_with_reason(self):
        incomplete = snapshot([], complete=False)
        del incomplete["perPR"]  # the producer writes only the envelope on complete:false
        files = Files(snap=incomplete)
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertFalse(out["wakeAgent"])
        self.assertIn("incomplete", out["data"]["reason"])

    def test_stale_snapshot_is_loud_even_when_complete(self):
        files = Files(snap=snapshot([pr(2, 6, 0)], generated=NOW - timedelta(hours=40)))
        try:
            out = self.gate(files)
        finally:
            files.cleanup()
        self.assertTrue(out["wakeAgent"])
        self.assertIn("stale", out["data"]["error"])

    def test_corrupt_why_file_is_loud_not_overwritten(self):
        files = Files([pr(2, 6, 0)], why="{broken")
        try:
            out = self.gate(files)
            with open(files.why, encoding="utf-8") as fh:
                still_there = fh.read()
        finally:
            files.cleanup()
        self.assertTrue(out["wakeAgent"])
        self.assertIn("why file", out["data"]["error"])
        self.assertEqual(still_there, "{broken")

    def test_gate_cli_prints_exactly_one_json_line(self):
        files = Files([pr(2, 6, 0)])
        try:
            rc, out, _ = run_main(["gate", "--rounds", files.rounds, "--why", files.why])
        finally:
            files.cleanup()
        self.assertEqual(rc, 0)
        lines = out.strip().split("\n")
        self.assertEqual(len(lines), 1)
        payload = json.loads(lines[-1])
        self.assertIs(payload["wakeAgent"], True)


class RecordValidationTest(unittest.TestCase):
    def test_valid_record_has_no_problems(self):
        self.assertEqual(ms.validate_record(record(12186)), [])

    def test_caps_are_reported_with_actual_length(self):
        problems = ms.validate_record(record(1, whyShort="x" * 241))
        self.assertTrue(any("whyShort is 241 chars; cap is 240" in p for p in problems), problems)
        problems = ms.validate_record(record(1, whyLong="y" * 1201))
        self.assertTrue(any("whyLong is 1201" in p for p in problems), problems)
        problems = ms.validate_record(record(1, suggestedRule="r" * 301))
        self.assertTrue(any("suggestedRule is 301" in p for p in problems), problems)

    def test_categories_must_come_from_the_set_and_not_repeat(self):
        self.assertTrue(ms.validate_record(record(1, categories=["bikeshedding"])))
        self.assertTrue(ms.validate_record(record(1, categories=[])))
        self.assertTrue(ms.validate_record(record(1, categories=["style_nits", "style_nits"])))
        self.assertEqual(ms.validate_record(record(1, categories=list(ms.CATEGORIES))), [])

    def test_quotes_capped_at_three_and_160_chars(self):
        q = record(1)["quotes"][0]
        self.assertTrue(any("cap is 3" in p for p in ms.validate_record(record(1, quotes=[q, q, q, q]))))
        long_q = dict(q, text="z" * 161)
        self.assertTrue(any("quotes[0].text is 161" in p for p in ms.validate_record(record(1, quotes=[long_q]))))
        self.assertTrue(any("date" in p for p in ms.validate_record(record(1, quotes=[dict(q, date="yesterday")]))))
        self.assertEqual(ms.validate_record(record(1, quotes=[])), [])

    def test_url_must_match_repo_and_number(self):
        problems = ms.validate_record(record(1, url="https://github.com/shader-slang/slang/pull/2"))
        self.assertTrue(any("url must be https://github.com/shader-slang/slang/pull/1" in p for p in problems))
        self.assertTrue(ms.validate_record(record(1, repo="not a repo")))
        self.assertTrue(ms.validate_record(dict(record(1), number=0)))
        self.assertTrue(ms.validate_record(record(1, rounds=-1)))

    def test_single_line_fields(self):
        self.assertTrue(ms.validate_record(record(1, whyShort="two\nlines")))
        self.assertTrue(ms.validate_record(record(1, suggestedRule="two\nlines")))
        self.assertEqual(ms.validate_record(record(1, whyLong="many\nlines\nare fine")), [])


class MergeTest(unittest.TestCase):
    def setUp(self):
        self.files = Files([pr(2, 6, 0)])
        self.new_path = os.path.join(self.files.dir.name, "new.json")

    def tearDown(self):
        self.files.cleanup()

    def write_new(self, value):
        self.files.write(self.new_path, value)

    def merge(self, *extra):
        return run_main(["merge", "--why", self.files.why, "--new", self.new_path, *extra])

    def read_why(self):
        with open(self.files.why, encoding="utf-8") as fh:
            return json.load(fh)

    def test_creates_envelope_newest_first_and_stamps_minedAt(self):
        rec = record(2)
        del rec["minedAt"]
        self.write_new([rec])
        rc, out, err = self.merge()
        self.assertEqual(rc, 0, err)
        doc = self.read_why()
        self.assertEqual(doc["schema"], ms.WHY_SCHEMA)
        self.assertEqual(doc["count"], 1)
        self.assertIsNotNone(ms.parse_iso(doc["records"][0]["minedAt"]))
        self.assertIn("merged 1 record(s) (0 replaced), 1 kept", out)

    def test_same_pr_is_replaced_not_duplicated_and_newest_first(self):
        self.files.write(
            self.files.why,
            {"schema": 1, "records": [record(2, mined_at="2026-09-01T00:00:00Z"), record(9, mined_at="2026-09-05T00:00:00Z")]},
        )
        self.write_new({"records": [record(2, mined_at="2026-09-10T00:00:00Z", whyShort="Updated view.")]})
        rc, out, err = self.merge()
        self.assertEqual(rc, 0, err)
        doc = self.read_why()
        self.assertEqual([(r["number"], r["minedAt"]) for r in doc["records"]], [(2, "2026-09-10T00:00:00Z"), (9, "2026-09-05T00:00:00Z")])
        self.assertEqual(doc["records"][0]["whyShort"], "Updated view.")
        self.assertIn("1 replaced", out)

    def test_keep_cap_drops_the_oldest(self):
        old = [record(n, mined_at=f"2026-08-{n:02d}T00:00:00Z") for n in range(1, 6)]
        self.files.write(self.files.why, old)
        self.write_new(record(6, mined_at="2026-09-01T00:00:00Z"))
        rc, _, err = self.merge("--keep", "3")
        self.assertEqual(rc, 0, err)
        self.assertEqual([r["number"] for r in self.read_why()["records"]], [6, 5, 4])

    def test_invalid_record_refuses_and_leaves_file_untouched(self):
        before = {"schema": 1, "records": [record(9)]}
        self.files.write(self.files.why, before)
        self.write_new([record(2, categories=["nope"]), record(3, whyShort="")])
        rc, _out, err = self.merge()
        self.assertEqual(rc, 2)
        self.assertIn("record[0] shader-slang/slang#2", err)
        self.assertIn("record[1] shader-slang/slang#3", err)
        self.assertIn("nothing was written", err)
        self.assertEqual(self.read_why(), before)

    def test_corrupt_why_file_refuses(self):
        self.files.write(self.files.why, "{broken")
        self.write_new([record(2)])
        rc, _, err = self.merge()
        self.assertEqual(rc, 2)
        self.assertIn("merge refused", err)
        with open(self.files.why, encoding="utf-8") as fh:
            self.assertEqual(fh.read(), "{broken")

    def test_unknown_extra_keys_are_dropped_known_provenance_kept(self):
        self.write_new([record(2, title="Fix #1", authorClass="bot", state="merged", scratch="drop me")])
        rc, _, err = self.merge()
        self.assertEqual(rc, 0, err)
        rec = self.read_why()["records"][0]
        self.assertEqual(rec["title"], "Fix #1")
        self.assertNotIn("scratch", rec)

    def test_no_temp_file_left_behind_and_trailing_newline(self):
        self.write_new([record(2)])
        rc, _, err = self.merge()
        self.assertEqual(rc, 0, err)
        leftovers = [f for f in os.listdir(self.files.dir.name) if f.startswith(".mine-select-")]
        self.assertEqual(leftovers, [])
        with open(self.files.why, encoding="utf-8") as fh:
            self.assertTrue(fh.read().endswith("}\n"))

    def test_merged_record_is_then_excluded_from_selection(self):
        self.write_new([record(2)])
        rc, _, err = self.merge()
        self.assertEqual(rc, 0, err)
        out = ms.gate_payload(ms.selection(self.files.rounds, self.files.why, NOW))
        self.assertFalse(out["wakeAgent"])


class HelpersTest(unittest.TestCase):
    def test_parse_iso_accepts_z_and_offsets(self):
        self.assertEqual(ms.parse_iso("2026-09-10T05:20:00Z"), NOW)
        self.assertEqual(ms.parse_iso("2026-09-10T07:20:00+02:00"), NOW)
        self.assertIsNone(ms.parse_iso("yesterday"))
        self.assertIsNone(ms.parse_iso(None))

    def test_snapshot_status_matrix(self):
        good = snapshot([])
        self.assertEqual(ms.snapshot_status(good, NOW), (None, None))
        self.assertIsNotNone(ms.snapshot_status([], NOW)[0])
        self.assertIsNotNone(ms.snapshot_status(dict(good, schema=2), NOW)[0])
        self.assertIsNotNone(ms.snapshot_status(dict(good, generatedAt="bad"), NOW)[0])
        loud, quiet = ms.snapshot_status(dict(good, complete=False), NOW)
        self.assertIsNone(loud)
        self.assertIn("incomplete", quiet)
        no_perpr = dict(good)
        del no_perpr["perPR"]
        self.assertIn("no perPR", ms.snapshot_status(no_perpr, NOW)[0])


if __name__ == "__main__":
    unittest.main()
