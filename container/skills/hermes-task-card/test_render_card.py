"""Unit tests for render_card.py (stdlib unittest, no third-party deps).

Run:
  python3 -m unittest discover -s container/skills/hermes-task-card -p 'test_*.py' -v
"""

import importlib.util
import json
import os
import struct
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "render_card.py")
CARD_SH = os.path.join(HERE, "card.sh")
EXAMPLE = os.path.join(HERE, "examples", "tester-fail.json")

_spec = importlib.util.spec_from_file_location("render_card", SCRIPT)
render_card = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(render_card)


def example_payload():
    with open(EXAMPLE, encoding="utf-8") as fh:
        return json.load(fh)


class NormalizeTest(unittest.TestCase):
    def test_example_payload_normalises(self):
        norm = render_card.normalize(example_payload())
        self.assertEqual(norm["row"], "LOOP-F35")
        self.assertEqual(norm["role"], "hermes-tester")
        self.assertEqual(norm["outcome"], "FAIL")
        self.assertEqual(norm["state"], "bad")
        self.assertEqual(norm["round"], 2)
        self.assertEqual(render_card.file_stem(norm), "card-hermes-tester-fail-r2")
        self.assertEqual(norm["meta"]["sha"], "e117c1c")

    def test_every_role_outcome_has_a_colour(self):
        for role, outcomes in render_card.ROLE_OUTCOMES.items():
            for outcome in outcomes:
                norm = render_card.normalize({"row": "R-1", "role": role, "outcome": outcome})
                self.assertIn(norm["state"], ("ok", "bad", "run"), f"{role}/{outcome}")
        self.assertEqual(render_card.OUTCOME_STATE["ESCALATE"], "run")
        self.assertEqual(render_card.OUTCOME_STATE["DISPATCHED"], "run")
        self.assertEqual(render_card.OUTCOME_STATE["REQUEST_CHANGES"], "bad")
        self.assertEqual(render_card.OUTCOME_STATE["HANDOFF"], "ok")

    def test_role_aliases(self):
        self.assertEqual(render_card.normalize({"row": "R", "role": "tester", "outcome": "PASS"})["role"], "hermes-tester")
        self.assertEqual(render_card.normalize({"row": "R", "role": "main", "outcome": "MERGED"})["role"], "orchestrator")
        self.assertEqual(
            render_card.normalize({"row": "R", "role": "Hermes-Reviewer", "outcome": "approve"})["outcome"], "APPROVE"
        )

    def test_outcome_must_match_role(self):
        with self.assertRaises(render_card.PayloadError):
            render_card.normalize({"row": "R", "role": "hermes-tester", "outcome": "APPROVE"})
        with self.assertRaises(render_card.PayloadError):
            render_card.normalize({"row": "R", "role": "hermes-builder", "outcome": "PASS"})

    def test_required_fields(self):
        for bad in ({}, {"role": "hermes-tester", "outcome": "PASS"}, {"row": "R", "outcome": "PASS"},
                    {"row": "R", "role": "hermes-tester"}, {"row": "R", "role": "someone", "outcome": "PASS"}, [], "x"):
            with self.subTest(bad=bad), self.assertRaises(render_card.PayloadError):
                render_card.normalize(bad)

    def test_length_truncates_never_rejects(self):
        long = "x" * 500
        norm = render_card.normalize(
            {
                "row": long, "role": "hermes-builder", "outcome": "SHIPPED", "round": "7",
                "headline": long,
                "what": [long] * 9, "evidence": [long] * 9, "next": [long] * 9,
                "meta": {"elapsed": long, "cost": long, "pr_url": long, "report": long, "sha": long},
            }
        )
        self.assertEqual(len(norm["row"]), render_card.MAX_ROW)
        self.assertTrue(norm["row"].endswith("…"))
        self.assertEqual(len(norm["headline"]), 90)
        self.assertTrue(norm["headline"].endswith("…"))
        self.assertEqual(len(norm["what"]), 4)
        self.assertEqual(len(norm["evidence"]), 4)
        self.assertEqual(len(norm["next"]), 2)
        for item in norm["what"] + norm["evidence"] + norm["next"]:
            self.assertLessEqual(len(item), 90)
        self.assertEqual(norm["round"], 7)
        self.assertLessEqual(len(norm["meta"]["pr_url"]), 200)

    def test_junk_values_are_coerced(self):
        norm = render_card.normalize(
            {"row": 12, "role": "hermes-architect", "outcome": "HANDOFF", "round": "nope",
             "headline": {"a": 1}, "what": "a single string", "evidence": None, "next": [None, 3],
             "meta": "not-a-dict"}
        )
        self.assertEqual(norm["row"], "12")
        self.assertEqual(norm["round"], 1)
        self.assertEqual(norm["what"], ["a single string"])
        self.assertEqual(norm["evidence"], [])
        self.assertEqual(norm["next"], ["3"])
        self.assertEqual(norm["meta"]["cost"], "n/a")

    def test_cost_defaults_to_na(self):
        norm = render_card.normalize({"row": "R", "role": "hermes-tester", "outcome": "PASS", "meta": {}})
        self.assertEqual(norm["meta"]["cost"], "n/a")


class RenderHtmlTest(unittest.TestCase):
    def setUp(self):
        self.norm = render_card.normalize(example_payload())
        self.html = render_card.render_html(self.norm, "hermes-LOOP-F35")

    def test_exactly_four_cards_with_the_contract_titles(self):
        self.assertEqual(self.html.count('<div class="card">'), 4)
        for title in ("Verdict", "What changed", "Evidence", "Next + meta"):
            self.assertIn(f"<h2>{title}</h2>", self.html)

    def test_title_subtitle_headline(self):
        self.assertIn("<h1>LOOP-F35 · hermes-tester</h1>", self.html)
        self.assertIn("round 2 · hermes-LOOP-F35 · e117c1c", self.html)
        self.assertIn("T7 loop-detection row fails", self.html)

    def test_header_chip_rowid_badge_and_fixed_size_css(self):
        self.assertIn('<span class="chip">tester</span>', self.html)
        self.assertIn('<span class="rowid">LOOP-F35</span>', self.html)
        self.assertIn('<span class="badge bad">FAIL</span>', self.html)
        self.assertIn("width:900px;height:600px;overflow:hidden", self.html)
        # the override block lands inside the single <style> element, after the vendored CSS
        self.assertEqual(self.html.count("<style>"), 1)
        self.assertLess(self.html.index(":root{"), self.html.index("task-card overrides"))
        self.assertLess(self.html.index("task-card overrides"), self.html.index("</style>"))

    def test_verdict_card_is_metric_plus_one_dot_row(self):
        self.assertIn('<div class="big v-bad">FAIL', self.html)  # v-bad: not the vendored .bad dot class
        self.assertEqual(self.html.count('class="dot bad"'), 1)
        # "next" rows carry the todo dot; what/evidence rows carry none
        self.assertEqual(self.html.count('class="dot todo"'), 2)

    def test_meta_rows(self):
        for needle in ("elapsed", "2h04m", "cost", "n/a", ">PR<", "slang-coworkers/hermes-agent#212"):
            self.assertIn(needle, self.html)
        self.assertIn("reports/hermes-LOOP-F35/test-report-e117c1c.md", self.html)  # footer

    def test_subtitle_falls_back_to_pr_when_no_sha(self):
        payload = example_payload()
        payload["meta"]["sha"] = ""
        html = render_card.render_html(render_card.normalize(payload), "hermes-LOOP-F35")
        self.assertIn("round 2 · hermes-LOOP-F35 · slang-coworkers/hermes-agent#212", html)

    def test_empty_lists_render_placeholder_rows_not_blank_cards(self):
        norm = render_card.normalize({"row": "R-9", "role": "orchestrator", "outcome": "DISPATCHED"})
        html = render_card.render_html(norm, "hermes-R-9")
        self.assertEqual(html.count('<div class="card">'), 4)
        self.assertIn("none reported", html)
        self.assertIn('<span class="badge run">DISPATCHED</span>', html)
        self.assertIn("orchestrator reports DISPATCHED on R-9.", html)

    def test_everything_is_escaped(self):
        hostile = '<script>alert("x")</script>'
        norm = render_card.normalize(
            {"row": hostile, "role": "hermes-tester", "outcome": "PASS", "headline": hostile,
             "what": [hostile], "evidence": [hostile], "next": [hostile],
             "meta": {"elapsed": hostile, "pr_url": hostile, "report": hostile, "sha": hostile}}
        )
        html = render_card.render_html(norm, hostile)
        self.assertNotIn("<script", html)
        self.assertIn("&lt;script&gt;", html)


class PngCheckTest(unittest.TestCase):
    def tmp(self, suffix):
        fd, path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
        return path

    def test_synthetic_png_passes(self):
        path = self.tmp(".png")
        render_card.write_fake_png(path)
        ok, reason = render_card.check_png(path)
        self.assertTrue(ok, reason)
        self.assertGreater(os.path.getsize(path), render_card.PNG_MIN_BYTES)

    def test_missing_small_wrong_size_and_non_png_fail(self):
        self.assertFalse(render_card.check_png("/nonexistent/card.png")[0])
        small = self.tmp(".png")
        with open(small, "wb") as fh:
            fh.write(b"\x89PNG\r\n\x1a\n" + b"\0" * 100)
        self.assertIn("too small", render_card.check_png(small)[1])
        wrong = self.tmp(".png")
        render_card.write_fake_png(wrong, 640, 480)
        ok, reason = render_card.check_png(wrong)
        self.assertFalse(ok)
        self.assertIn("640x480", reason)
        notpng = self.tmp(".html")
        with open(notpng, "wb") as fh:
            fh.write(b"<!doctype html>" + b"x" * 10000)
        self.assertIn("not a PNG", render_card.check_png(notpng)[1])

    def test_ihdr_is_read_from_bytes_16_24(self):
        path = self.tmp(".png")
        render_card.write_fake_png(path)
        with open(path, "rb") as fh:
            head = fh.read(24)
        self.assertEqual(struct.unpack(">II", head[16:24]), (900, 600))


class CliTest(unittest.TestCase):
    def setUp(self):
        self.out = tempfile.mkdtemp()
        self.addCleanup(lambda: subprocess.run(["rm", "-rf", self.out], check=False))

    def run_py(self, *args):
        return subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, check=False)

    def test_render_writes_json_and_html_and_prints_stem_role(self):
        proc = self.run_py("render", EXAMPLE, "--thread", "hermes-LOOP-F35", "--out-dir", self.out)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout.splitlines(), ["card-hermes-tester-fail-r2", "hermes-tester"])
        with open(os.path.join(self.out, "card-hermes-tester-fail-r2.json"), encoding="utf-8") as fh:
            saved = json.load(fh)
        self.assertEqual(saved["thread_id"], "hermes-LOOP-F35")
        self.assertEqual(saved["outcome"], "FAIL")
        self.assertTrue(os.path.getsize(os.path.join(self.out, "card-hermes-tester-fail-r2.html")) > 0)

    def test_render_rejects_bad_payload_with_exit_1(self):
        bad = os.path.join(self.out, "bad.json")
        with open(bad, "w", encoding="utf-8") as fh:
            fh.write('{"row":"R","role":"hermes-tester","outcome":"APPROVE"}')
        proc = self.run_py("render", bad, "--thread", "t", "--out-dir", self.out)
        self.assertEqual(proc.returncode, 1)
        self.assertIn("not valid for hermes-tester", proc.stderr)
        proc = self.run_py("render", os.devnull, "--thread", "t", "--out-dir", self.out)
        self.assertEqual(proc.returncode, 1)  # empty -> {} -> role missing

    def test_check_png_exit_codes(self):
        png = os.path.join(self.out, "ok.png")
        self.assertEqual(self.run_py("fake-png", png).returncode, 0)
        self.assertEqual(self.run_py("check-png", png).returncode, 0)
        self.assertEqual(self.run_py("check-png", os.path.join(self.out, "nope.png")).returncode, 3)


class CardShTest(unittest.TestCase):
    """card.sh contract that does not need a browser."""

    def setUp(self):
        self.out = tempfile.mkdtemp()
        self.addCleanup(lambda: subprocess.run(["rm", "-rf", self.out], check=False))
        self.env = {k: v for k, v in os.environ.items() if k != "NANOCLAW_SESSION_THREAD_ID"}

    def run_sh(self, *args, env=None):
        return subprocess.run(["bash", CARD_SH, *args], capture_output=True, text=True, check=False, env=env or self.env)

    def test_no_thread_id_exits_2(self):
        proc = self.run_sh("render", EXAMPLE, "--out-dir", os.path.join(self.out, "x"))
        self.assertEqual(proc.returncode, 2, proc.stderr)
        self.assertIn("thread", proc.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.out, "x")))

    def test_thread_from_env_and_html_always_written(self):
        env = dict(self.env, NANOCLAW_SESSION_THREAD_ID="hermes-LOOP-F35", PATH="/nonexistent-bin:" + self.env.get("PATH", ""))
        # Hide agent-browser (if any) so this test is deterministic: exit 3 + HTML fallback.
        env["PATH"] = os.pathsep.join(p for p in env["PATH"].split(os.pathsep) if not os.path.exists(os.path.join(p, "agent-browser")))
        proc = self.run_sh("render", EXAMPLE, "--out-dir", self.out, env=env)
        self.assertEqual(proc.returncode, 3, proc.stdout + proc.stderr)
        for name in ("card-hermes-tester-fail-r2.json", "card-hermes-tester-fail-r2.html", "card-hermes-tester-latest.html"):
            self.assertTrue(os.path.exists(os.path.join(self.out, name)), name)
        self.assertFalse(os.path.exists(os.path.join(self.out, "card-hermes-tester-latest.png")))
        self.assertIn("HTML=", proc.stdout)
        self.assertNotIn("PNG=", proc.stdout)

    def test_invalid_payload_exits_1(self):
        bad = os.path.join(self.out, "bad.json")
        with open(bad, "w", encoding="utf-8") as fh:
            fh.write('{"row":"R","role":"hermes-reviewer","outcome":"PASS"}')
        proc = self.run_sh("render", bad, "--thread", "t", "--out-dir", self.out)
        self.assertEqual(proc.returncode, 1)

    def test_selftest_passes(self):
        proc = self.run_sh("selftest")
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("selftest: PASS", proc.stdout)


if __name__ == "__main__":
    unittest.main()
