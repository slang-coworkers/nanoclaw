#!/usr/bin/env python3
"""Tests for the okf-synthesis tool embedded in SKILL.md.

The tool is EXTRACTED from SKILL.md (the largest ```python block) rather than
imported from a materialised copy, because SKILL.md is the source of truth -- the
container writes /workspace/agent/tools/okf_synth.py from it on every run, so the
two would otherwise drift.

Covers the deterministic parts a synthesis agent must be able to trust:
  * budget detection (INDEX-BLOAT / DEFN-BLOAT / OVERSIZE)
  * dossier detection (name-based, frontmatter-less, many-H2) -- the classic
    triager issue-knowledge dump
  * the memcheck false-positive trap: a bare [[nodiscard]] attribute is NOT a
    dangling link; a real [[missing.md]] IS
  * stale folder-index detection
  * the gate one-liner shape (wakeAgent true/false)
  * cross-run convergence: finalize ESCALATEs when backlog stops shrinking

Run: python3 test_okf_synth.py
"""
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent / "SKILL.md"


def load_tool(root):
    """Extract the embedded python from SKILL.md and import it against a memory root."""
    blocks = re.findall(r"```python\n(.*?)```", SKILL.read_text(encoding="utf-8"), re.DOTALL)
    assert blocks, "SKILL.md has no ```python block"
    src = max(blocks, key=len)
    path = os.path.join(root, "..", "okf_synth_under_test.py")
    Path(path).write_text(src, encoding="utf-8")
    os.environ["OKF_MEMORY_ROOT"] = root
    spec = importlib.util.spec_from_file_location(f"okf_{abs(hash(root))}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def write(root, rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    Path(p).write_text(text, encoding="utf-8")


def concept(title, body="a durable fact about the thing", type_="note"):
    return f"---\ntype: {type_}\n---\n\n# {title}\n\n{body}\n"


def scaffold(root):
    """Minimal healthy OKF tree."""
    write(root, "index.md", "---\nokf_version: \"0.1\"\n---\n\n# Memory Index\n\n## Core Memory\n\nBob.\n\n## Map\n\n- [defn](system/definition.md)\n")
    write(root, "system/definition.md", "---\ntype: system\n---\n\n# Agent Memory System\n\nshort doctrine.\n")
    write(root, "system/index.md", "# Memory System\n\n- [Definition](definition.md)\n")


class ScanBasics(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "memory")
        os.makedirs(self.root)
        scaffold(self.root)
        self.mod = load_tool(self.root)

    def classes(self, report):
        return {o["class"] for o in report["offenders"]}

    def test_healthy_tree_is_bounded(self):
        report = self.mod.scan()
        self.assertTrue(report["exists"])
        self.assertEqual(report["offenders"], [], f"unexpected offenders: {report['offenders']}")
        self.assertEqual(report["backlog"], 0)

    def test_index_bloat_detected(self):
        write(self.root, "index.md", "---\nokf_version: \"0.1\"\n---\n\n# Index\n\n" + ("x" * 13000))
        report = self.mod.scan()
        self.assertIn("INDEX-BLOAT", self.classes(report))
        self.assertGreater(report["backlog"], 0)

    def test_oversize_concept_split(self):
        write(self.root, "topics/big.md", concept("Big", body="y" * 17000))
        report = self.mod.scan()
        self.assertIn("OVERSIZE", self.classes(report))

    def test_dossier_by_name(self):
        write(self.root, "CLAUDE.local.md", "# scratch\n\nrandom pile of issue notes\n")
        report = self.mod.scan()
        self.assertIn("DOSSIER", self.classes(report))

    def test_dossier_by_frontmatterless_bulk(self):
        write(self.root, "issues/dump.md", "# issue dump\n\n" + ("note. " * 3000))
        report = self.mod.scan()
        classes = self.classes(report)
        self.assertIn("DOSSIER", classes)
        # a frontmatter-less bulk file is a DOSSIER, not double-counted as NO-FRONTMATTER
        self.assertNotIn("NO-FRONTMATTER", {o["class"] for o in report["offenders"] if o["path"] == "issues/dump.md"})

    def test_many_h2_dossier(self):
        body = "".join(f"## Issue {i}\n\nsomething\n\n" for i in range(10))
        write(self.root, "issues/knowledge.md", "---\ntype: note\n---\n\n# knowledge\n\n" + body + ("pad " * 4000))
        report = self.mod.scan()
        self.assertIn("DOSSIER", self.classes(report))


class Links(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "memory")
        os.makedirs(self.root)
        scaffold(self.root)
        self.mod = load_tool(self.root)

    def classes(self, report):
        return {o["class"] for o in report["offenders"]}

    def test_bare_attribute_is_not_a_dangling_link(self):
        # The memcheck false-positive trap: [[nodiscard]] is a C++ attribute.
        write(self.root, "notes/cpp.md", concept("C++", body="use [[nodiscard]] and [[maybe_unused]] here"))
        # keep the folder index accurate so INDEX-STALE doesn't mask the assertion
        write(self.root, "notes/index.md", "# notes\n\n- [C++](cpp.md)\n")
        report = self.mod.scan()
        self.assertNotIn("DANGLING-LINK", self.classes(report),
                         "bare [[attribute]] tokens must never be flagged as links")

    def test_real_dangling_path_link(self):
        write(self.root, "notes/a.md", concept("A", body="see [[b-missing.md]] for detail"))
        write(self.root, "notes/index.md", "# notes\n\n- [A](a.md)\n")
        report = self.mod.scan()
        self.assertIn("DANGLING-LINK", self.classes(report))

    def test_resolvable_wikilink_ok(self):
        write(self.root, "notes/a.md", concept("A", body="see [[b.md]]"))
        write(self.root, "notes/b.md", concept("B"))
        write(self.root, "notes/index.md", "# notes\n\n- [A](a.md)\n- [B](b.md)\n")
        report = self.mod.scan()
        self.assertNotIn("DANGLING-LINK", self.classes(report))

    def test_stale_folder_index(self):
        write(self.root, "notes/a.md", concept("A"))
        write(self.root, "notes/index.md", "# notes\n\n(nothing linked yet)\n")
        report = self.mod.scan()
        self.assertIn("INDEX-STALE", self.classes(report))


class GateAndConvergence(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "memory")
        os.makedirs(self.root)
        scaffold(self.root)
        self.mod = load_tool(self.root)

    def test_gate_asleep_when_bounded(self):
        rc = self.mod.cmd_gate  # ensure symbol exists
        report = self.mod.scan()
        self.assertEqual(report["offenders"], [])
        out = _capture(self.mod.cmd_gate)
        obj = json.loads(out.strip().splitlines()[-1])
        self.assertFalse(obj["wakeAgent"])

    def test_gate_wakes_on_backlog(self):
        write(self.root, "index.md", "---\nokf_version: \"0.1\"\n---\n\n# Index\n\n" + ("x" * 15000))
        out = _capture(self.mod.cmd_gate)
        obj = json.loads(out.strip().splitlines()[-1])
        self.assertTrue(obj["wakeAgent"])
        self.assertIn("by_class", obj["data"])

    def test_finalize_escalates_when_not_shrinking(self):
        # three finalize runs with a persistent, non-shrinking offender -> ESCALATE
        write(self.root, "topics/big.md", concept("Big", body="y" * 17000))
        out = ""
        for _ in range(self.mod.STALL_RUNS):
            out = _capture(self.mod.cmd_finalize)
        self.assertIn("ESCALATE", out)

    def test_state_records_history(self):
        write(self.root, "topics/big.md", concept("Big", body="y" * 17000))
        self.mod.cmd_finalize()
        state = self.mod.load_state()
        self.assertEqual(len(state["history"]), 1)
        self.assertGreater(state["history"][0]["backlog"], 0)

    def test_corrupt_state_is_parked_not_reset(self):
        Path(os.path.join(self.root, ".okf-synth-state.json")).write_text("{ not json", encoding="utf-8")
        state = self.mod.load_state()
        self.assertEqual(state["history"], [])
        parked = [f for f in os.listdir(self.root) if f.startswith(".okf-synth-state.corrupt-")]
        self.assertTrue(parked, "corrupt state must be parked, not silently discarded")


class CliSmoke(unittest.TestCase):
    """The embedded script must run as a standalone CLI (that is how the container
    invokes it), and its exit codes must match the documented contract."""

    def test_cli_exit_codes(self):
        tmp = tempfile.mkdtemp()
        root = os.path.join(tmp, "memory")
        os.makedirs(root)
        scaffold(root)
        blocks = re.findall(r"```python\n(.*?)```", SKILL.read_text(encoding="utf-8"), re.DOTALL)
        script = os.path.join(tmp, "okf_synth.py")
        Path(script).write_text(max(blocks, key=len), encoding="utf-8")
        env = dict(os.environ, OKF_MEMORY_ROOT=root)

        # bounded tree -> scan exits 0
        r = subprocess.run([sys.executable, script, "scan"], env=env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

        # add a dossier -> scan exits 3
        write(root, "CLAUDE.local.md", "# pile\n\nissue notes\n")
        r = subprocess.run([sys.executable, script, "scan"], env=env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)

        # gate always emits valid JSON on its last line, exit 0
        r = subprocess.run([sys.executable, script, "gate"], env=env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)
        obj = json.loads(r.stdout.strip().splitlines()[-1])
        self.assertTrue(obj["wakeAgent"])

        # missing root -> scan refuses with exit 2
        r = subprocess.run([sys.executable, script, "scan"],
                           env=dict(os.environ, OKF_MEMORY_ROOT=os.path.join(tmp, "nope")),
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)


def _capture(fn):
    import contextlib
    import io
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        fn()
    return buf.getvalue()


if __name__ == "__main__":
    unittest.main(verbosity=2)
