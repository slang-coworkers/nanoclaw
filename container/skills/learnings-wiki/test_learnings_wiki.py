#!/usr/bin/env python3
"""Tests for the learnings-wiki builder embedded in SKILL.md.

The builder is extracted from SKILL.md rather than imported from the materialised copy at
data/shared/.learnings_wiki.py, because SKILL.md is the source of truth — kb-doctor exists
precisely because those two drift. Testing the materialised copy would test whatever prod
happens to hold.

The case that matters is a SECOND fold. `build()` deletes and regenerates every
wiki/learnings page, so anything an agent wrote onto one of those pages survives exactly
one rebuild. A retirement that silently un-retires invites the fold to resurrect a concept
that was deliberately superseded. Run: python3 test_learnings_wiki.py
"""

import importlib.util
import io
import json
import contextlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent / "SKILL.md"

OLD = "1754300000001-old-spirv-rule"
NEW = "1754300000002-new-spirv-rule"
THIRD = "1754300000003-third-rule"


def load_builder(kb_root):
    """Extract the embedded python from SKILL.md and import it against a KB root."""
    blocks = re.findall(r"```python\n(.*?)```", SKILL.read_text(encoding="utf-8"), re.S)
    assert blocks, "SKILL.md has no ```python block"
    src = max(blocks, key=len)
    path = os.path.join(kb_root, ".learnings_wiki.py")
    Path(path).write_text(src, encoding="utf-8")
    os.environ["WIKI_KB_ROOT"] = kb_root
    spec = importlib.util.spec_from_file_location(f"lw_{abs(hash(kb_root))}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def atom(kb, stem, title, body="Some content about spirv codegen.", **frontmatter):
    fm = "".join(f"{k}: {v}\n" for k, v in frontmatter.items())
    head = f"---\n{fm}---\n" if fm else ""
    Path(kb, "learnings", f"{stem}.md").write_text(f"{head}# {title}\n\n{body}\n", encoding="utf-8")


class Fold(unittest.TestCase):
    def setUp(self):
        self.kb = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.kb, "learnings"), exist_ok=True)
        atom(self.kb, "1754300000001-old-spirv-rule", "Old SPIRV rule")
        atom(self.kb, "1754300000002-new-spirv-rule", "New SPIRV rule")
        self.lw = load_builder(self.kb)

    def build(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.lw.build()

    def finalize(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.lw.finalize()
        return out.getvalue()

    def wiki_page(self, stem):
        return Path(self.kb, "wiki", "learnings", f"{stem}.md").read_text(encoding="utf-8")

    def retire(self, stem, superseded_by):
        """What SKILL.md tells the fold agent to do: mark the L3 page."""
        p = Path(self.kb, "wiki", "learnings", f"{stem}.md")
        t = p.read_text(encoding="utf-8")
        p.write_text(t.replace("type: learning", f"type: learning\nsuperseded_by: {superseded_by}", 1),
                     encoding="utf-8")

    def concept_citing(self, *stems):
        d = Path(self.kb, "wiki", "concepts")
        d.mkdir(parents=True, exist_ok=True)
        rows = "\n".join(f"- [x](wiki/learnings/{s}.md)" for s in stems)
        (d / "slang-backends.md").write_text(
            "---\ntitle: \"SPIRV\"\ntype: concept\ngroup: slang-backends\n---\n\n"
            f"## TL;DR\n\nRules.\n\n**Source learnings ({len(stems)}):**\n{rows}\n", encoding="utf-8")

    def frontmatter(self, stem):
        """The generated page's OWN frontmatter block.

        `build()` embeds the L1 atom verbatim, frontmatter included, so a substring search
        over the whole page also matches the copy in the body — which is how a test can
        appear to prove the page was marked when only the copied text carried the marker.
        """
        parts = self.wiki_page(stem).split("---\n")
        return parts[1] if len(parts) > 2 else ""

    def lineage_file(self):
        return Path(self.kb, ".lineage.json")

    def run_cli(self, *args):
        """Drive the script the way the fold does — a subprocess with an exit code.

        The exit code is the only thing a cron/`set -e` caller can act on, so it is part of
        the contract, not an implementation detail.
        """
        return subprocess.run(
            [sys.executable, os.path.join(self.kb, ".learnings_wiki.py"), *args],
            capture_output=True, text=True, env=dict(os.environ, WIKI_KB_ROOT=self.kb))


class TestSupersessionSurvivesRebuild(Fold):
    def test_a_retired_atom_stays_retired_across_a_second_build(self):
        # THE regression. Fold once, retire the old atom, fold again.
        self.build()
        self.retire("1754300000001-old-spirv-rule", "1754300000002-new-spirv-rule")
        self.assertIn("superseded_by:", self.wiki_page("1754300000001-old-spirv-rule"))

        self.build()  # second fold — this used to destroy the marker

        page = self.wiki_page("1754300000001-old-spirv-rule")
        self.assertIn("superseded_by: 1754300000002-new-spirv-rule", page,
                      "the retirement was erased by the rebuild")

    def test_finalize_does_not_report_a_retired_atom_as_uncovered(self):
        # The consequence: an un-retired atom reappears as UNCOVERED, and the fold is
        # instructed to fold it back in — resurrecting the superseded concept.
        self.build()
        self.retire("1754300000001-old-spirv-rule", "1754300000002-new-spirv-rule")
        self.concept_citing("1754300000002-new-spirv-rule")
        self.build()
        out = self.finalize()
        self.assertNotIn("UNCOVERED wiki/learnings/1754300000001-old-spirv-rule.md", out)
        self.assertIn("1 superseded, excluded", out)

    def test_a_live_atom_is_still_reported_as_uncovered(self):
        # Guards the guard: if everything were treated as superseded, the test above
        # would pass for the wrong reason.
        self.build()
        self.concept_citing("1754300000002-new-spirv-rule")
        out = self.finalize()
        self.assertIn("UNCOVERED wiki/learnings/1754300000001-old-spirv-rule.md", out)

    def test_lineage_survives_a_full_wiki_wipe(self):
        # `rm -rf wiki/concepts/*` + rebuild is the documented full-rebuild path, and a
        # bare `rm -rf wiki/` is what an operator reaches for. Neither may lose lineage.
        self.build()
        self.retire("1754300000001-old-spirv-rule", "1754300000002-new-spirv-rule")
        self.build()
        import shutil
        shutil.rmtree(os.path.join(self.kb, "wiki"))
        self.build()
        self.assertIn("superseded_by: 1754300000002-new-spirv-rule",
                      self.wiki_page("1754300000001-old-spirv-rule"))

    def test_a_marker_written_on_the_l1_atom_is_honoured_too(self):
        # L1 is documented immutable, but if an agent writes it there anyway the marker
        # must not be silently ignored.
        atom(self.kb, "1754300000003-third-rule", "Third rule",
             superseded_by="1754300000002-new-spirv-rule")
        self.build()
        self.assertIn("superseded_by: 1754300000002-new-spirv-rule",
                      self.wiki_page("1754300000003-third-rule"))

    def test_the_l1_marker_wins_over_stale_lineage(self):
        # Same precedence rule the `topic:` field already uses.
        #
        # The corrected target is a REAL atom, and the assertion reads the page's own
        # frontmatter. Neither used to be true: the target was fictional and the assertion
        # matched the L1 frontmatter that build() copies verbatim into the page body, so
        # this passed without the page ever being marked.
        atom(self.kb, "1754300000009-corrected", "Corrected rule")
        self.build()
        self.retire(OLD, NEW)
        self.build()
        atom(self.kb, OLD, "Old SPIRV rule", superseded_by="1754300000009-corrected")
        self.build()
        self.assertIn("superseded_by: 1754300000009-corrected", self.frontmatter(OLD))


class TestLineageState(Fold):
    def lineage(self):
        return json.loads(Path(self.kb, ".lineage.json").read_text())["superseded_by"]

    def test_lineage_is_recorded_in_structured_state(self):
        self.build()
        self.retire("1754300000001-old-spirv-rule", "1754300000002-new-spirv-rule")
        self.build()
        self.assertEqual(self.lineage()["1754300000001-old-spirv-rule"],
                         "1754300000002-new-spirv-rule")

    def test_lineage_is_merged_forward_never_replaced(self):
        # A build against a partially-wiped tree must not conclude nothing was superseded.
        self.build()
        self.retire("1754300000001-old-spirv-rule", "1754300000002-new-spirv-rule")
        self.build()
        os.remove(os.path.join(self.kb, "wiki", "learnings", "1754300000001-old-spirv-rule.md"))
        self.build()
        self.assertIn("1754300000001-old-spirv-rule", self.lineage())

    def test_lineage_is_written_atomically(self):
        self.build()
        leftovers = [p.name for p in Path(self.kb).glob(".lineage.*.tmp")]
        self.assertEqual(leftovers, [])


class TestCorruptLineageIsNotAnEmptyLineage(Fold):
    """MISSING and CORRUPT are different states and must stop being collapsed into one.

    The previous contract was "a bad read degrades, it does not stop the fold" — but the
    caller does not merely read, it then REPLACES .lineage.json with what it read. So a
    truncated write or a stray edit was silently converted into "nothing was ever
    superseded", and the retirement was gone from the only place that still held it.
    """

    def retired_state(self):
        """A healthy KB with one durable retirement, and the bytes that record it."""
        self.build()
        self.retire(OLD, NEW)
        self.build()
        good = self.lineage_file().read_text(encoding="utf-8")
        self.assertIn(OLD, good)
        return good

    def assert_refused_and_preserved(self, bad):
        refused = False
        try:
            self.build()
        except Exception:
            refused = True
        # THE assertion. Everything else is diagnosis.
        self.assertEqual(self.lineage_file().read_text(encoding="utf-8"), bad,
                         "a failed lineage read overwrote the only record of what was retired")
        self.assertTrue(refused, "the build continued with an empty lineage after a failed read")

    def test_corrupt_lineage_plus_a_wiki_wipe_does_not_destroy_the_record(self):
        # The documented worst case: the durable record is unreadable AND the generated
        # pages that carried the same markers are gone, so nothing else holds the
        # retirement. Overwriting here resurrects a deliberately retired concept.
        good = self.retired_state()
        bad = '{"superseded_by": {"1754300'          # a torn write
        self.lineage_file().write_text(bad, encoding="utf-8")
        shutil.rmtree(os.path.join(self.kb, "wiki"))
        self.assert_refused_and_preserved(bad)
        self.assertTrue(Path(self.kb, ".lineage.recovery.json").exists(),
                        "no separately-named recovery candidate was written")
        # And the operator can get back to a working KB by restoring the record.
        self.lineage_file().write_text(good, encoding="utf-8")
        self.build()
        self.assertIn(f"superseded_by: {NEW}", self.frontmatter(OLD))

    def test_wrong_shaped_lineage_is_refused_not_silently_emptied(self):
        # Valid JSON, wrong schema: `superseded_by` is a list, not a stem->stem map. The
        # old reader ran it through dict(), took the exception as "no lineage", and wrote.
        self.retired_state()
        bad = json.dumps({"superseded_by": [OLD, NEW]})
        self.lineage_file().write_text(bad, encoding="utf-8")
        self.assert_refused_and_preserved(bad)

    def test_wrong_typed_values_are_refused(self):
        # dict() ACCEPTS this shape, so it did not even raise — the builder went on to
        # stamp `superseded_by: {'target': ...}` into page frontmatter.
        self.retired_state()
        bad = json.dumps({"superseded_by": {OLD: {"target": NEW}}})
        self.lineage_file().write_text(bad, encoding="utf-8")
        self.assert_refused_and_preserved(bad)

    def test_a_v1_lineage_file_still_loads(self):
        # Guards the guard: fail-closed must not mean fail-on-everything. The shipped
        # on-disk format has no `version` key and is not corrupt.
        self.build()
        self.lineage_file().write_text(json.dumps({"superseded_by": {OLD: NEW}}), encoding="utf-8")
        self.build()
        self.assertIn(f"superseded_by: {NEW}", self.frontmatter(OLD))


class TestLineageIsValidatedAsAGraph(Fold):
    """A `superseded_by` value used to be trusted for being TRUTHY.

    finalize() excluded the source atom from coverage on that basis alone, so a typo, a
    self-link or an A<->B pair turned a live learning into a permanent "superseded,
    excluded" success: unreachable knowledge, and a report that still said full coverage.
    """

    def test_a_missing_target_stem_does_not_retire_the_atom(self):
        self.build()
        self.retire(OLD, "1754300000099-does-not-exist")   # one-character-class typo
        self.concept_citing(NEW)
        self.build()
        out = self.finalize()
        self.assertIn("LINEAGE-ERROR missing_target", out)
        self.assertIn("0 superseded, excluded", out)
        self.assertIn(f"UNCOVERED wiki/learnings/{OLD}.md", out)

    def test_a_self_link_does_not_retire_the_atom(self):
        self.build()
        self.retire(OLD, OLD)
        self.concept_citing(NEW)
        self.build()
        out = self.finalize()
        self.assertIn("LINEAGE-ERROR self_link", out)
        self.assertIn("0 superseded, excluded", out)
        self.assertIn(f"UNCOVERED wiki/learnings/{OLD}.md", out)

    def test_an_a_to_b_cycle_retires_neither_atom(self):
        # Both atoms pointing at each other used to remove BOTH from the wiki's live set:
        # coverage 0/0, "2 superseded, excluded", and no way to reach either learning.
        self.build()
        self.retire(OLD, NEW)
        self.retire(NEW, OLD)
        self.build()
        out = self.finalize()
        self.assertEqual(out.count("LINEAGE-ERROR cycle"), 2, out)
        self.assertIn("0 superseded, excluded", out)
        for stem in (OLD, NEW):
            self.assertIn(f"UNCOVERED wiki/learnings/{stem}.md", out)

    def test_a_rejected_marker_is_not_stamped_back_onto_the_page(self):
        # If build() re-wrote the bad marker, finalize() would read it back and exclude the
        # atom anyway — the validation would be decorative.
        self.build()
        self.retire(OLD, "1754300000099-does-not-exist")
        self.build()
        self.assertNotIn("superseded_by:", self.frontmatter(OLD))

    def test_a_rejected_edge_is_reported_on_every_later_run(self):
        # build() deletes the page carrying the bad marker, so a one-shot warning would
        # erase the evidence of the thing that hid the atom. It is durable in `rejected`.
        self.build()
        self.retire(OLD, "1754300000099-does-not-exist")
        self.build()
        self.build()
        self.assertIn("LINEAGE-ERROR missing_target", self.finalize())
        self.assertIn("LINEAGE-ERROR missing_target", self.finalize())

    def test_an_empty_corpus_is_refused_rather_than_rejecting_everything(self):
        # Guards a hazard this validation ITSELF introduces (so it is not F12 evidence):
        # with no L1 stems every target looks missing, and the result is persisted — a
        # wrong WIKI_KB_ROOT would durably convert a healthy record into all-rejected.
        self.build()
        self.retire(OLD, NEW)
        self.build()
        before = self.lineage_file().read_text(encoding="utf-8")
        shutil.rmtree(os.path.join(self.kb, "learnings"))
        with self.assertRaises(self.lw.LineageError):
            self.finalize()
        self.assertEqual(self.lineage_file().read_text(encoding="utf-8"), before)

    def test_a_valid_retirement_is_still_excluded(self):
        # Guards the guard: if validation rejected everything, the tests above would pass
        # for the wrong reason.
        self.build()
        self.retire(OLD, NEW)
        self.concept_citing(NEW)
        self.build()
        out = self.finalize()
        self.assertIn("1 superseded, excluded", out)
        self.assertNotIn("LINEAGE-ERROR", out)


class TestCorrectionPath(Fold):
    """A wrong retirement used to be unrecoverable through the tool.

    Deleting the lineage entry is not enough when the marker sits on an L1 atom: L1 is
    documented immutable, and the next harvest re-applies it. So the correction is a
    tombstone that vetoes exactly the target it reverted.
    """

    def test_a_bad_retirement_can_be_undone_and_stays_undone(self):
        atom(self.kb, THIRD, "Third rule", superseded_by=NEW)   # the marker on immutable L1
        self.build()
        self.assertIn("1 superseded, excluded", self.finalize())

        self.assertEqual(self.lw.unretire([THIRD]), 0)

        self.build()
        self.build()          # the L1 marker is still there; the veto must survive a rebuild
        out = self.finalize()
        self.assertIn("0 superseded, excluded", out)
        self.assertIn(f"UNCOVERED wiki/learnings/{THIRD}.md", out)
        self.assertNotIn("superseded_by:", self.frontmatter(THIRD))

    def test_unretire_reports_when_there_is_nothing_to_undo(self):
        # A correction that silently no-ops is the same defect in a smaller box.
        self.build()
        self.assertNotEqual(self.lw.unretire([OLD]), 0)

    def test_re_retiring_with_a_different_target_overrides_the_tombstone(self):
        atom(self.kb, THIRD, "Third rule", superseded_by=NEW)
        self.build()
        self.lw.unretire([THIRD])
        atom(self.kb, THIRD, "Third rule", superseded_by=OLD)   # a DIFFERENT, deliberate target
        self.build()
        self.assertIn("1 superseded, excluded", self.finalize())

    def test_retire_refuses_an_invalid_target_at_write_time(self):
        self.build()
        self.assertNotEqual(self.lw.retire([OLD, "1754300000099-does-not-exist"]), 0)
        self.assertNotEqual(self.lw.retire([OLD, OLD]), 0)
        self.assertEqual(json.loads(self.lineage_file().read_text())["superseded_by"], {})

    def test_retire_records_a_valid_one(self):
        self.build()
        self.assertEqual(self.lw.retire([OLD, NEW]), 0)
        self.build()
        self.assertIn(f"superseded_by: {NEW}", self.frontmatter(OLD))


class TestProcessBoundary(Fold):
    """Every new failure path has to reach the caller as an exit code.

    The fold runs these as bash steps on a timer. A failure that only prints is a failure
    that nothing acts on — and the dispatcher used to run finalize() for ANY unrecognized
    word, so even a typo exited 0.
    """

    def test_corrupt_lineage_exits_non_zero(self):
        self.build()
        self.lineage_file().write_text("{not json", encoding="utf-8")
        r = self.run_cli("build")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("LINEAGE-FATAL", r.stderr)

    def test_a_broken_lineage_graph_exits_non_zero(self):
        self.build()
        self.retire(OLD, "1754300000099-does-not-exist")
        r = self.run_cli("build")
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        self.assertEqual(self.run_cli("finalize").returncode, 3)

    def test_a_healthy_tree_exits_zero(self):
        self.assertEqual(self.run_cli("build").returncode, 0)
        self.assertEqual(self.run_cli("finalize").returncode, 0)

    def test_an_unknown_command_is_refused_not_run_as_finalize(self):
        # Build first, so the wrong command SUCCEEDS: `(build if cmd == "build" else
        # finalize)()` ran finalize for any typo and exited 0, reporting coverage for a
        # command nobody asked for.
        self.build()
        r = self.run_cli("buidl")
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn("unknown command", r.stderr)


class TestBuildStillWorks(Fold):
    def test_concept_pages_are_preserved_across_a_build(self):
        # The existing contract, unchanged — pinned so the lineage work cannot break it.
        self.build()
        self.concept_citing("1754300000002-new-spirv-rule")
        self.build()
        self.assertTrue(Path(self.kb, "wiki", "concepts", "slang-backends.md").exists())

    def test_an_explicit_topic_on_the_atom_still_wins(self):
        atom(self.kb, "1754300000004-routed", "Routed thing", topic="ci-tooling")
        self.build()
        self.assertIn("topic: ci-tooling", self.wiki_page("1754300000004-routed"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
