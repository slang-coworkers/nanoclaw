#!/usr/bin/env python3
"""Tests for task-hygiene.py — closed-target GC + re-chase cap for orchestrator tasks.

Each test pins a rule whose regression reproduces a real failure: re-chases
outliving their closed issue (#13230/#13338/#13306), chains on their 15th
re-chase, or — the opposite risk — a core recurring job being cancelled.
Run: python3 test_task_hygiene.py
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("task_hygiene", Path(__file__).with_name("task-hygiene.py"))
th = importlib.util.module_from_spec(spec)
spec.loader.exec_module(th)

NOW = dt.datetime(2026, 10, 15, 12, 0, tzinfo=dt.timezone.utc)


def task(series, prompt, recurrence=None):
    return {"series_id": series, "prompt": prompt, "recurrence": recurrence, "status": "pending"}


def rechase(n, k=None, repo="shader-slang/slang", extra="", sfx="9b92"):
    name = f"rechase-{repo.split('/')[1]}-{n}" + (f"-r{k}" if k else "") + f"-{sfx}"
    return task(name, f"Re-chase gh-issue-{repo}-{n} — ping the maintainer again. {extra}")


class FakeIo:
    def __init__(self, tasks, states, truncate=False):
        self.tasks = tasks
        self.states = states
        self.truncate = truncate
        self.cancelled = []
        self.gets = 0

    def list_tasks(self):
        out = []
        for t in self.tasks:
            p = t["prompt"]
            if self.truncate and len(p) > 120:
                p = p[:117] + "..."
            out.append({**t, "prompt": p})
        return out

    def get_prompt(self, sid):
        self.gets += 1
        return next(t["prompt"] for t in self.tasks if t["series_id"] == sid)

    def cancel(self, sid):
        self.cancelled.append(sid)

    def gh_states(self, refs):
        return {r: self.states.get(r) for r in refs}


class TestRefs(unittest.TestCase):
    def test_thread_id_first(self):
        refs, err = th.parse_refs("Re-chase shader-slang/slang#13230 (thread gh-issue-shader-slang/slang-13230) ...")
        self.assertIsNone(err)
        self.assertEqual(refs, ["shader-slang/slang#13230"])

    def test_hyphenated_repo_thread(self):
        refs, _ = th.parse_refs("Re-check gh-pr-shader-slang/slang-rhi-512 after CI")
        self.assertEqual(refs, ["shader-slang/slang-rhi#512"])

    def test_url_and_bare_ref_resolve_against_chain_repo(self):
        refs, _ = th.parse_refs("Re-chase shader-slang/slangpy#700; PR #712 pending, "
                                "https://github.com/shader-slang/slangpy/pull/712")
        self.assertEqual(refs, ["shader-slang/slangpy#700", "shader-slang/slangpy#712"])

    def test_short_repo_word_ref_is_structured_target(self):
        refs, err = th.parse_refs("Re-chase shader-slang/slang#13230; slangpy PR #712 pending")
        self.assertIsNone(err)
        self.assertEqual(refs, ["shader-slang/slang#13230", "shader-slang/slangpy#712"])
        refs, _ = th.parse_refs("Re-chase shader-slang/slangpy#1167. Upstream slang#13169 closed.")
        self.assertEqual(refs, ["shader-slang/slangpy#1167", "shader-slang/slang#13169"])

    def test_bare_ref_ambiguous_with_other_repo_word(self):
        refs, err = th.parse_refs("Re-chase shader-slang/slang#13230; the slangpy fix #712 is pending")
        self.assertEqual(refs, [])
        self.assertIn("ambiguous", err)

    def test_owner_repo_pr_word_form(self):
        refs, _ = th.parse_refs("SECOND re-chase of shader-slang/slang PR #13471 (draft, fixes #13319)")
        self.assertEqual(refs, ["shader-slang/slang#13471", "shader-slang/slang#13319"])
        refs, _ = th.parse_refs("Re-chase: shader-slang/slang draft PR #13331 (issue #13329)")
        self.assertEqual(refs, ["shader-slang/slang#13331", "shader-slang/slang#13329"])

    def test_ranges_and_short_numbers_are_context(self):
        refs, err = th.parse_refs("Re-chase shader-slang/slang-rhi#881 after #884; main +6: #901-#906, "
                                  "Re-chases #1 and #2 found nothing")
        self.assertIsNone(err)
        self.assertEqual(refs, ["shader-slang/slang-rhi#881", "shader-slang/slang-rhi#884"])

    def test_other_org_refs_are_informational(self):
        refs, err = th.parse_refs("Re-chase shader-slang/slang#13549: llvm/llvm-project#229712 gates the bump; "
                                  "see #11017")
        self.assertIsNone(err)
        self.assertEqual(refs, ["shader-slang/slang#13549", "shader-slang/slang#11017"])

    def test_primary_is_first_shader_slang_ref(self):
        refs, _ = th.parse_refs("Blocked by KhronosGroup/SPIRV-Tools#6000; re-chase shader-slang/slang#13230")
        self.assertEqual(refs, ["shader-slang/slang#13230"])

    def test_fallback_name_number_is_primary(self):
        refs, _ = th.parse_refs("ISSUE #12092 deferred; see #11900", "i12092-scope-guard-7eb8")
        self.assertEqual(refs[0], "shader-slang/slang#12092")
        refs, _ = th.parse_refs("Watch #11900 and ISSUE #12092", "i12092-scope-guard-7eb8")
        self.assertEqual(refs[0], "shader-slang/slang#12092")

    def test_fallback_name_number(self):
        refs, err = th.parse_refs("Re-chase the spirv-tools bump; ask again", "rechase-13230-spirv-tool-9b92")
        self.assertIsNone(err)
        self.assertEqual(refs, ["shader-slang/slang#13230"])

    def test_no_target(self):
        refs, err = th.parse_refs("Re-check the dashboard", "recheck-dashboard-1a2b")
        self.assertEqual(refs, [])
        self.assertTrue(err)

    def test_numeric_segment_in_repo_name(self):
        refs, _ = th.parse_refs("Re-chase gh-issue-acme/slang-2026-tools-13230 now")
        self.assertEqual(refs, ["acme/slang-2026-tools#13230"])

    def test_short_bare_number_ignored(self):
        refs, err = th.parse_refs("Re-chase shader-slang/slang#13230; blocked on PR #77.")
        self.assertIsNone(err)
        self.assertEqual(refs, ["shader-slang/slang#13230"])

    def test_bare_ref_with_second_structured_repo_ambiguous(self):
        refs, err = th.parse_refs("Re-chase shader-slang/slang#13230; shader-slang/slangpy#700 waits on PR #712.")
        self.assertEqual(refs, [])
        self.assertIn("ambiguous", err)
        # Another ORG is informational: #712 is not placed there, and it is not a target.
        refs, err = th.parse_refs("Re-chase shader-slang/slang#13230; NVIDIA/foo PR #712 first.")
        self.assertIsNone(err)
        self.assertEqual(refs, ["shader-slang/slang#13230"])

    def test_ordinal_sources(self):
        self.assertEqual(th.declared_ordinal("rechase-slang-13230-r4-9b92", ""), 4)
        self.assertEqual(th.declared_ordinal("rechase-13230-ab12", "Re-chase x (r7) —"), 7)
        self.assertEqual(th.declared_ordinal("rechase-13230-ab12", "This is the 15th re-chase"), 15)
        self.assertIsNone(th.declared_ordinal("rechase-13230-ab12", "Re-chase shader-slang/slang#13230"))


FIXTURE = Path(__file__).with_name("fixtures") / "task-hygiene-unresolved-2026-10-15.json"


class TestProdFixture(unittest.TestCase):
    """The 73 prod re-chase prompts (first 700 chars) that the first release
    could not resolve (dry-run 2026-10-15: 0 cancels, 73/149 unresolved)."""

    def setUp(self):
        self.tasks = json.loads(FIXTURE.read_text())

    def test_fixture_size(self):
        self.assertEqual(len(self.tasks), 73)

    def test_most_resolve(self):
        resolved = [t for t in self.tasks if th.parse_refs(t["prompt"], t["series_id"])[1] is None]
        self.assertGreaterEqual(len(resolved), 65)

    def test_every_resolved_primary_is_shader_slang(self):
        for t in self.tasks:
            refs, err = th.parse_refs(t["prompt"], t["series_id"])
            if err is None:
                self.assertTrue(refs[0].startswith("shader-slang/"), (t["series_id"], refs))

    def test_rule_labels_are_not_ordinals(self):
        by_id = {t["series_id"]: t for t in self.tasks}
        for sid in ("rechase-13596-r6-gate-f5e7", "rechase-13600-r10-pr-rep-9fef"):
            self.assertIsNone(th.declared_ordinal(sid, by_id[sid]["prompt"]), sid)
        self.assertEqual(th.declared_ordinal("rechase-13406-r7-c566", by_id["rechase-13406-r7-c566"]["prompt"]), 7)
        self.assertEqual(th.declared_ordinal("rechase-9078-jhelferty-242d",
                                             by_id["rechase-9078-jhelferty-242d"]["prompt"]), 4)

    def test_closed_primary_with_open_dependency_kept(self):
        by_id = {t["series_id"]: t for t in self.tasks}
        t = {**by_id["rechase-slang-12621-d2a6"], "recurrence": None}
        refs, _ = th.parse_refs(t["prompt"], t["series_id"])
        gh = dict.fromkeys(refs, "CLOSED")
        gh["shader-slang/slang#12677"] = "OPEN"  # fix PR still open when the issue was closed
        p = th.plan([t], gh, th.empty_state(), NOW)
        self.assertEqual(p["cancel"], [])


class TestAllowPattern(unittest.TestCase):
    def test_rechase_and_watch_shapes(self):
        self.assertEqual(th.task_kind(rechase(13230)), "rechase")
        self.assertEqual(th.task_kind(task("task-1783-abc", "Re-check shader-slang/slang#1 later")), "rechase")
        self.assertEqual(th.task_kind(task("i13435-maintainer-gate-1a2b", "x", "0 * * * *")), "watch")
        self.assertEqual(th.task_kind(task("watch-13261-dep-1a2b", "x", "0 * * * *")), "watch")

    def test_core_jobs_never_allowed(self):
        core = [
            task("supervise-issues-1a2b", "/supervise-issues", "0 */12 * * *"),
            task("okf-memory-synthesis-177d", "Synthesize memory for shader-slang/slang#13230", "0 3 * * *"),
            task("worktree-gc-1a2b", "worktree gc", "7 * * * *"),
            task("task-1783328238990-qikxwn", "Scheduler watchdog — re-arm stalled tasks", "0 */6 * * *"),
            task("slang-pr-report-committe-83e0", "Release report for shader-slang/slang#13230", "0 9 * * 1"),
            task("kb-sync-1a2b", "KB sync nightly", "0 2 * * *"),
            task("task-hygiene-1a2b", "Re-chase hygiene gate", "23 * * * *"),
            task("heartbeat-1a2b", "Heartbeat wake", "*/5 * * * *"),
        ]
        for t in core:
            self.assertIsNone(th.task_kind(t), t["series_id"])

    def test_core_prompt_with_structured_ref_not_allowed(self):
        t = task("task-1783328238990-qikxwn", "Re-check nightly release report for shader-slang/slang#13230",
                 "0 9 * * *")
        self.assertIsNone(th.task_kind(t))
        # Whole words only: "reporter" is not the report job.
        self.assertEqual(th.task_kind(rechase(13230, extra="")), "rechase")
        self.assertEqual(th.task_kind(task("rechase-13230-ab12",
                                           "Re-chase shader-slang/slang#13230: ask the reporter")), "rechase")

    def test_fallback_honours_explicit_owner_repo(self):
        refs, err = th.parse_refs("Re-check NVIDIA/foo PR #712", "recheck-712-abcd")
        self.assertIsNone(err)
        self.assertEqual(refs, ["nvidia/foo#712"])
        refs, err = th.parse_refs("Re-check NVIDIA/foo and acme/bar #712", "recheck-712-abcd")
        self.assertIn("ambiguous", err)


class TestPlanClosed(unittest.TestCase):
    def test_closed_issue_cancelled(self):
        st = th.empty_state()
        p = th.plan([rechase(13230)], {"shader-slang/slang#13230": "CLOSED"}, st, NOW)
        self.assertEqual([c["series_id"] for c in p["cancel"]], ["rechase-slang-13230-9b92"])
        self.assertEqual(p["cancel"][0]["reason"], "closed")

    def test_merged_pr_cancelled(self):
        t = task("recheck-pr-1a2b", "Re-check gh-pr-shader-slang/slang-13251 CI")
        p = th.plan([t], {"shader-slang/slang#13251": "MERGED"}, th.empty_state(), NOW)
        self.assertEqual(len(p["cancel"]), 1)

    def test_open_issue_kept(self):
        p = th.plan([rechase(13300)], {"shader-slang/slang#13300": "OPEN"}, th.empty_state(), NOW)
        self.assertEqual(p["cancel"], [])
        self.assertEqual(len(p["keep"]), 1)

    def test_multi_ref_partially_open_kept(self):
        t = rechase(13230, extra="Blocked on PR #13251.")
        p = th.plan([t], {"shader-slang/slang#13230": "CLOSED", "shader-slang/slang#13251": "OPEN"},
                    th.empty_state(), NOW)
        self.assertEqual(p["cancel"], [])

    def test_multi_ref_all_closed_cancelled(self):
        t = rechase(13230, extra="Blocked on PR #13251.")
        p = th.plan([t], {"shader-slang/slang#13230": "CLOSED", "shader-slang/slang#13251": "MERGED"},
                    th.empty_state(), NOW)
        self.assertEqual(len(p["cancel"]), 1)

    def test_unknown_state_kept(self):
        p = th.plan([rechase(13230)], {"shader-slang/slang#13230": None}, th.empty_state(), NOW)
        self.assertEqual(p["cancel"], [])
        self.assertEqual(len(p["unresolved"]), 1)

    def test_closed_recurring_watch_cancelled(self):
        t = task("i13435-maintainer-gate-1a2b", "Watch shader-slang/slang#13435 for the gate", "0 */6 * * *")
        p = th.plan([t], {"shader-slang/slang#13435": "CLOSED"}, th.empty_state(), NOW)
        self.assertEqual(len(p["cancel"]), 1)

    def test_core_job_never_touched_even_if_target_closed(self):
        t = task("okf-memory-synthesis-177d", "Re-check shader-slang/slang#13230 notes", "0 3 * * *")
        p = th.plan([t], {"shader-slang/slang#13230": "CLOSED"}, th.empty_state(), NOW)
        self.assertEqual(p["cancel"] + p["keep"] + p["unresolved"], [])


class TestCap(unittest.TestCase):
    def test_declared_over_cap_cancelled_and_parked(self):
        st = th.empty_state()
        p = th.plan([rechase(13306, k=4)], {"shader-slang/slang#13306": "OPEN"}, st, NOW)
        self.assertEqual([c["reason"] for c in p["cancel"]], ["cap"])
        self.assertIn("shader-slang/slang#13306", st["parked"])
        self.assertTrue(p["digest_due"])
        self.assertEqual(p["parked"][0]["thread_id"], "gh-issue-shader-slang/slang-13306")

    def test_within_cap_kept(self):
        st = th.empty_state()
        p = th.plan([rechase(13306, k=3)], {"shader-slang/slang#13306": "OPEN"}, st, NOW)
        self.assertEqual(p["cancel"], [])
        self.assertEqual(st["parked"], {})

    def test_undeclared_series_counted_durably(self):
        st = th.empty_state()
        gh = {"shader-slang/slang#13306": "OPEN"}
        for i, sfx in enumerate(["aaaa", "bbbb", "cccc"]):
            p = th.plan([rechase(13306, sfx=sfx)], gh, st, NOW)
            self.assertEqual(p["cancel"], [], i)
        p = th.plan([rechase(13306, sfx="dddd")], gh, st, NOW)
        self.assertEqual([c["reason"] for c in p["cancel"]], ["cap"])
        # Seen again next hour: the same ordinal, still over cap — not re-counted.
        p = th.plan([rechase(13306, sfx="dddd")], gh, st, NOW)
        self.assertEqual(st["ordinals"]["rechase-slang-13306-dddd"], 4)

    def test_closed_beats_cap(self):
        st = th.empty_state()
        p = th.plan([rechase(13306, k=9)], {"shader-slang/slang#13306": "CLOSED"}, st, NOW)
        self.assertEqual([c["reason"] for c in p["cancel"]], ["closed"])
        self.assertEqual(st["parked"], {})

    def test_next_refuses_at_cap(self):
        st = th.empty_state()
        th.plan([rechase(13306, k=3)], {"shader-slang/slang#13306": "OPEN"}, st, NOW)
        res = th.next_rechase("gh-issue-shader-slang/slang-13306", st, [])
        self.assertFalse(res["allowed"])
        self.assertEqual(res["count"], 3)

    def test_next_reserves_so_fast_firing_rechases_count(self):
        st = th.empty_state()
        names = [th.next_rechase("shader-slang/slang#13306", st, [], reserve=True) for _ in range(4)]
        self.assertEqual([n["allowed"] for n in names], [True, True, True, False])
        self.assertEqual(names[2]["name"], "rechase-slang-13306-r3")

    def test_multi_ref_task_keeps_chain_history(self):
        st = th.empty_state()
        gh = {"shader-slang/slang#13230": "OPEN", "shader-slang/slang#14000": "OPEN"}
        b = task("rechase-slang-13230-r3-bbbb",
                 "Re-chase shader-slang/slang#13230; blocked on shader-slang/slang#14000")
        th.plan([b], gh, st, NOW)
        gh["shader-slang/slang#13230"] = "CLOSED"
        a = task("rechase-slang-13230-aaaa", "Re-chase shader-slang/slang#13230 again")
        th.plan([a, b], gh, st, NOW)
        self.assertEqual(st["chains"]["shader-slang/slang#13230"]["max_ordinal"], 3)
        # Same when B's prompt failed to hydrate this fire (absent from the plan).
        th.plan([a], gh, st, NOW)
        self.assertEqual(st["chains"]["shader-slang/slang#13230"]["max_ordinal"], 3)

    def test_next_names_structured(self):
        st = th.empty_state()
        res = th.next_rechase("shader-slang/slang-rhi#77", st, [rechase(77, k=1, repo="shader-slang/slang-rhi")])
        self.assertTrue(res["allowed"])
        self.assertEqual(res["name"], "rechase-slang-rhi-77-r2")
        self.assertTrue(res["prompt_prefix"].startswith("Re-chase gh-issue-shader-slang/slang-rhi-77 (r2)"))
        refs, _ = th.parse_refs(res["prompt_prefix"], res["name"])
        self.assertEqual(refs, ["shader-slang/slang-rhi#77"])
        self.assertEqual(th.declared_ordinal(res["name"], res["prompt_prefix"]), 2)

    def test_parked_chain_leaves_digest_when_closed(self):
        st = th.empty_state()
        th.plan([rechase(13306, k=5)], {"shader-slang/slang#13306": "OPEN"}, st, NOW)
        p = th.plan([], {"shader-slang/slang#13306": "CLOSED"}, st, NOW)
        self.assertEqual(p["unparked"], ["shader-slang/slang#13306"])
        self.assertEqual(st["parked"], {})
        # The count survives (never pruned): reopening does not grant a fresh allowance.
        self.assertEqual(st["chains"]["shader-slang/slang#13306"]["max_ordinal"], 5)

    def test_digest_weekly(self):
        st = th.empty_state()
        st["last_digest_at"] = th.iso(NOW - dt.timedelta(days=3))
        p = th.plan([rechase(13306, k=5)], {"shader-slang/slang#13306": "OPEN"}, st, NOW)
        self.assertFalse(p["digest_due"])
        st["last_digest_at"] = th.iso(NOW - dt.timedelta(days=7))
        p = th.plan([], {"shader-slang/slang#13306": "OPEN"}, st, NOW)
        self.assertTrue(p["digest_due"])


class TestRunOnce(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        th.STATE_PATH = os.path.join(self.tmp.name, ".task-hygiene", "state.json")
        th.REPORT_PATH = os.path.join(self.tmp.name, "reports", "parked-chains.md")

    def tearDown(self):
        self.tmp.cleanup()

    def test_end_to_end_gate(self):
        long = " ".join(["context"] * 40)
        tasks = [
            rechase(13230, extra=long),
            rechase(13300, extra=long),
            rechase(13306, k=4, extra=long),
            task("supervise-issues-1a2b", "/supervise-issues", "0 */12 * * *"),
        ]
        io = FakeIo(tasks, {"shader-slang/slang#13230": "CLOSED", "shader-slang/slang#13300": "OPEN",
                            "shader-slang/slang#13306": "OPEN"}, truncate=True)
        st = th.empty_state()
        res = th.run_once(io, st, NOW)
        self.assertEqual(sorted(io.cancelled), ["rechase-slang-13230-9b92", "rechase-slang-13306-r4-9b92"])
        self.assertEqual(io.gets, 3)  # only allow-listed, truncated prompts fetched
        th.write_outputs(res, st, NOW, th.MAX_RECHASES)
        gate = th.gate_json(res)
        self.assertTrue(gate["wakeAgent"])  # first digest is due
        self.assertEqual(len(gate["data"]["digest"]), 1)
        report = Path(th.REPORT_PATH).read_text()
        self.assertIn("gh-issue-shader-slang/slang-13306", report)
        hist = Path(th.STATE_PATH).with_name("history.log").read_text()
        self.assertIn("cancel rechase-slang-13230-9b92 reason=closed", hist)

        # Next hour: prompt cache hit, digest not due again, nothing re-cancelled.
        io2 = FakeIo([t for t in tasks if t["series_id"] == "rechase-slang-13300-9b92"],
                     io.states, truncate=True)
        st2 = th.load_state()
        res2 = th.run_once(io2, st2, NOW + dt.timedelta(hours=1))
        self.assertEqual(io2.gets, 0)
        self.assertEqual(io2.cancelled, [])
        self.assertFalse(th.gate_json(res2)["wakeAgent"])

    def test_dry_run_changes_nothing(self):
        io = FakeIo([rechase(13230)], {"shader-slang/slang#13230": "CLOSED"})
        st = th.empty_state()
        res = th.run_once(io, st, NOW, dry=True)
        self.assertEqual(io.cancelled, [])
        self.assertEqual(len(res["cancel"]), 1)
        self.assertIsNone(st["last_digest_at"])

    def test_budget_defers_fetches(self):
        long = " ".join(["context"] * 40)
        io = FakeIo([rechase(13230, extra=long)], {"shader-slang/slang#13230": "CLOSED"}, truncate=True)
        res = th.run_once(io, th.empty_state(), NOW, budget_s=-1)
        self.assertEqual(res["deferred"], 1)
        self.assertEqual(io.cancelled, [])

    def test_cached_prompt_reverified_before_cancel(self):
        head = "Re-chase shader-slang/slang#13230. " + "context " * 20
        t = task("rechase-slang-13230-9b92", head + "Wait for shader-slang/slang#13251.")
        gh = {"shader-slang/slang#13230": "OPEN", "shader-slang/slang#13251": "OPEN",
              "shader-slang/slang#14000": "OPEN"}
        io = FakeIo([t], gh, truncate=True)
        st = th.empty_state()
        th.run_once(io, st, NOW)  # caches the full prompt
        t["prompt"] = head + "Wait for shader-slang/slang#14000."  # update --prompt, same listed prefix
        gh["shader-slang/slang#13230"] = gh["shader-slang/slang#13251"] = "CLOSED"
        res = th.run_once(io, st, NOW)
        self.assertEqual(io.cancelled, [])
        self.assertEqual(res["deferred"], 1)
        res = th.run_once(io, st, NOW)  # re-planned on the fresh prompt: #14000 open
        self.assertEqual(io.cancelled, [])
        self.assertEqual(res["cancel"], [])

    def test_corrupt_state_raises(self):
        os.makedirs(os.path.dirname(th.STATE_PATH))
        Path(th.STATE_PATH).write_text('{"version":1,"chains":')
        with self.assertRaises(ValueError):
            th.load_state()

    def test_state_roundtrip(self):
        st = th.empty_state()
        st["parked"]["x"] = {"a": 1}
        th.save_state(st)
        self.assertEqual(th.load_state()["parked"], {"x": {"a": 1}})
        self.assertEqual(json.loads(Path(th.STATE_PATH).read_text())["version"], 1)


if __name__ == "__main__":
    unittest.main()
