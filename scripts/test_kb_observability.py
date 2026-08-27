#!/usr/bin/env python3
"""Tests for kb-health.py and kb-doctor.py — the two KB observability producers.

Every case here pins a way these tools reported HEALTH while blind. That is the failure
that matters: a monitor that breaks loudly gets fixed, a monitor that breaks quietly gets
believed. Run: python3 test_kb_observability.py
"""

import contextlib
import datetime
import importlib.util
import io
import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


health = load("kb_health", "kb-health.py")
doctor = load("kb_doctor", "kb-doctor.py")


def run_main(mod, argv):
    """(exit_code, stdout, stderr)."""
    out, err = io.StringIO(), io.StringIO()
    old = sys.argv
    sys.argv = argv
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = mod.main()
    finally:
        sys.argv = old
    return code, out.getvalue(), err.getvalue()


def ms_days_ago(n):
    t = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=n)
    return int(t.timestamp() * 1000)


# ── kb-health ────────────────────────────────────────────────────────────────


class TestCitationFilter(unittest.TestCase):
    """The cheap pre-filter must never reject a line the parser could match."""

    def test_admits_is_a_superset_of_the_citation_regex(self):
        # The property, stated directly: anything CITE_RE matches must survive admits().
        samples = [
            "plain text citing wiki/concepts/agent-infra.md in prose",
            "an atom 1754300000000-some-slug.md cited inline",
            '{"type":"text","text":"see [x](wiki/concepts/slang-backends-2.md)"}',
            "1799999999999-a-b-c-d.md",
        ]
        for s in samples:
            with self.subTest(s=s[:40]):
                self.assertTrue(health.CITE_RE.search(s), "fixture must actually be a citation")
                self.assertTrue(health.admits(s), "filter dropped a line the parser matches")

    def test_the_old_filter_would_have_dropped_these(self):
        # Pins WHY this changed: the previous filter required one of three markers, and a
        # prose citation carries none of them.
        old = lambda l: "/workspace/shared" in l or "tool_use_id" in l or "append_learning" in l
        prose = "As established in wiki/concepts/agent-infra.md, the mirror is copied."
        self.assertFalse(old(prose))
        self.assertTrue(health.admits(prose))

    def test_it_still_rejects_lines_with_no_evidence(self):
        # The filter exists for speed; it must not become "admit everything".
        self.assertFalse(health.admits('{"type":"text","text":"just chatting"}'))


class TestScanReadsCountsProseCitations(unittest.TestCase):
    def test_an_assistant_citation_with_no_tool_markers_is_counted(self):
        d = tempfile.mkdtemp()
        p = os.path.join(d, "t.jsonl")
        Path(p).write_text(json.dumps({
            "message": {"role": "assistant", "content": [
                {"type": "text", "text": "See [infra](wiki/concepts/agent-infra.md)."}]}
        }) + "\n")
        _, _, _, _, citing, _, _ = health.scan_reads([p])
        self.assertEqual(len(citing), 1, "prose citation was not counted as evidence of use")


class TestAtomsPerDay(unittest.TestCase):
    def make_learnings(self, day_offsets):
        d = tempfile.mkdtemp()
        for i, off in enumerate(day_offsets):
            Path(d, f"{ms_days_ago(off)}-atom-number-{i}.md").write_text("# a\n")
        return d

    def test_the_denominator_is_the_calendar_window_not_active_days(self):
        # 3 atoms on 3 distinct days inside a 14-day window is 0.2/day. Dividing by the
        # 3 days that happened to be active reported 1.0 — and got *better* the quieter
        # the KB became.
        d = self.make_learnings([1, 5, 9])
        self.assertEqual(health.atom_stats(d)["per_day_14d"], 0.2)
        self.assertEqual(health.atom_stats(d)["atoms_in_14d"], 3)

    def test_atoms_older_than_the_window_are_excluded(self):
        d = self.make_learnings([1, 40, 90])
        s = health.atom_stats(d)
        self.assertEqual(s["atoms_in_14d"], 1)
        self.assertEqual(s["total"], 3)  # total is still every atom ever

    def test_a_silent_fortnight_reads_as_zero_not_as_no_data(self):
        d = self.make_learnings([30, 40])
        self.assertEqual(health.atom_stats(d)["per_day_14d"], 0.0)


class HealthRepo(unittest.TestCase):
    """Builds the minimum tree kb-health needs."""

    def make_repo(self, transcripts=1):
        repo = tempfile.mkdtemp()
        shared = os.path.join(repo, "data", "shared")
        os.makedirs(os.path.join(shared, "learnings"), exist_ok=True)
        os.makedirs(os.path.join(shared, "wiki", "concepts"), exist_ok=True)
        Path(shared, "learnings", f"{ms_days_ago(1)}-an-example-atom.md").write_text("# a\n")
        for i in range(transcripts):
            t = os.path.join(repo, "data", "v2-sessions", f"g{i}",
                             ".claude-shared", "projects", "-workspace-agent")
            os.makedirs(t, exist_ok=True)
            Path(t, "s.jsonl").write_text(json.dumps({
                "message": {"role": "assistant", "content": [
                    {"type": "text", "text": "see wiki/concepts/agent-infra.md"}]}}) + "\n")
        return repo, shared

    def hist(self, shared):
        return json.loads(Path(shared, ".kb-health.json").read_text())


class TestHealthRefusesDegradedInput(HealthRepo):
    def test_a_good_run_records_a_sample(self):
        # Guards the guard: if this failed, the refusal tests below would pass vacuously.
        repo, shared = self.make_repo()
        code, _, _ = run_main(health, ["kb-health.py", "--repo", repo, "--json-only"])
        self.assertEqual(code, 0)
        self.assertEqual(len(self.hist(shared)), 1)
        self.assertTrue(Path(shared, "KB-HEALTH.md").exists())

    def test_zero_transcripts_refuses_to_append_and_exits_nonzero(self):
        # An outage is not a quiet fortnight. The old code warned, then appended a full
        # sample of zeros to the one file that cannot be recomputed.
        repo, shared = self.make_repo(transcripts=0)
        code, _, err = run_main(health, ["kb-health.py", "--repo", repo, "--json-only"])
        self.assertEqual(code, 1)
        self.assertIn("REFUSING", err)
        self.assertFalse(Path(shared, ".kb-health.json").exists())

    def test_zero_transcripts_never_touches_an_existing_history(self):
        repo, shared = self.make_repo(transcripts=0)
        Path(shared, ".kb-health.json").write_text('[{"date": "2026-08-04"}]')
        before = Path(shared, ".kb-health.json").read_text()
        code, _, _ = run_main(health, ["kb-health.py", "--repo", repo, "--json-only"])
        self.assertEqual(code, 1)
        self.assertEqual(Path(shared, ".kb-health.json").read_text(), before)


class TestHealthPreservesCorruptHistory(HealthRepo):
    def test_corrupt_history_is_preserved_and_not_replaced(self):
        # `hist = []` on a parse failure, then a write — one bad read and the whole trend
        # was gone, with nothing left to inspect.
        repo, shared = self.make_repo()
        Path(shared, ".kb-health.json").write_text('[{"date": "2026-08-04"}, {trunca')
        code, _, err = run_main(health, ["kb-health.py", "--repo", repo, "--json-only"])
        self.assertEqual(code, 1)
        self.assertIn("REFUSING", err)
        # original untouched
        self.assertTrue(Path(shared, ".kb-health.json").read_text().endswith("{trunca"))
        # and a copy exists for inspection
        kept = list(Path(shared).glob(".kb-health.json.corrupt.*"))
        self.assertEqual(len(kept), 1)
        self.assertTrue(kept[0].read_text().endswith("{trunca"))

    def test_a_non_list_history_is_also_refused(self):
        repo, shared = self.make_repo()
        Path(shared, ".kb-health.json").write_text('{"not": "a list"}')
        code, _, _ = run_main(health, ["kb-health.py", "--repo", repo, "--json-only"])
        self.assertEqual(code, 1)


class TestHealthWritesAtomically(HealthRepo):
    def test_it_appends_to_existing_history_and_leaves_no_temp_files(self):
        repo, shared = self.make_repo()
        Path(shared, ".kb-health.json").write_text(json.dumps([{"date": "2026-08-04"}]))
        code, _, _ = run_main(health, ["kb-health.py", "--repo", repo, "--json-only"])
        self.assertEqual(code, 0)
        self.assertEqual(len(self.hist(shared)), 2)
        self.assertEqual(self.hist(shared)[0]["date"], "2026-08-04")  # prior point survives
        self.assertEqual([p.name for p in Path(shared).glob("*.tmp")], [])

    def test_write_atomic_replaces_rather_than_truncating(self):
        d = tempfile.mkdtemp()
        p = os.path.join(d, "sub", "x.json")
        health.write_atomic(p, '{"n": 1}')
        health.write_atomic(p, '{"n": 2}')
        self.assertEqual(json.loads(Path(p).read_text()), {"n": 2})
        self.assertEqual(sorted(os.listdir(os.path.dirname(p))), ["x.json"])


class TestHealthPublishesBothDocumentsOrNeither(HealthRepo):
    """The history and the digest describe the same generation and have to agree.

    The history was replaced BEFORE the digest was rendered, so a failure in between
    left a recorded sample with no digest describing it — and the append was
    unconditional, so a retry recorded the same day twice."""

    def run_ok(self, repo):
        return run_main(health, ["kb-health.py", "--repo", repo, "--json-only"])

    def test_a_second_run_the_same_day_replaces_rather_than_appends(self):
        repo, shared = self.make_repo()
        self.assertEqual(self.run_ok(repo)[0], 0)
        self.assertEqual(self.run_ok(repo)[0], 0)
        hist = self.hist(shared)
        self.assertEqual(len(hist), 1)
        self.assertEqual(len({h["date"] for h in hist}), 1)

    def test_a_retry_does_not_make_the_digest_diff_a_sample_against_itself(self):
        # With an unconditional append, `prev` became this morning's run of the same
        # script, so the second run's digest compared today against today and reported
        # a day of flat zeros.
        repo, shared = self.make_repo()
        self.run_ok(repo)
        yesterday = dict(self.hist(shared)[0])
        yesterday["date"] = "1999-01-01"
        Path(shared, ".kb-health.json").write_text(json.dumps([yesterday]))
        self.run_ok(repo)
        self.run_ok(repo)
        hist = self.hist(shared)
        self.assertEqual(next(h["date"] for h in hist), "1999-01-01")
        self.assertEqual(len(hist), 2)

    def test_a_digest_failure_leaves_BOTH_targets_untouched(self):
        repo, shared = self.make_repo()
        self.assertEqual(self.run_ok(repo)[0], 0)
        before_hist = Path(shared, ".kb-health.json").read_text()
        before_md = Path(shared, "KB-HEALTH.md").read_text()

        with mock.patch.object(health, "digest", side_effect=RuntimeError("render blew up")), \
                self.assertRaises(RuntimeError):
            self.run_ok(repo)

        # Pre-fix the history had already been replaced by the time digest ran, so the
        # sample was recorded with no digest describing it and nothing said so.
        self.assertEqual(Path(shared, ".kb-health.json").read_text(), before_hist)
        self.assertEqual(Path(shared, "KB-HEALTH.md").read_text(), before_md)

    def test_an_empty_digest_refuses_rather_than_recording_a_sample_without_one(self):
        repo, shared = self.make_repo()
        self.assertEqual(self.run_ok(repo)[0], 0)
        before_hist = Path(shared, ".kb-health.json").read_text()

        with mock.patch.object(health, "digest", return_value="   \n  "):
            code, _, err = self.run_ok(repo)

        self.assertEqual(code, 1)
        self.assertIn("REFUSING", err)
        self.assertEqual(Path(shared, ".kb-health.json").read_text(), before_hist)


# ── kb-doctor ────────────────────────────────────────────────────────────────


class DoctorRepo(unittest.TestCase):
    def make_repo(self, ncl_script=None, tasks=None, skill_body="print('hi')"):
        repo = tempfile.mkdtemp()
        skill_dir = os.path.join(repo, "container", "skills", "learnings-wiki")
        os.makedirs(skill_dir, exist_ok=True)
        Path(skill_dir, "SKILL.md").write_text(f"# skill\n\n```python\n{skill_body}\n```\n")
        os.makedirs(os.path.join(repo, "data", "shared"), exist_ok=True)
        Path(repo, "data", "shared", ".learnings_wiki.py").write_text(skill_body + "\n")
        if tasks is not None:
            os.makedirs(os.path.join(repo, "docs"), exist_ok=True)
            Path(repo, "docs", "scheduled-tasks.test.json").write_text(
                json.dumps({"instance": "test", "task_count": len(tasks), "tasks": tasks}))
        if ncl_script is not None:
            os.makedirs(os.path.join(repo, "bin"), exist_ok=True)
            p = Path(repo, "bin", "ncl")
            p.write_text(ncl_script)
            p.chmod(p.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        return repo

    def run_doctor(self, repo, extra=()):
        art = os.path.join(tempfile.mkdtemp(), "nested", ".kb-doctor.json")
        code, out, err = run_main(doctor, ["kb-doctor.py", "--repo", repo, "--artifact", art, *extra])
        doc = json.loads(Path(art).read_text()) if os.path.exists(art) else None
        return code, doc, out, err

    def checks(self, doc):
        return {f["check"]: f["state"] for f in doc["findings"]}


TASK = {"series_id": "daily-synth", "prompt": "fold the wiki", "recurrence": "0 5 * * *",
        "agent_group_id": "kb"}


def ncl_emitting(payload, exit_code=0, to_stderr=False):
    stream = "2" if to_stderr else "1"
    return f"#!/bin/sh\ncat >&{stream} <<'EOF'\n{payload}\nEOF\nexit {exit_code}\n"


class TestDoctorUnknownIsNotClean(DoctorRepo):
    def test_an_empty_repo_is_unknown_not_clean(self):
        # Every check used to SKIP and exit 0 — a bill of health from a tool that ran
        # nothing at all.
        code, doc, _, _ = self.run_doctor(tempfile.mkdtemp())
        self.assertEqual(code, 2)
        self.assertEqual(doc["status"], "unknown")
        self.assertFalse(doc["complete"])
        self.assertEqual(doc["counts"]["drift"], 0)
        self.assertEqual(doc["counts"]["ok"], 0)

    def test_every_check_reports_something(self):
        # group-skills and branch used to `return` with NO finding, vanishing silently.
        _, doc, _, _ = self.run_doctor(tempfile.mkdtemp())
        self.assertEqual(set(self.checks(doc)), {"builder", "group-skills", "tasks", "branch"})

    def test_unknown_findings_retain_the_underlying_error(self):
        _, doc, _, _ = self.run_doctor(tempfile.mkdtemp())
        builder = next(f for f in doc["findings"] if f["check"] == "builder")
        self.assertEqual(builder["reason"], "missing-input")
        self.assertIn("SKILL.md", builder["message"])

    def test_quiet_still_emits_a_summary(self):
        # `--quiet` emitting zero bytes is indistinguishable from the script dying.
        _, _, out, _ = self.run_doctor(tempfile.mkdtemp(), extra=("--quiet",))
        self.assertIn("kb-doctor:", out)
        self.assertGreater(len(out), 0)


class TestDoctorNclClassification(DoctorRepo):
    def test_a_broken_toolchain_is_unknown_not_thirteen_deleted_tasks(self):
        # THE regression, found by this suite against the real bin/ncl: the wrapper exits
        # 127 with `exec: pnpm: not found`, and a free-text not-found match reported a
        # broken PATH as committed tasks having been deleted from production.
        repo = self.make_repo(ncl_script="#!/bin/sh\necho 'ncl: line 27: exec: pnpm: not found' >&2\nexit 127\n",
                              tasks=[TASK])
        code, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "UNKNOWN")
        self.assertEqual(doc["counts"]["drift"], 0)
        # The real cause must survive into the report, not be replaced by a guess.
        tasks_unknown = [u for u in doc["unknown"] if u.startswith("tasks:")]
        self.assertEqual(len(tasks_unknown), 1)
        self.assertIn("pnpm", tasks_unknown[0])
        self.assertEqual(code, 2)

    def test_a_structured_not_found_is_real_drift(self):
        payload = json.dumps({"ok": False, "error": {"code": "handler-error",
                                                     "message": "tasks not found: daily-synth"}})
        repo = self.make_repo(ncl_script=ncl_emitting(payload, exit_code=1), tasks=[TASK])
        code, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "DRIFT")
        self.assertIn("not live", doc["drift"][0])
        self.assertEqual(code, 1)

    def test_a_permission_error_is_unknown_not_missing(self):
        # 'forbidden' says nothing about whether the task exists.
        payload = json.dumps({"ok": False, "error": {"code": "forbidden", "message": "nope"}})
        repo = self.make_repo(ncl_script=ncl_emitting(payload, exit_code=1), tasks=[TASK])
        _, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "UNKNOWN")
        self.assertEqual(doc["counts"]["drift"], 0)


class TestDoctorComparesFullDefinition(DoctorRepo):
    def live(self, **over):
        d = dict(TASK, **over)
        return ncl_emitting(json.dumps({"ok": True, "data": d}))

    def test_matching_definitions_are_ok(self):
        repo = self.make_repo(ncl_script=self.live(), tasks=[TASK])
        _, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "OK")

    def test_a_changed_schedule_is_drift_even_when_the_prompt_matches(self):
        # Prompt-only comparison called this a match. A task silently rescheduled is
        # exactly the drift this tool exists to catch.
        repo = self.make_repo(ncl_script=self.live(recurrence="0 23 * * 0"), tasks=[TASK])
        code, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "DRIFT")
        self.assertIn("recurrence", doc["drift"][0])
        self.assertEqual(code, 1)

    def test_a_changed_prompt_is_still_drift(self):
        repo = self.make_repo(ncl_script=self.live(prompt="something else"), tasks=[TASK])
        _, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "DRIFT")
        self.assertIn("prompt", doc["drift"][0])

    def test_volatile_runtime_fields_are_not_drift(self):
        # Imported from dump-scheduled-tasks.py, so the doctor cannot disagree with the
        # dumper about what counts as a definition.
        repo = self.make_repo(ncl_script=self.live(tries=7, completed_runs=99), tasks=[TASK])
        _, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "OK")

    def test_volatile_set_is_imported_not_copied(self):
        fields, err = doctor.volatile_fields()
        self.assertIsNone(err)
        self.assertIn("tries", fields)
        self.assertIn("process_after", fields)


class TestDoctorVolatileSetIsNeverSilentlyStale(DoctorRepo):
    """The exclusion set decides what "identical" MEANS, so a doubt about it is a doubt
    about every comparison built on it.

    `volatile_fields()` caught every import error and returned the in-file copy with no
    signal. A field the dumper had stopped excluding would then be ignored by the stale
    copy, no difference would be found, and the doctor would certify a clean result it
    had no basis for — the exact "unknown is treated as clean" failure it exists to
    refuse."""

    def live(self, **over):
        return ncl_emitting(json.dumps({"ok": True, "data": dict(TASK, **over)}))

    def broken_import(self):
        return mock.patch.object(doctor.importlib.util, "spec_from_file_location",
                                 side_effect=ImportError("dumper moved"))

    def test_volatile_fields_returns_the_error_instead_of_swallowing_it(self):
        with self.broken_import():
            fields, err = doctor.volatile_fields()
        self.assertIn("dumper moved", err)
        self.assertEqual(fields, set(doctor.VOLATILE_FALLBACK))

    def test_a_broken_import_is_UNKNOWN_not_a_clean_pass(self):
        # Pre-fix: tasks=OK, exit 0 — a bill of health from a comparison whose own
        # ruleset could not be verified.
        repo = self.make_repo(ncl_script=self.live(tries=7, completed_runs=99), tasks=[TASK])
        with self.broken_import():
            _, doc, _, _ = self.run_doctor(repo)
        checks = self.checks(doc)
        # Asserted FIRST and on a key that exists on both trees, so the pre-fix run
        # fails with 'OK' != 'UNKNOWN' — the false clean itself — rather than dying on
        # a KeyError for a check the old code never emitted. Absence of a new key is a
        # weaker claim than the wrong verdict.
        self.assertEqual(checks["tasks"], "UNKNOWN")
        self.assertEqual(checks["tasks-volatile-set"], "UNKNOWN")
        # The exit code is NOT load-bearing here: other checks in this minimal fixture
        # are already UNKNOWN, so `code == 2` would hold either way and prove nothing.

    def test_a_broken_import_still_surfaces_real_drift(self):
        # Degraded is not useless. A difference found under the fallback is still a
        # difference, and DRIFT outranks UNKNOWN because it is actionable now.
        repo = self.make_repo(ncl_script=self.live(prompt="quietly rewritten"), tasks=[TASK])
        with self.broken_import():
            code, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks"], "DRIFT")
        self.assertEqual(code, 1)

    def test_a_fallback_that_has_drifted_from_the_dumper_is_reported(self):
        # The fallback claims to be "kept in sync by IMPORTING it". Nothing enforced
        # that, so it could rot unnoticed until the day an import failed and it became
        # load-bearing. Divergence between two copies of one list in one repo is drift.
        repo = self.make_repo(ncl_script=self.live(tries=7), tasks=[TASK])
        with mock.patch.object(doctor, "VOLATILE_FALLBACK", {"row_id"}):
            code, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["tasks-volatile-set"], "DRIFT")
        self.assertEqual(code, 1)

    def test_an_in_sync_fallback_says_nothing(self):
        # The check must be silent on the happy path or it trains people to ignore it.
        repo = self.make_repo(ncl_script=self.live(tries=7), tasks=[TASK])
        _, doc, _, _ = self.run_doctor(repo)
        self.assertNotIn("tasks-volatile-set", self.checks(doc))
        self.assertEqual(self.checks(doc)["tasks"], "OK")


class TestDoctorBuilderDrift(DoctorRepo):
    def test_a_materialised_builder_that_differs_is_drift(self):
        repo = self.make_repo()
        Path(repo, "data", "shared", ".learnings_wiki.py").write_text("print('prod-only fix')\n")
        code, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(self.checks(doc)["builder"], "DRIFT")
        self.assertEqual(code, 1)

    def test_drift_outranks_unknown_in_the_exit_code(self):
        # Both present: exit 1 (drift is actionable now), but the artifact still reports
        # the unknowns so they cannot be lost.
        repo = self.make_repo()
        Path(repo, "data", "shared", ".learnings_wiki.py").write_text("print('prod-only fix')\n")
        code, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(code, 1)
        self.assertEqual(doc["status"], "drift")
        self.assertFalse(doc["complete"])
        self.assertGreater(doc["counts"]["unknown"], 0)


class TestDoctorArtifact(DoctorRepo):
    def test_it_creates_the_output_directory_and_writes_valid_json(self):
        code, doc, _, _ = self.run_doctor(self.make_repo())
        self.assertEqual(doc["schema"], 1)
        self.assertIn(doc["status"], ("clean", "drift", "unknown"))
        self.assertEqual(doc["exitCode"], code)

    def test_the_artifact_carries_generated_at_for_staleness(self):
        _, doc, _, _ = self.run_doctor(self.make_repo())
        # Consumer derives "stale" from this; it must parse.
        datetime.datetime.fromisoformat(doc["generatedAt"])

    def test_drift_count_comes_from_counts_not_string_filtering(self):
        # The dashboard bug was `.split('\\n').filter(startsWith('DRIFT'))`. counts.drift
        # and the drift[] array must agree so no consumer needs to parse prose.
        repo = self.make_repo()
        Path(repo, "data", "shared", ".learnings_wiki.py").write_text("print('prod-only fix')\n")
        _, doc, _, _ = self.run_doctor(repo)
        self.assertEqual(doc["counts"]["drift"], len(doc["drift"]))
        self.assertEqual(doc["counts"]["unknown"], len(doc["unknown"]))

    def test_no_artifact_skips_the_write(self):
        art = os.path.join(tempfile.mkdtemp(), ".kb-doctor.json")
        run_main(doctor, ["kb-doctor.py", "--repo", self.make_repo(), "--artifact", art, "--no-artifact"])
        self.assertFalse(os.path.exists(art))


if __name__ == "__main__":
    unittest.main(verbosity=2)
