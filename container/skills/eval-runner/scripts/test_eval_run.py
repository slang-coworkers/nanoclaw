"""Tests for eval_run.py and the nanoclaw_evals metric.

Every external effect is a fake: the dispatcher records the `ncl` argv it would run,
the cost reader answers from a dict, `gh` answers from canned JSON, the verifier is a
real `tests/test.sh` written into a temporary bank (following the slang-eval-tasks
contract: AGENT_OUTPUT in, $REWARD_DIR/reward.txt out, exit 0), and the clock is a
counter the fake `sleep` advances. No test spawns `ncl` or `gh`, opens a socket or
reads a production path.

Runs under both `python3 -m unittest discover -s container/skills/eval-runner/scripts -p 'test_*.py'`
(what CI runs) and `python3 -m pytest container/skills/eval-runner/scripts -q`.
"""

import datetime as dt
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))


def load_module(name, path, env=None):
    saved = {k: os.environ.get(k) for k in (env or {})}
    os.environ.update(env or {})
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)
        # Dataclasses with postponed annotations resolve their module through
        # sys.modules, so the module is registered before it executes.
        sys.modules[name] = mod
        spec.loader.exec_module(mod)
        return mod
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


er = load_module("eval_run_under_test", os.path.join(HERE, "eval_run.py"))


def read_text(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as fh:
        return fh.read()


def read_json(*parts):
    return json.loads(read_text(*parts))


TRIAGE_TEST_SH = """#!/usr/bin/env bash
# Reward 1 when the answer names the expected subsystem, else 0. Follows the bank's
# contract: AGENT_OUTPUT in, $REWARD_DIR/reward.txt out, nothing on stdout, exit 0.
set -u
REWARD_DIR="${REWARD_DIR:-/logs/verifier}"
mkdir -p "$REWARD_DIR"
want=$(cat "$(dirname "$0")/expected")
got=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("subsystem",""))' "$AGENT_OUTPUT" 2>/dev/null)
if [ "$got" = "$want" ]; then echo 1.0 > "$REWARD_DIR/reward.txt"; else echo 0.0 > "$REWARD_DIR/reward.txt"; fi
exit 0
"""


def write_task(bank, task_id, kind, expected="parser", timeout=120, test_sh=TRIAGE_TEST_SH, base_commit=None):
    """A task directory in the bank's layout, tasks/<kind>/<id>/; returns its manifest row."""
    rel = os.path.join("tasks", kind, task_id)
    d = os.path.join(bank, rel)
    os.makedirs(os.path.join(d, "tests"))
    with open(os.path.join(d, "instruction.md"), "w") as fh:
        fh.write(f"# {task_id}\n\nTriage this issue: the {expected} crashes on empty input.\n")
    with open(os.path.join(d, "task.toml"), "w") as fh:
        fh.write(f'version = "1.0"\nname = "{task_id}"\n\n[agent]\ntimeout_sec = {timeout}.0\n\n[verifier]\n'
                 f'timeout_sec = 30.0\n\n[metadata]\nkind = "{kind}"\nexpected_subsystem = "{expected}"\n'
                 f'labels = ["cuda"]\nnext_step = "fix"\n')
    with open(os.path.join(d, "tests", "expected"), "w") as fh:
        fh.write(expected + "\n")
    if test_sh is not None:
        with open(os.path.join(d, "tests", "test.sh"), "w") as fh:
            fh.write(test_sh)
    return {"task_id": task_id, "kind": kind, "path": rel, "repo": "shader-slang/slang",
            "issue": int(task_id.split("-")[-1]) if task_id.split("-")[-1].isdigit() else 0,
            "base_commit": base_commit or ("c" * 40), "size": {}}


def write_manifest(bank, rows):
    with open(os.path.join(bank, "MANIFEST.json"), "w") as fh:
        json.dump(rows, fh)


class FakeClock:
    def __init__(self, start=1_000_000.0):
        self.t = start

    def __call__(self):
        return self.t

    def sleep(self, s):
        self.t += s


class FakeDispatcher:
    """Records every dispatch; `on_dispatch(task, repeat)` lets a test react (write an
    answer, raise) when a trial is handed out."""

    def __init__(self, on_dispatch=None, fail_ids=()):
        self.calls = []
        self.on_dispatch = on_dispatch
        self.fail_ids = set(fail_ids)

    def dispatch(self, task, repeat, prompt):
        tid = er.trial_id(task.id, repeat)
        self.calls.append((tid, prompt))
        if tid in self.fail_ids or task.id in self.fail_ids:
            raise RuntimeError("ncl tasks create failed (exit 1): CLI access is scoped to this agent group.")
        if self.on_dispatch:
            self.on_dispatch(task, repeat)
        return er.Dispatched(session_id=f"sess-{tid}", series_id=f"eval-{task.kind}-{task.id}-r{repeat}-ab12")


class FakeGh:
    def __init__(self, pulls=None, checks=None, status=None):
        self.pulls = pulls or []
        self.checks = checks or {}
        self.status = status or {}
        self.paths = []

    def __call__(self, path):
        self.paths.append(path)
        if "/pulls?" in path:
            return self.pulls
        if "/check-runs" in path:
            sha = path.split("/commits/")[1].split("/")[0]
            return {"total_count": len(self.checks.get(sha, [])), "check_runs": self.checks.get(sha, [])}
        if path.endswith("/status"):
            sha = path.split("/commits/")[1].split("/")[0]
            return {"state": "pending", "statuses": self.status.get(sha, [])}
        raise RuntimeError(f"unexpected path {path}")


def pr(number, task_id, repeat, sha):
    return {"number": number, "html_url": f"u{number}", "draft": True, "title": f"[{task_id}#r{repeat}] fix",
            "state": "open", "head": {"ref": f"eval/{task_id}-r{repeat}", "sha": sha}}


class BankTest(unittest.TestCase):
    def setUp(self):
        self.bank = tempfile.mkdtemp(prefix="eval-bank.")

    def tearDown(self):
        shutil.rmtree(self.bank, ignore_errors=True)

    def test_manifest_drives_selection_order_kind_and_base_commit(self):
        r2 = write_task(self.bank, "slang-2", "triage", timeout=300, base_commit="b" * 40)
        r1 = write_task(self.bank, "slang-1", "triage", base_commit="a" * 40)
        f1 = write_task(self.bank, "slang-9", "fixer")
        write_task(self.bank, "slang-7", "triage")  # on disk but not in the manifest: not selected
        ghost = {"task_id": "slang-404", "kind": "triage", "path": "tasks/triage/slang-404", "base_commit": "d" * 40}
        write_manifest(self.bank, [r2, r1, f1, ghost])
        logs = []
        tasks = er.load_bank(self.bank, "triage", logs.append)
        self.assertEqual([t.id for t in tasks], ["slang-2", "slang-1"])  # manifest order, not sorted
        self.assertEqual(tasks[0].agent_timeout_sec, 300)
        self.assertEqual(tasks[0].base_commit, "b" * 40)
        self.assertEqual(tasks[1].manifest["path"], "tasks/triage/slang-1")
        self.assertEqual(tasks[0].metadata["expected_subsystem"], "parser")
        self.assertTrue(any("slang-404" in line and "skipped" in line for line in logs))
        self.assertEqual([t.id for t in er.load_bank(self.bank, "fixer")], ["slang-9"])

    def test_without_a_manifest_the_bank_is_walked_and_sorted(self):
        write_task(self.bank, "slang-2", "triage")
        write_task(self.bank, "slang-1", "triage")
        write_task(self.bank, "slang-3", "fixer")
        tasks = er.load_bank(self.bank, "triage")
        self.assertEqual([t.id for t in tasks], ["slang-1", "slang-2"])
        self.assertIsNone(tasks[0].base_commit)

    def test_kind_falls_back_to_tags_then_path(self):
        self.assertEqual(er.task_kind({"metadata": {"tags": ["x", "Fixer"]}}, "misc/a"), "fixer")
        self.assertEqual(er.task_kind({}, os.path.join("bank", "triage", "a")), "triage")
        self.assertEqual(er.task_kind({"metadata": {"category": "triage"}}, "a"), "triage")
        self.assertEqual(er.task_kind({}, "a"), "unknown")

    def test_prompt_carries_instruction_and_per_repeat_contract_but_not_metadata(self):
        write_task(self.bank, "slang-1", "triage")
        task = er.load_bank(self.bank, "triage")[0]
        prompt = er.build_prompt(task, 2, "slang-coworkers/slang-eval")
        self.assertIn("Triage this issue", prompt)
        self.assertIn("trial id: slang-1#r2", prompt)
        self.assertIn("/workspace/agent/eval/slang-1/r2/answer.json", prompt)
        for key in ("subsystem", "severity", "next_step", "labels"):
            self.assertIn(key, prompt)
        for hidden in ("expected_subsystem", "cuda", '"fix"'):
            self.assertNotIn(hidden, prompt)
        write_task(self.bank, "slang-5", "fixer")
        fprompt = er.build_prompt(er.load_bank(self.bank, "fixer")[0], 1, "slang-coworkers/slang-eval")
        self.assertIn("DRAFT pull request on slang-coworkers/slang-eval", fprompt)
        self.assertIn('contains "slang-5-r1"', fprompt)
        self.assertIn('"[slang-5#r1]"', fprompt)
        self.assertIn("Never push to or open anything on shader-slang/*", fprompt)

    def test_toml_subset_parser_matches_tomllib_shape(self):
        doc = er.parse_toml('version = "1.0"\n[metadata]\nkind = "triage"\ntags = ["a", "b"]\nn = 3\nok = true\n'
                            '[agent]\ntimeout_sec = 600.0\n')
        self.assertEqual(doc["metadata"]["tags"], ["a", "b"])
        self.assertEqual(doc["metadata"]["n"], 3)
        self.assertIs(doc["metadata"]["ok"], True)
        self.assertEqual(doc["agent"]["timeout_sec"], 600.0)
        saved = sys.modules.pop("tomllib", None)
        sys.modules["tomllib"] = None  # makes `import tomllib` raise ImportError
        try:
            doc2 = er.parse_toml('[metadata]\nkind = "fixer" # comment\ntags = ["x", "y,z"]\n[verifier]\ntimeout_sec = 30\n')
        finally:
            if saved is not None:
                sys.modules["tomllib"] = saved
            else:
                sys.modules.pop("tomllib", None)
        self.assertEqual(doc2, {"metadata": {"kind": "fixer", "tags": ["x", "y,z"]}, "verifier": {"timeout_sec": 30}})


class DispatcherTest(unittest.TestCase):
    def test_ncl_command_is_a_one_shot_task_on_the_eval_group_with_an_iso_timestamp(self):
        now = dt.datetime(2026, 10, 16, 9, 30, 15, 123456, tzinfo=dt.timezone.utc)
        d = er.NclDispatcher("eval-slang-triage", now=lambda: now)
        task = er.Task("slang-1", "/bank/tasks/triage/slang-1", "triage", "x", {}, 100, 30)
        cmd = d.command(task, 2, "PROMPT")
        self.assertEqual(cmd[:4], ["tasks", "create", "--group", "eval-slang-triage"])
        self.assertEqual(cmd[cmd.index("--name") + 1], "eval-triage-slang-1-r2")
        self.assertEqual(cmd[cmd.index("--process-after") + 1], "2026-10-16T09:30:15Z")
        self.assertEqual(cmd[cmd.index("--prompt") + 1], "PROMPT")
        self.assertNotIn("--recurrence", cmd)

    def test_dispatch_parses_the_bridge_reply_and_fails_loudly_otherwise(self):
        seen = []

        def run(argv, timeout=None, **kw):
            seen.append(argv)
            out = json.dumps({"id": 1, "ok": True, "data": {"session_id": "s-1", "series_id": "eval-triage-slang-1-r1-9f3a"}})
            return subprocess.CompletedProcess(argv, 0, out, "")
        task = er.Task("slang-1", "/bank", "triage", "x", {}, 100, 30)
        got = er.NclDispatcher("g", run=run).dispatch(task, 1, "P")
        self.assertEqual((got.session_id, got.series_id), ("s-1", "eval-triage-slang-1-r1-9f3a"))
        self.assertEqual(seen[0][0], "ncl")
        self.assertEqual(seen[0][-1], "--json")

        def denied(argv, timeout=None, **kw):
            return subprocess.CompletedProcess(argv, 1, "", "CLI access is scoped to this agent group.")
        with self.assertRaises(RuntimeError) as ctx:
            er.NclDispatcher("g", run=denied).dispatch(task, 1, "P")
        self.assertIn("scoped to this agent group", str(ctx.exception))

    def test_cost_reader_reads_spent_usd_and_stops_after_a_scope_denial(self):
        def run(argv, timeout=None, **kw):
            out = json.dumps({"ok": True, "data": {"session_id": argv[4], "status": "ok", "spent_usd": 2.75}})
            return subprocess.CompletedProcess(argv, 0, out, "")
        self.assertEqual(er.NclCostReader(run)("s-1"), 2.75)

        calls = []

        def denied(argv, timeout=None, **kw):
            calls.append(argv)
            return subprocess.CompletedProcess(argv, 1, "", 'CLI access is scoped to this agent group. Cannot access "cost-cap".')
        reader = er.NclCostReader(denied)
        self.assertIsNone(reader("s-1"))
        self.assertIsNone(reader("s-2"))
        self.assertEqual(len(calls), 1, "a scope denial is remembered; the CLI is not asked again")

        def unknown(argv, timeout=None, **kw):
            return subprocess.CompletedProcess(argv, 0, json.dumps({"ok": True, "data": {"status": "unknown"}}), "")
        self.assertIsNone(er.NclCostReader(unknown)("s-3"))

    def test_gh_get_pins_the_method(self):
        seen = []

        def run(argv, timeout=None, **kw):
            seen.append(argv)
            return subprocess.CompletedProcess(argv, 0, "[]", "")
        er.GhGet(run)("repos/slang-coworkers/slang-eval/pulls?state=all")
        self.assertEqual(seen[0][:4], ["gh", "api", "--method", "GET"])


class FreezeTest(unittest.TestCase):
    def test_model_resolution_never_reports_an_alias_as_an_id(self):
        env = {"ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-1-20250805", "ANTHROPIC_MODEL": "sonnet",
               "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-20250929"}
        self.assertEqual(er.resolve_model("claude-fable-5-1", env)["model_id"], "claude-fable-5-1")
        r = er.resolve_model("opus", env)
        self.assertEqual((r["model_id"], r["alias"], r["source"]),
                         ("claude-opus-4-1-20250805", "opus", "ANTHROPIC_DEFAULT_OPUS_MODEL"))
        r = er.resolve_model(None, env)  # nothing configured → ANTHROPIC_MODEL, itself an alias
        self.assertEqual(r["model_id"], "claude-sonnet-4-5-20250929")
        r = er.resolve_model("haiku", {})
        self.assertIsNone(r["model_id"])
        self.assertEqual(r["alias"], "haiku")
        self.assertIn("unresolved", r["note"])
        self.assertIsNone(er.resolve_model("opus", {"ANTHROPIC_DEFAULT_OPUS_MODEL": "opus"})["model_id"])

    def test_freeze_group_reads_config_and_records_a_failure(self):
        def run(argv, timeout=None, **kw):
            self.assertEqual(argv[:6], ["ncl", "groups", "config", "get", "--id", "eval-slang-triage"])
            data = {"provider": "claude", "model": "opus", "effective_model": "opus", "effort": "high", "speed": "",
                    "image_tag": "v42", "cli_scope": "group", "agent_provider": "claude", "skills": ["a"]}
            return subprocess.CompletedProcess(argv, 0, json.dumps({"ok": True, "data": data}), "")
        f = er.freeze_group("eval-slang-triage", run, {"ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-1-20250805"})
        self.assertEqual(f["model"]["model_id"], "claude-opus-4-1-20250805")
        self.assertEqual((f["effort"], f["image_tag"], f["agent_provider"]), ("high", "v42", "claude"))

        def denied(argv, timeout=None, **kw):
            return subprocess.CompletedProcess(argv, 1, "", "CLI access is scoped to this agent group.")
        f = er.freeze_group("g", denied, {})
        self.assertIn("scoped", f["error"])
        self.assertIsNone(f["model"]["model_id"])

    def test_freeze_skills_reads_the_fetch_stamps(self):
        root = tempfile.mkdtemp(prefix="skills.")
        try:
            os.makedirs(os.path.join(root, "a", "ext"))
            os.makedirs(os.path.join(root, "a", "local"))
            with open(os.path.join(root, "a", "ext", "SKILL.md"), "w") as fh:
                fh.write("---\nname: ext\ngithub-ref: refs/heads/main\ngithub-tree-sha: abc123\n---\nbody\n")
            with open(os.path.join(root, "a", "local", "SKILL.md"), "w") as fh:
                fh.write("---\nname: local\n---\nbody\n")
            pin = er.freeze_skills((os.path.join(root, "a"), os.path.join(root, "missing")))
            self.assertEqual(pin["ext"]["tree_sha"], "abc123")
            self.assertEqual(pin["ext"]["ref"], "refs/heads/main")
            self.assertIsNone(pin["local"]["tree_sha"])
        finally:
            shutil.rmtree(root, ignore_errors=True)


class ScorerTest(unittest.TestCase):
    def setUp(self):
        self.bank = tempfile.mkdtemp(prefix="eval-bank.")
        self.out = tempfile.mkdtemp(prefix="eval-out.")

    def tearDown(self):
        shutil.rmtree(self.bank, ignore_errors=True)
        shutil.rmtree(self.out, ignore_errors=True)

    def _answer(self, doc):
        p = os.path.join(self.out, "answer.json")
        with open(p, "w") as fh:
            json.dump(doc, fh)
        return p

    def test_triage_reward_from_reward_dir(self):
        write_task(self.bank, "slang-1", "triage")
        task = er.load_bank(self.bank, "triage")[0]
        vdir = os.path.join(self.out, "verifier")
        reward, _ = er.score_triage(task, self._answer({"subsystem": "parser", "severity": "high",
                                                        "next_step": "repro", "labels": ["bug"]}), vdir)
        self.assertEqual(reward, 1.0)
        self.assertTrue(os.path.isfile(os.path.join(vdir, "reward.txt")))
        self.assertTrue(os.path.isfile(os.path.join(vdir, "test.log")))
        reward, _ = er.score_triage(task, self._answer({"subsystem": "emit"}), vdir)
        self.assertEqual(reward, 0.0)

    def test_triage_reward_from_stdout_and_unknown_when_absent(self):
        write_task(self.bank, "slang-2", "triage", test_sh="#!/usr/bin/env bash\necho scoring\necho 0.5\n")
        write_task(self.bank, "slang-3", "triage", test_sh="#!/usr/bin/env bash\necho nothing numeric\nexit 3\n")
        write_task(self.bank, "slang-4", "triage", test_sh=None)
        by = {t.id: t for t in er.load_bank(self.bank, "triage")}
        reward, _ = er.score_triage(by["slang-2"], self._answer({"subsystem": "x"}), os.path.join(self.out, "v"))
        self.assertEqual(reward, 0.5)
        reward, why = er.score_triage(by["slang-3"], self._answer({"subsystem": "x"}), os.path.join(self.out, "v3"))
        self.assertIsNone(reward)
        self.assertIn("wrote no reward", why)
        self.assertEqual(er.score_triage(by["slang-4"], "/nonexistent", self.out), (None, "task has no tests/test.sh"))

    def test_ci_verdict_mapping(self):
        def done(name, c):
            return {"name": name, "status": "completed", "conclusion": c}
        self.assertEqual(er.ci_verdict([done("build", "success"), done("test", "skipped")], [])[0], "green")
        self.assertEqual(er.ci_verdict([done("build", "success"), done("test", "failure")], [])[0], "red")
        self.assertEqual(er.ci_verdict([done("build", "success"), {"name": "t", "status": "in_progress"}], [])[0], "pending")
        self.assertEqual(er.ci_verdict([], [])[0], "none")
        self.assertEqual(er.ci_verdict([], [{"context": "ci/x", "state": "error"}])[0], "red")
        self.assertEqual(er.ci_verdict([], [{"context": "ci/x", "state": "success"}])[0], "green")
        self.assertEqual(er.ci_verdict([{"name": "a", "status": "queued"}, done("b", "timed_out")], [])[0], "red")
        # With a check name only that run counts: a failing label check and a pending
        # upstream job do not decide the verdict, and statuses are ignored.
        runs = [done("Verify PR Labels", "failure"), {"name": "build-windows", "status": "queued"}, done("eval-ci", "success")]
        self.assertEqual(er.ci_verdict(runs, [{"context": "ci/x", "state": "error"}], only="eval-ci")[0], "green")
        self.assertEqual(er.ci_verdict(runs[:2], [], only="eval-ci"), ("none", 'the fork reported no "eval-ci" check run for the PR head'))
        self.assertEqual(er.ci_verdict([done("eval-ci", "failure")], [], only="eval-ci")[0], "red")
        self.assertEqual(er.ci_verdict([{"name": "eval-ci", "status": "in_progress"}], [], only="eval-ci")[0], "pending")

    def test_fixer_poll_matches_the_repeat_not_just_the_task(self):
        gh = FakeGh(pulls=[pr(7, "slang-1", 1, "aaa"), pr(8, "slang-1", 2, "bbb"),
                           {"number": 9, "html_url": "u9", "draft": False, "title": "[slang-2#r1] by title only",
                            "state": "open", "head": {"ref": "fix/other", "sha": "ccc"}}])
        task = er.Task("slang-1", "/b", "fixer", "x", {}, 100, 30)
        self.assertEqual(er.poll_fixer(gh, "slang-coworkers/slang-eval", task, 2)["head_sha"], "bbb")
        self.assertEqual(er.poll_fixer(gh, "slang-coworkers/slang-eval", task, 1)["number"], 7)
        self.assertIsNone(er.poll_fixer(gh, "slang-coworkers/slang-eval", task, 3))
        t2 = er.Task("slang-2", "/b", "fixer", "x", {}, 1, 1)
        self.assertEqual(er.poll_fixer(gh, "slang-coworkers/slang-eval", t2, 1)["number"], 9)
        self.assertTrue(gh.paths[0].startswith("repos/slang-coworkers/slang-eval/pulls?"))


class StatisticsTest(unittest.TestCase):
    def test_aggregate_tasks_mean_pass_at_k_min_max_and_low_signal(self):
        trials = [
            {"task_id": "a", "repeat": 1, "reward": 1.0, "base_commit": "x"}, {"task_id": "a", "repeat": 2, "reward": 0.0},
            {"task_id": "a", "repeat": 3, "reward": 1.0},
            {"task_id": "b", "repeat": 1, "reward": 0.5}, {"task_id": "b", "repeat": 2, "reward": 0.5},
            {"task_id": "c", "repeat": 1, "reward": None, "status": "timeout"},
        ]
        agg = er.aggregate_tasks(trials)
        self.assertEqual((agg["a"]["mean"], agg["a"]["pass_at_k"], agg["a"]["min"], agg["a"]["max"]), (0.6667, 1.0, 0.0, 1.0))
        self.assertTrue(agg["a"]["low_signal"])
        self.assertEqual(agg["a"]["base_commit"], "x")
        self.assertEqual((agg["b"]["mean"], agg["b"]["pass_at_k"]), (0.5, 0.0))
        self.assertFalse(agg["b"]["low_signal"])
        self.assertEqual((agg["c"]["mean"], agg["c"]["scored"], agg["c"]["repeats"]), (None, 0, 1))
        self.assertFalse(agg["c"]["low_signal"])

    def test_bootstrap_ci_is_seeded_and_brackets_the_mean(self):
        diffs = [0.1, 0.2, 0.0, 0.3, 0.1, 0.2, 0.4, 0.0, 0.1, 0.2]
        ci = er.bootstrap_ci(diffs)
        self.assertEqual(ci, er.bootstrap_ci(diffs))
        self.assertLess(ci[0], sum(diffs) / len(diffs))
        self.assertGreater(ci[1], sum(diffs) / len(diffs))
        self.assertGreater(ci[0], 0.0)
        self.assertIsNone(er.bootstrap_ci([0.5]))

    def test_compare_is_paired_over_task_means_and_flags_smoke_signal(self):
        def trials(scores):
            return [{"task_id": tid, "repeat": k + 1, "reward": r} for tid, rs in scores.items() for k, r in enumerate(rs)]
        baseline = trials({"a": [1.0, 0.0, 1.0], "b": [0.0, 0.0, 0.0], "c": [1.0, 1.0, 1.0], "d": [None, None, None]})
        variant = trials({"a": [1.0, 1.0, 1.0], "b": [0.0, 0.0, 0.0], "c": [0.0, 1.0, 1.0], "e": [1.0]})
        c = er.compare_jobs(baseline, variant)
        self.assertEqual(c["tasks_compared"], 3)
        self.assertTrue(c["smoke_signal"])
        rows = {r["task_id"]: r for r in c["rows"]}
        self.assertEqual(rows["a"]["delta"], 0.3333)
        self.assertEqual(rows["c"]["delta"], -0.3333)
        self.assertEqual((c["wins"], c["losses"], c["ties"]), (1, 1, 1))
        self.assertEqual(c["paired_delta_mean"], 0.0)
        self.assertEqual(c["low_signal_tasks"], ["a", "c"])
        self.assertEqual(c["variant_only"], ["e"])
        self.assertEqual(c["baseline_only"], ["d"])
        self.assertIsNotNone(c["paired_delta_ci95"])
        self.assertFalse(c["significant"])
        big_b = trials({f"t{i}": [0.0, 0.0] for i in range(31)})
        big_v = trials({f"t{i}": [1.0, 1.0] for i in range(31)})
        big = er.compare_jobs(big_b, big_v)
        self.assertFalse(big["smoke_signal"])
        self.assertTrue(big["significant"])
        self.assertEqual(big["paired_delta_ci95"], [1.0, 1.0])


class BudgetTest(unittest.TestCase):
    def test_known_costs_and_fallback_estimates_bound_dispatch(self):
        costs = {"s-1": 4.0, "s-2": None}
        b = er.Budget(cap_usd=10.0, cost_reader=lambda s: costs.get(s), fallback_usd=3.0)
        self.assertEqual(b.can_dispatch(), (True, ""))
        b.refresh("s-1")
        b.refresh("s-2")
        self.assertEqual(b.committed_usd(), 7.0)
        self.assertEqual(b.known_usd(), 4.0)
        self.assertTrue(b.can_dispatch()[0])
        costs["s-2"] = 3.5
        b.refresh("s-2")
        ok, why = b.can_dispatch()
        self.assertFalse(ok)
        self.assertIn("budget", why)
        self.assertTrue(b.cost_signal_seen)

    def test_without_any_cost_signal_the_cap_is_a_trial_count(self):
        b = er.Budget(cap_usd=300.0, cost_reader=lambda s: None, fallback_usd=1.5)
        n = 0
        while b.can_dispatch()[0]:
            n += 1
            b.refresh(f"s-{n}")
        self.assertEqual(n, 200)
        self.assertFalse(b.cost_signal_seen)


class JobTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="eval-job.")
        self.bank = os.path.join(self.root, "bank")
        self.group_dir = os.path.join(self.root, "prod-groups", "eval-slang-triage")
        self.reports = os.path.join(self.root, "reports")
        os.makedirs(self.group_dir)
        self.clock = FakeClock()
        self.frozen = {"group": {"model": {"model_id": "claude-fable-5-1"}}, "skills": {"x": {"tree_sha": "s"}}}

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def cfg(self, kind="triage", **kw):
        base = {"job_id": "job-1", "kind": kind, "group": "eval-slang-triage", "group_dir": self.group_dir, "bank": self.bank,
                    "variant": "baseline", "fork": "slang-coworkers/slang-eval", "budget_usd": 300.0, "concurrency": 2, "limit": 0,
                    "repeats": 3, "poll_interval_sec": 10.0, "ci_grace_sec": 60, "reports_dir": self.reports}
        base.update(kw)
        return er.JobConfig(**base)

    def write_answer(self, task_id, repeat, doc):
        d = er.answer_dir(self.group_dir, task_id, repeat)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "answer.json"), "w") as fh:
            json.dump(doc, fh)

    def test_triage_job_repeats_every_task_independently_and_writes_outputs(self):
        rows = [write_task(self.bank, f"slang-{i}", "triage", base_commit=f"{i}" * 40) for i in range(1, 4)]
        write_manifest(self.bank, rows)
        tasks = er.load_bank(self.bank, "triage")
        in_flight = {"now": 0, "max": 0}

        def on_dispatch(task, repeat):
            in_flight["now"] += 1
            in_flight["max"] = max(in_flight["max"], in_flight["now"])
            # slang-2's second repeat answers wrongly (a low-signal task); slang-3
            # cannot answer at all; the rest are right.
            if task.id == "slang-3":
                self.write_answer(task.id, repeat, {"error": "issue not found"})
            else:
                wrong = task.id == "slang-2" and repeat == 2
                self.write_answer(task.id, repeat, {"subsystem": "emit" if wrong else "parser", "severity": "high",
                                                    "next_step": "repro", "labels": ["bug"]})
        dispatcher = FakeDispatcher(on_dispatch)
        budget = er.Budget(300.0, lambda s: 0.5, 1.5)
        job = er.EvalJob(self.cfg(), tasks, dispatcher, budget, clock=self.clock, sleep=self.clock.sleep,
                         frozen=self.frozen)
        orig_poll = job._poll

        def poll(task, trial):
            done = orig_poll(task, trial)
            if done:
                in_flight["now"] -= 1
            return done
        job._poll = poll
        trials = job.run_all()
        self.assertLessEqual(in_flight["max"], 2)
        self.assertEqual(len(dispatcher.calls), 9)
        # Repeats are interleaved: the first three dispatches are r1 of each task.
        self.assertEqual([c[0] for c in dispatcher.calls[:3]], ["slang-1#r1", "slang-2#r1", "slang-3#r1"])
        # Every repeat has its own answer directory and the prompt names it.
        self.assertTrue(os.path.isfile(os.path.join(self.group_dir, "eval", "slang-1", "r3", "answer.json")))
        self.assertIn("/workspace/agent/eval/slang-1/r3/answer.json", dict(dispatcher.calls)["slang-1#r3"])
        by = {t.trial_id: t for t in trials}
        self.assertEqual(by["slang-2#r2"].reward, 0.0)
        self.assertEqual(by["slang-2#r1"].reward, 1.0)
        self.assertEqual(by["slang-3#r1"].status, er.ERROR)
        self.assertEqual(by["slang-1#r1"].base_commit, "1" * 40)
        self.assertEqual(by["slang-1#r1"].cost_usd, 0.5)

        summary = er.write_job(self.cfg(), job)
        self.assertEqual((summary["tasks"], summary["trials"], summary["scored"], summary["errors"]), (3, 9, 6, 3))
        # Task means: slang-1 1.0, slang-2 0.6667, slang-3 0.0 → 0.5556; pass@k: 1, 1, 0.
        self.assertEqual(summary["mean_reward"], 0.5556)
        self.assertEqual(summary["pass_at_k"], 0.6667)
        self.assertEqual(summary["low_signal_tasks"], 1)
        self.assertEqual(summary["cost_usd"], 4.5)
        self.assertEqual(summary["repeats"], 3)
        self.assertEqual(summary["frozen"]["group"]["model"]["model_id"], "claude-fable-5-1")
        self.assertEqual(summary["status"], "partial")
        job_dir = os.path.join(self.reports, "evals", "job-1")
        for f in ("job.json", "trials.jsonl", "scorecard.html", "config.json", "result.json"):
            self.assertTrue(os.path.isfile(os.path.join(job_dir, f)), f)
        job_doc = read_json(job_dir, "job.json")
        self.assertTrue(job_doc["task_results"]["slang-2"]["low_signal"])
        self.assertEqual(job_doc["task_results"]["slang-2"]["min"], 0.0)
        latest = read_json(self.reports, "evals", "latest.json")
        self.assertEqual(latest["job_id"], "job-1")
        self.assertNotIn("trial_results", latest)
        lines = read_text(job_dir, "trials.jsonl").strip().splitlines()
        self.assertEqual(len(lines), 9)
        self.assertNotIn("_started", lines[0])
        self.assertIn('"trial_id": "slang-1#r1"', lines[0])
        tdirs = sorted(os.listdir(os.path.join(job_dir, "trials")))
        self.assertEqual(len(tdirs), 9)
        t1 = next(d for d in tdirs if d.startswith("slang-1#r1__1-"))
        cfg = read_json(job_dir, "trials", t1, "config.json")
        self.assertEqual(cfg["task"]["metadata"]["expected_subsystem"], "parser")
        self.assertEqual(cfg["task"]["base_commit"], "1" * 40)
        self.assertEqual(cfg["agent"]["group"]["model"]["model_id"], "claude-fable-5-1")
        res = read_json(job_dir, "trials", t1, "result.json")
        self.assertEqual(res["verifier_result"]["rewards"]["reward"], 1.0)
        self.assertEqual(read_text(job_dir, "trials", t1, "verifier", "reward.txt").strip(), "1.0")
        html_text = read_text(job_dir, "scorecard.html")
        self.assertIn("low-signal", html_text)
        self.assertIn("slang-2#r2", html_text)
        self.assertIn("claude-fable-5-1", html_text)

    def test_an_answer_written_before_dispatch_is_not_this_trials_answer(self):
        write_task(self.bank, "slang-1", "triage", timeout=50)
        tasks = er.load_bank(self.bank, "triage")
        # A previous job's answer sits at the planned path, older than this dispatch.
        self.write_answer("slang-1", 1, {"subsystem": "parser", "severity": "high", "next_step": "fix", "labels": []})
        stale = os.path.join(er.answer_dir(self.group_dir, "slang-1", 1), "answer.json")
        os.utime(stale, (self.clock.t - 100, self.clock.t - 100))
        self.assertEqual(er.existing_answers(self.group_dir, [(tasks[0], 1), (tasks[0], 2)]), [stale])
        job = er.EvalJob(self.cfg(repeats=1), tasks, FakeDispatcher(), er.Budget(300.0, lambda s: None, 1.5),
                         clock=self.clock, sleep=self.clock.sleep)
        trial = job.run_all()[0]
        self.assertEqual((trial.status, trial.reward), (er.TIMEOUT, 0.0))
        self.assertIsNone(trial.answer)

    def test_a_rewritten_answer_is_scored_once_it_stops_changing(self):
        write_task(self.bank, "slang-1", "triage", timeout=200)
        tasks = er.load_bank(self.bank, "triage")
        polls = {"n": 0}
        # The agent first writes a wrong draft, then rewrites it right after the
        # runner has already seen the draft once.
        dispatcher = FakeDispatcher(lambda task, repeat: self.write_answer(
            task.id, repeat, {"subsystem": "emit", "severity": "low", "next_step": "fix", "labels": []}))
        job = er.EvalJob(self.cfg(repeats=1), tasks, dispatcher, er.Budget(300.0, lambda s: 0.5, 1.5),
                         clock=self.clock, sleep=self.clock.sleep)
        orig_poll = job._poll

        def poll(task, trial):
            polls["n"] += 1
            if polls["n"] == 2:
                self.write_answer(task.id, trial.repeat,
                                  {"subsystem": "parser", "severity": "high", "next_step": "fix", "labels": []})
            return orig_poll(task, trial)
        job._poll = poll
        trial = job.run_all()[0]
        self.assertEqual((trial.status, trial.reward), (er.SCORED, 1.0))
        self.assertEqual(trial.answer["subsystem"], "parser")
        # draft seen, rewrite seen, rewrite confirmed unchanged: three polls, not one.
        self.assertEqual(polls["n"], 3)
        self.assertNotIn("_answer_sig", trial.public())

    def test_timeout_and_dispatch_failure_are_trial_states_not_crashes(self):
        write_task(self.bank, "slang-1", "triage", timeout=50)
        write_task(self.bank, "slang-2", "triage", timeout=50)
        tasks = er.load_bank(self.bank, "triage")
        dispatcher = FakeDispatcher(fail_ids={"slang-2"})  # slang-1 never answers
        job = er.EvalJob(self.cfg(repeats=1), tasks, dispatcher, er.Budget(300.0, lambda s: None, 1.5),
                         clock=self.clock, sleep=self.clock.sleep)
        trials = {t.task_id: t for t in job.run_all()}
        self.assertEqual((trials["slang-1"].status, trials["slang-1"].reward), (er.TIMEOUT, 0.0))
        self.assertGreaterEqual(trials["slang-1"].duration_sec, 50)
        self.assertEqual(trials["slang-2"].status, er.ERROR)
        self.assertIn("dispatch failed", trials["slang-2"].reason)
        summary = er.write_job(self.cfg(repeats=1), job)
        self.assertEqual((summary["timeouts"], summary["errors"], summary["scored"]), (1, 1, 0))
        self.assertIsNone(summary["cost_usd"])
        self.assertIsNone(summary["mean_reward"] if summary["scored"] == 0 and summary["timeouts"] == 0 else None)
        self.assertIn("fallback", summary["cost_signal"])

    def test_budget_counts_repeats_and_marks_the_rest_skipped(self):
        for i in range(1, 3):
            write_task(self.bank, f"slang-{i}", "triage")
        tasks = er.load_bank(self.bank, "triage")

        def on_dispatch(task, repeat):
            self.write_answer(task.id, repeat, {"subsystem": "parser", "severity": "s", "next_step": "n", "labels": []})
        dispatcher = FakeDispatcher(on_dispatch)
        # Every trial costs 4 USD; with a 10 USD cap and a 3 USD estimate the third
        # dispatch (8 + 3 > 10) is refused, although 2 tasks × 2 repeats were planned.
        job = er.EvalJob(self.cfg(concurrency=1, repeats=2), tasks, dispatcher, er.Budget(10.0, lambda s: 4.0, 3.0),
                         clock=self.clock, sleep=self.clock.sleep)
        trials = job.run_all()
        self.assertEqual([c[0] for c in dispatcher.calls], ["slang-1#r1", "slang-2#r1"])
        self.assertEqual([t.status for t in trials], [er.SCORED, er.SCORED, er.SKIPPED, er.SKIPPED])
        self.assertTrue(job.stopped_for_budget)
        summary = er.write_job(self.cfg(concurrency=1, repeats=2), job)
        self.assertEqual((summary["status"], summary["skipped"], summary["cost_usd"]), ("stopped", 2, 8.0))
        self.assertEqual(summary["tasks"], 2)  # both tasks got one repeat each, by the interleaving

    def test_fixer_job_scores_each_repeat_from_the_forks_check_runs(self):
        for tid in ("slang-1", "slang-2"):
            write_task(self.bank, tid, "fixer", timeout=500)
        tasks = er.load_bank(self.bank, "fixer")
        gh = FakeGh(
            pulls=[pr(1, "slang-1", 1, "s1"), pr(2, "slang-1", 2, "s2"), pr(3, "slang-2", 1, "s3"), pr(4, "slang-2", 2, "s4")],
            checks={
                "s1": [{"name": "build", "status": "completed", "conclusion": "success"}],
                "s2": [{"name": "build", "status": "completed", "conclusion": "failure"}],
                "s3": [],  # CI never reports: unknown after the grace period
                "s4": [{"name": "build", "status": "completed", "conclusion": "success"}],
            },
        )
        job = er.EvalJob(self.cfg(kind="fixer", group="eval-slang-fixer", repeats=2, ci_grace_sec=60), tasks,
                         FakeDispatcher(), er.Budget(300.0, lambda s: None, 20.0), gh=gh,
                         clock=self.clock, sleep=self.clock.sleep)
        by = {t.trial_id: t for t in job.run_all()}
        self.assertEqual((by["slang-1#r1"].status, by["slang-1#r1"].reward), (er.SCORED, 1.0))
        self.assertEqual((by["slang-1#r2"].status, by["slang-1#r2"].reward), (er.SCORED, 0.0))
        self.assertEqual((by["slang-2#r1"].status, by["slang-2#r1"].reward), (er.UNKNOWN, None))
        self.assertIn("no check runs", by["slang-2#r1"].reason)
        self.assertEqual(by["slang-2#r2"].pr["number"], 4)
        self.assertTrue(all("--method" not in p for p in gh.paths))
        summary = er.write_job(self.cfg(kind="fixer", group="eval-slang-fixer", repeats=2), job)
        self.assertEqual((summary["scored"], summary["unknown"]), (3, 1))
        # slang-1 mean 0.5 (low-signal), slang-2 mean 1.0 over its one scored repeat.
        self.assertEqual((summary["mean_reward"], summary["pass_at_k"], summary["low_signal_tasks"]), (0.75, 1.0, 1))
        tdir = next(d for d in os.listdir(os.path.join(job.job_dir, "trials")) if d.startswith("slang-1#r2__"))
        self.assertEqual(read_text(job.job_dir, "trials", tdir, "verifier", "reward.txt").strip(), "0.0")

    def test_fixer_pending_ci_waits_until_the_task_timeout(self):
        write_task(self.bank, "slang-1", "fixer", timeout=100)
        tasks = er.load_bank(self.bank, "fixer")
        gh = FakeGh(pulls=[pr(1, "slang-1", 1, "s1")], checks={"s1": [{"name": "build", "status": "in_progress"}]})
        job = er.EvalJob(self.cfg(kind="fixer", repeats=1), tasks, FakeDispatcher(), er.Budget(300.0, lambda s: None, 20.0),
                         gh=gh, clock=self.clock, sleep=self.clock.sleep)
        trial = job.run_all()[0]
        self.assertEqual(trial.status, er.TIMEOUT)
        self.assertIsNone(trial.reward, "a PR whose CI never finished is not a zero")
        self.assertIn("CI verdict", trial.reason)

    def test_retry_selects_unscored_repeats_once_and_runs_only_those(self):
        previous = [{"task_id": "slang-1", "repeat": 1, "trial_id": "slang-1#r1", "reward": 1.0, "status": "scored", "attempt": 1},
                    {"task_id": "slang-1", "repeat": 2, "trial_id": "slang-1#r2", "reward": None, "status": "timeout", "attempt": 1},
                    {"task_id": "slang-2", "repeat": 1, "trial_id": "slang-2#r1", "reward": None, "status": "error", "attempt": 2},
                    {"task_id": "slang-3", "repeat": 1, "trial_id": "slang-3#r1", "reward": None, "status": "unknown", "attempt": 1}]
        for i in range(1, 4):
            write_task(self.bank, f"slang-{i}", "triage")
        tasks = er.load_bank(self.bank, "triage")
        logs = []
        pairs, attempts = er.select_retry(tasks, previous, logs.append)
        self.assertEqual([(t.id, k) for t, k in pairs], [("slang-1", 2), ("slang-3", 1)])
        self.assertEqual(attempts, {"slang-1#r2": 2, "slang-3#r1": 2})
        self.assertTrue(any("slang-2#r1" in line and "not retried" in line for line in logs))

        def on_dispatch(task, repeat):
            self.write_answer(task.id, repeat, {"subsystem": "parser", "severity": "s", "next_step": "n", "labels": []})
        dispatcher = FakeDispatcher(on_dispatch)
        job = er.EvalJob(self.cfg(job_id="job-retry", retry_from="job-1"), [t for t in tasks if t.id != "slang-2"],
                         dispatcher, er.Budget(300.0, lambda s: None, 1.5), clock=self.clock, sleep=self.clock.sleep,
                         attempts=attempts, pairs=pairs)
        trials = job.run_all()
        self.assertEqual([c[0] for c in dispatcher.calls], ["slang-1#r2", "slang-3#r1"])
        self.assertEqual([t.attempt for t in trials], [2, 2])
        self.assertTrue(trials[0].trial_name.startswith("slang-1#r2__2-"))

    def test_write_job_with_compare_renders_the_paired_table(self):
        write_task(self.bank, "slang-1", "triage")
        tasks = er.load_bank(self.bank, "triage")
        os.makedirs(os.path.join(self.reports, "evals", "base-1"))
        with open(os.path.join(self.reports, "evals", "base-1", "trials.jsonl"), "w") as fh:
            fh.writelines(json.dumps({"task_id": "slang-1", "repeat": k, "trial_id": f"slang-1#r{k}", "reward": r,
                                     "status": "scored"}) + "\n" for k, r in enumerate([0.0, 1.0, 0.0], start=1))

        def on_dispatch(task, repeat):
            self.write_answer(task.id, repeat, {"subsystem": "parser", "severity": "s", "next_step": "n", "labels": []})
        cfg = self.cfg(variant="new-prompt", compare="base-1")
        job = er.EvalJob(cfg, tasks, FakeDispatcher(on_dispatch), er.Budget(300.0, lambda s: None, 1.5),
                         clock=self.clock, sleep=self.clock.sleep)
        job.run_all()
        summary = er.write_job(cfg, job)
        cr = summary["compare_result"]
        self.assertEqual((cr["tasks_compared"], cr["paired_delta_mean"], cr["smoke_signal"]), (1, 0.6667, True))
        self.assertEqual(cr["low_signal_tasks"], ["slang-1"])
        self.assertIsNone(cr["paired_delta_ci95"])  # one task: no interval
        html_text = read_text(job.job_dir, "scorecard.html")
        self.assertIn("Baseline base-1 vs variant new-prompt", html_text)
        self.assertIn("smoke-signal", html_text)
        self.assertIn("<td class='ok'>0.67</td>", html_text)


class CliTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="eval-cli.")
        self.bank = os.path.join(self.root, "bank")

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_dry_run_lists_every_repeat_and_dispatches_nothing(self):
        rows = [write_task(self.bank, "slang-1", "triage", base_commit="a" * 40), write_task(self.bank, "slang-2", "triage")]
        write_manifest(self.bank, rows)
        r = subprocess.run([sys.executable, os.path.join(HERE, "eval_run.py"), "--bank", self.bank, "--kind", "triage",
                            "--group", "eval-slang-triage", "--limit", "1", "--dry-run", "--reports", self.root,
                            "--prod-groups-root", self.root], capture_output=True, text=True, check=False)
        self.assertEqual(r.returncode, 0, r.stderr)
        for k in (1, 2, 3):
            self.assertIn(f"slang-1#r{k}: ncl tasks create --group eval-slang-triage --name eval-triage-slang-1-r{k} "
                          f"--process-after", r.stderr)
        self.assertIn("base " + "a" * 40, r.stderr)
        self.assertNotIn("slang-2", r.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.root, "evals")))

    def test_repeats_default_by_kind_and_no_tasks_is_exit_2(self):
        os.makedirs(self.bank)
        write_manifest(self.bank, [write_task(self.bank, "slang-1", "fixer")])
        r = subprocess.run([sys.executable, os.path.join(HERE, "eval_run.py"), "--bank", self.bank, "--kind", "fixer",
                            "--group", "g", "--dry-run", "--reports", self.root], capture_output=True, text=True, check=False)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("slang-1#r2", r.stderr)
        self.assertNotIn("slang-1#r3", r.stderr)
        r = subprocess.run([sys.executable, os.path.join(HERE, "eval_run.py"), "--bank", self.bank, "--kind", "triage",
                            "--group", "g", "--reports", self.root], capture_output=True, text=True, check=False)
        self.assertEqual(r.returncode, 2)
        self.assertIn("no triage tasks", r.stderr)

    def test_main_refuses_a_triage_job_whose_answer_paths_already_exist(self):
        os.makedirs(self.bank)
        write_manifest(self.bank, [write_task(self.bank, "slang-1", "triage")])
        group_dir = os.path.join(self.root, "eval-slang-triage")
        d = er.answer_dir(group_dir, "slang-1", 2)
        os.makedirs(d)
        with open(os.path.join(d, "answer.json"), "w") as fh:
            fh.write("{}")
        argv = [sys.executable, os.path.join(HERE, "eval_run.py"), "--bank", self.bank, "--kind", "triage",
                "--group", "g", "--group-dir", group_dir, "--reports", self.root]
        r = subprocess.run(argv, capture_output=True, text=True, check=False)
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("answer already present before dispatch", r.stderr)
        self.assertIn(os.path.join("slang-1", "r2", "answer.json"), r.stderr)
        r = subprocess.run(argv + ["--dry-run"], capture_output=True, text=True, check=False)
        self.assertEqual(r.returncode, 0, r.stderr)


class MetricsTest(unittest.TestCase):
    """The nanoclaw_evals measurement re-emits latest.json without re-deriving a
    reward, and a missing report is an error, not zero."""

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="evals-metrics-test.")
        self.metrics = load_module("nanoclaw_metrics_under_evals_test",
                                   os.path.join(REPO, "ops", "metrics", "nanoclaw-metrics.py"),
                                   {"NANOCLAW_DIR": self.root})

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def _write(self, doc):
        out_dir = os.path.join(self.root, "groups", "eval-compliance", "reports", "evals")
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "latest.json"), "w") as fh:
            json.dump(doc, fh)

    def test_emits_job_summary(self):
        self._write({"job_id": "20261016-090000-triage-baseline", "kind": "triage", "variant": "baseline",
                     "status": "partial", "tasks": 60, "trials": 180, "repeats": 3, "dispatched": 180, "scored": 170,
                     "unknown": 2, "timeouts": 5, "errors": 3, "skipped": 0, "mean_reward": 0.7316, "pass_at_k": 0.85,
                     "pass_rate": 0.7, "low_signal_tasks": 12, "cost_usd": 212.4, "cost_known_sessions": 180,
                     "budget_usd": 300.0, "stopped_for_budget": False, "duration_sec": 5400.5,
                     "frozen": {"group": {"model": {"model_id": "claude-fable-5-1"}}}})
        self.metrics.collect_evals()
        self.assertEqual(len(self.metrics._out), 1)
        line = self.metrics._out[0]
        self.assertTrue(line.startswith("nanoclaw_evals,kind=triage,model=claude-fable-5-1,status=partial,variant=baseline "), line)
        for frag in ("tasks=60i", "trials=180i", "repeats=3i", "scored=170i", "timeouts=5i", "mean_reward=0.7316",
                     "pass_at_k=0.85", "low_signal_tasks=12i", "cost_usd=212.4", "budget_usd=300",
                     'job_id="20261016-090000-triage-baseline"', "stopped_for_budget=false", "duration_sec=5400i"):
            self.assertIn(frag, line)

    def test_no_scored_task_means_no_reward_field_not_zero(self):
        self._write({"job_id": "j", "kind": "fixer", "variant": "v", "status": "stopped", "tasks": 3,
                     "mean_reward": None, "pass_at_k": None, "cost_usd": None, "stopped_for_budget": True})
        self.metrics.collect_evals()
        line = self.metrics._out[0]
        self.assertNotIn("mean_reward", line)
        self.assertNotIn("pass_at_k", line)
        self.assertNotIn("cost_usd", line)
        self.assertIn("model=unresolved", line)
        self.assertIn("stopped_for_budget=true", line)

    def test_missing_report_is_an_error_not_zero(self):
        with self.assertRaises(OSError):
            self.metrics.collect_evals()
        self.assertEqual(self.metrics._out, [])


if __name__ == "__main__":
    unittest.main()
