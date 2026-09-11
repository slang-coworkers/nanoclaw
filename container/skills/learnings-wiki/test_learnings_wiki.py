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

import contextlib
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent / "SKILL.md"

OLD = "1754300000001-old-spirv-rule"
NEW = "1754300000002-new-spirv-rule"
THIRD = "1754300000003-third-rule"


def load_builder(kb_root):
    """Extract the embedded python from SKILL.md and import it against a KB root."""
    blocks = re.findall(r"```python\n(.*?)```", SKILL.read_text(encoding="utf-8"), re.DOTALL)
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
            capture_output=True, text=True, check=False,
            env=dict(os.environ, WIKI_KB_ROOT=self.kb))


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
        except Exception:  # noqa: BLE001 — "refused" means refused for ANY reason;
            # naming types here would let a NEW failure mode read as a clean build,
            # which is the exact regression this test exists to catch.
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


class TestDiscoveryCoversAuthorSubdirs(Fold):
    """Since PR #1171 (2026-08-10) the host writes atoms to learnings/<agent-group-id>/; the
    builder used a non-recursive glob and silently dropped every one of them (1,823 of 5,801
    on prod by 2026-09-08) while `finalize` reported "0 uncovered"."""

    def nested(self, stem, title, body="Nested content.", **frontmatter):
        d = Path(self.kb, "learnings", "ag-1234-author")
        d.mkdir(exist_ok=True)
        fm = "".join(f"{k}: {v}\n" for k, v in frontmatter.items())
        head = f"---\n{fm}---\n" if fm else ""
        (d / f"{stem}.md").write_text(f"{head}# {title}\n\n{body}\n", encoding="utf-8")

    def test_an_atom_in_a_per_author_subdir_is_built(self):
        self.nested(THIRD, "Third rule")
        self.build()
        self.assertTrue(Path(self.kb, "wiki", "learnings", f"{THIRD}.md").exists())
        self.assertTrue(Path(self.kb, "sources", "learnings", f"{THIRD}.md").exists())
        self.assertIn(THIRD, self.lw.l1_stems())

    def test_index_md_is_never_an_atom_at_any_depth(self):
        Path(self.kb, "learnings", "INDEX.md").write_text("# index\n", encoding="utf-8")
        Path(self.kb, "learnings", "ag-1234-author").mkdir()
        Path(self.kb, "learnings", "ag-1234-author", "INDEX.md").write_text("# index\n", encoding="utf-8")
        self.build()
        self.assertFalse(Path(self.kb, "wiki", "learnings", "INDEX.md").exists())
        self.assertNotIn("INDEX", {s.upper() for s in self.lw.l1_stems()})

    def test_a_marker_written_on_a_nested_atom_is_honoured(self):
        self.nested(THIRD, "Third rule", superseded_by=NEW)
        self.build()
        self.concept_citing(NEW)
        out = self.finalize()
        self.assertNotIn(f"UNCOVERED wiki/learnings/{THIRD}.md", out)
        self.assertIn("1 superseded, excluded", out)

    def test_a_nested_live_atom_is_reported_as_uncovered(self):
        # Guards the guard: the nested atom must be SEEN to be reported.
        self.nested(THIRD, "Third rule")
        self.build()
        self.concept_citing(OLD, NEW)
        out = self.finalize()
        self.assertIn(f"UNCOVERED wiki/learnings/{THIRD}.md", out)

    def test_duplicate_stems_across_dirs_keep_the_first_and_say_so(self):
        # Same stem in the flat dir and an author dir: basename order ties, path order decides;
        # the shadowed copy is reported instead of silently overwriting the L3 page.
        self.nested(OLD, "Old SPIRV rule (author copy)", body="Different body.")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.lw.build()
        self.assertIn(f"DUPLICATE-STEM {OLD}", out.getvalue())
        page = self.wiki_page(OLD)
        self.assertIn("Some content about spirv codegen.", page)   # the flat copy (sorts first) won
        self.assertNotIn("Different body.", page)

    def test_gate_wakes_on_a_fresh_kb_and_sleeps_after_a_build_with_nothing_new(self):
        r = self.run_cli("gate")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(json.loads(r.stdout)["wakeAgent"])          # no wiki yet → every atom is new
        old = time.time() - 3600
        for p in Path(self.kb, "learnings").rglob("*.md"):
            os.utime(p, (old, old))
        self.build()                                                 # index.md is now newer than every atom
        r = self.run_cli("gate")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse(json.loads(r.stdout)["wakeAgent"])         # 2 uncovered ≤ 60, nothing new
        self.nested(THIRD, "Third rule")                             # a NEW nested atom must wake it
        r = self.run_cli("gate")
        payload = json.loads(r.stdout)
        self.assertTrue(payload["wakeAgent"])
        self.assertEqual(payload["data"]["new_learnings"], 1)


# --------------------------------------------------------------------------- wiki v2
# Synthesis by MEANING: a vocabulary this KB owns rather than one baked into the script,
# pages named after a subtopic rather than after a split point, and the four measurements a
# size-driven fold cannot make about itself.

PR_A = "1754300000010-pr-head-binding"
PR_B = "1754300000011-pr-head-binding-sha"
KANBAN = "1754300000013-kanban-dispatch"
CORRECTION = "1754300000014-correction-cache-path"


class WikiV2(Fold):
    """Fold, plus a config file, concept pages written by NAME, and the index."""

    def write_config(self, **cfg):
        """Write <ROOT>/.wiki-config.json and re-import the builder against it.

        Re-import rather than poke the loaded module: the fold runs the script as a fresh
        process every time, so import-time binding is the path that has to work.
        """
        Path(self.kb, ".wiki-config.json").write_text(
            json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
        self.lw = load_builder(self.kb)

    def concept(self, name, group="slang-backends", *stems):
        d = Path(self.kb, "wiki", "concepts")
        d.mkdir(parents=True, exist_ok=True)
        rows = "\n".join(f"- [x](wiki/learnings/{s}.md)" for s in stems)
        (d / f"{name}.md").write_text(
            f'---\ntitle: "{name}"\ntype: concept\ngroup: {group}\n---\n\n'
            f"## TL;DR\n\nRules.\n\n**Source learnings ({len(stems)}):**\n{rows}\n",
            encoding="utf-8")

    def index(self):
        return Path(self.kb, "wiki", "index.md").read_text(encoding="utf-8")

    def ingest(self, group):
        return Path(self.kb, ".ingest", f"{group}.txt").read_text(encoding="utf-8")

    def build_output(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.lw.build()
        return out.getvalue()


class TestVocabularyIsConfigurable(WikiV2):
    """The buckets and the index title used to be Slang literals in the script, so a second
    corpus (Hermes: plugin, gateway, podman, kanban, a2a) landed wholesale in misc. They now
    come from <ROOT>/.wiki-config.json -- and a KB that ships no such file must be unchanged,
    because prod is exactly that KB."""

    def test_no_config_keeps_the_slang_index_and_classification(self):
        self.build()
        self.assertIn('title: "Slang-Coworkers Learnings — Index"', self.index())
        self.assertIn("# Slang-Coworkers Learnings Wiki", self.index())
        self.assertIn("topic: slang-compiler", self.frontmatter(OLD))
        self.assertIn(OLD, self.ingest("slang-backends"))

    def test_a_configured_title_description_topic_and_group_are_used(self):
        self.write_config(
            title="nemoclaw-coworkers Learnings — Index",
            description="Hermes coworker learnings, folded nightly.",
            topics=[["hermes-runtime", "Hermes runtime", ["kanban", "gateway"]]],
            groups=[["hermes-runtime", ["kanban", "gateway"]]],
            group_labels={"hermes-runtime": "Hermes runtime"})
        atom(self.kb, KANBAN, "Kanban dispatch keeps the gateway warm")
        self.build()
        self.finalize()
        self.assertIn('title: "nemoclaw-coworkers Learnings — Index"', self.index())
        self.assertIn("# nemoclaw-coworkers Learnings Wiki", self.index())
        self.assertIn("Hermes coworker learnings, folded nightly.", self.index())
        self.assertIn("topic: hermes-runtime", self.frontmatter(KANBAN))
        self.assertIn(KANBAN, self.ingest("hermes-runtime"))
        # Replaced, not merged: the Slang keywords are not this KB's vocabulary.
        self.assertIn("topic: misc", self.frontmatter(OLD))

    def test_an_unknown_group_still_gets_its_own_index_heading(self):
        # The fold may extend the vocabulary mid-run by filing a page under a new group. A
        # page whose group the builder has never heard of must still be reachable from the
        # index, or the fold's own extension silently hides it.
        self.build()
        self.concept("hermes-plugin-doctor", "hermes-plugins", NEW)
        self.finalize()
        self.assertIn("### hermes-plugins", self.index())
        self.assertIn("(wiki/concepts/hermes-plugin-doctor.md)", self.index())

    def test_a_malformed_config_falls_back_to_the_defaults(self):
        # Unlike .lineage.json the config holds no unique state -- every value in it is in
        # the file itself -- so a typo must cost one run's bucketing, not the whole fold.
        Path(self.kb, ".wiki-config.json").write_text("{not json", encoding="utf-8")
        self.lw = load_builder(self.kb)
        self.assertIn("WIKI-CONFIG-ERROR", self.build_output())
        self.assertIn('title: "Slang-Coworkers Learnings — Index"', self.index())


class TestShapeReports(WikiV2):
    """Prod had 66 numbered pages, 3 lineage edges against 251 self-declared corrections, and
    ~1.5 KB of concept text per live atom -- and finalize reported none of it, so the fold had
    no way to see that it was inventorying rather than synthesizing."""

    def test_numbered_pages_are_flagged_and_named_pages_are_not(self):
        self.build()
        self.concept("review-pr-head-binding", "review-process", NEW)
        self.concept("review-pr-practices-1", "review-process", OLD)
        self.concept("review-pr-practices-2", "review-process", OLD)
        # A trailing number is not a split: this one is named for the glibc it is about, has
        # no sibling, and renaming it would dangle every inbound concept link. The list is
        # sorted and the fold takes the FIRST family, so a false positive here eats the whole
        # per-run consolidation budget.
        self.concept("ci-tooling-glibc-2-34", "ci-tooling", NEW)
        out = self.finalize()
        self.assertIn("NUMBERED-SPLIT wiki/concepts/review-pr-practices-1.md", out)
        self.assertIn("NUMBERED-SPLIT wiki/concepts/review-pr-practices-2.md", out)
        self.assertNotIn("NUMBERED-SPLIT wiki/concepts/review-pr-head-binding.md", out)
        self.assertNotIn("NUMBERED-SPLIT wiki/concepts/ci-tooling-glibc-2-34.md", out)

    def test_the_lists_are_bounded_and_say_what_was_cut(self):
        # A report that prints 900 lines is a report nobody reads; one that silently prints
        # 40 of 900 is worse, because the fold then believes it saw the whole family.
        self.build()
        for i in range(1, 46):
            self.concept(f"review-pr-practices-{i}", "review-process")
        out = self.finalize()
        self.assertEqual(out.count("  NUMBERED-SPLIT "), 40, out)
        self.assertIn("… and 5 more", out)

    def test_near_identical_titles_surface_as_a_supersession_candidate(self):
        atom(self.kb, PR_A, "Bind review comments to the PR head commit")
        atom(self.kb, PR_B, "Bind review comments to the PR head commit sha")
        atom(self.kb, KANBAN, "Kanban dispatch keeps the gateway warm")
        self.build()
        out = self.finalize()
        self.assertIn(f"CANDIDATE-SUPERSESSION {PR_A} ~ {PR_B} (jaccard=", out)
        # Guards the guard: an unrelated title must pair with nothing, or every run buries
        # the real candidates under noise the fold then learns to ignore.
        self.assertNotIn(f"{KANBAN} ~", out)
        self.assertNotIn(f"~ {KANBAN}", out)

    def test_a_correction_title_surfaces_as_a_candidate(self):
        atom(self.kb, CORRECTION, "Correction: the runner cache path was wrong")
        self.build()
        out = self.finalize()
        self.assertIn(f"CANDIDATE-CORRECTION {CORRECTION}", out)
        self.assertNotIn(f"CANDIDATE-CORRECTION {NEW}", out)

    def test_shape_counts_live_atoms_not_all_of_them(self):
        # bytes_per_atom is the trend line the task posts: it stays flat while the fold
        # synthesizes and climbs while it inventories. Counting retired atoms in the
        # denominator would flatter it for free.
        self.build()
        self.assertIn("SHAPE live_atoms=2 concept_bytes=0 bytes_per_atom=0 "
                      "numbered_pages=0 over_cap=0", self.finalize())
        self.retire(OLD, NEW)
        self.build()
        self.concept("slang-backends-spirv", "slang-backends", NEW)
        self.assertRegex(self.finalize(),
                         r"SHAPE live_atoms=1 concept_bytes=[1-9]\d* bytes_per_atom=[1-9]\d* "
                         r"numbered_pages=0 over_cap=0")

    def test_a_dominant_token_does_not_deflate_the_similarity_score(self):
        # The inverted index BLOCKS, it does not score. Tokens above df_cap are skipped as
        # index entries; counting one in the union but never in the intersection pushed real
        # pairs under the threshold, and the tokens that get pruned on prod are exactly the
        # corpus's dominant themes (approver, review, session) — so the queue went blind
        # precisely where the duplicates are. df_cap is injected because the fixtures are
        # tens of atoms and the real cap floors at 50, so the pruning branch never runs.
        toks = self.lw._title_tokens
        items = [("1754300000101-rulebook", toks("Approver calibration drift rulebook")),
                 ("1754300000102-rulebook-policy",
                  toks("Approver calibration drift rulebook policy"))]
        items += [(f"17543000002{i:02d}-filler", toks(f"Approver note number {i} on widgets"))
                  for i in range(4)]
        pairs, truncated = self.lw._supersession_candidates(items, df_cap=2)
        self.assertFalse(truncated)
        self.assertIn((0.8, "1754300000101-rulebook", "1754300000102-rulebook-policy"), pairs)


class TestKeysCannotEscapeTheKb(WikiV2):
    """Topic and group keys become filenames (wiki/topics/<key>.md, .ingest/<key>.txt) and
    both arrive from data an agent writes: an atom's frontmatter and the KB's config."""

    def test_a_topic_line_in_an_atom_cannot_overwrite_a_concept_page(self):
        # `fm()` searches the whole atom, not just its frontmatter, so a learning ABOUT the
        # wiki is enough. Concept pages are the one class of file build()'s delete sweep
        # preserves, so overwriting one destroys synthesis that nothing else holds.
        self.build()
        self.concept("slang-backends-spirv", "slang-backends", NEW)
        page = Path(self.kb, "wiki", "concepts", "slang-backends-spirv.md")
        before = page.read_bytes()
        atom(self.kb, "1754300000020-about-the-wiki", "How topic frontmatter works",
             body="An atom may quote a line like\ntopic: ../concepts/slang-backends-spirv\n"
                  "while explaining it.")
        out = self.build_output()
        self.assertIn("BAD-TOPIC 1754300000020-about-the-wiki", out)
        self.assertEqual(page.read_bytes(), before)
        self.assertIn("topic: misc", self.frontmatter("1754300000020-about-the-wiki"))

    def escapee(self, kind):
        """A sentinel outside the KB, named after this KB so the assertion cannot be
        satisfied (or defeated) by a file another run left in the shared temp dir."""
        return Path(self.kb).parent / f"{kind}-{os.path.basename(self.kb)}.md"

    def test_a_topic_cannot_write_outside_the_kb_root(self):
        # wiki/topics/<topic>.md, so three levels up lands beside the KB root.
        target = self.escapee("PWNED")
        atom(self.kb, "1754300000021-escape", "Escape", topic=f"../../../{target.stem}")
        self.build_output()
        self.assertFalse(target.exists())
        self.assertNotIn(target.stem, self.index())

    def test_a_config_key_that_is_not_a_page_name_is_refused(self):
        # The config is agent-writable by design (the fold is told to extend the vocabulary),
        # so it is the same door reached through the mechanism the feature advertises.
        target = self.escapee("CFGGROUP").with_suffix(".txt")
        self.write_config(groups=[[f"../../{target.stem}", ["spirv"]]])
        out = self.build_output()
        self.assertIn("WIKI-CONFIG-ERROR", out)
        self.assertFalse(target.exists())
        self.assertIn(OLD, self.ingest("slang-backends"))   # default vocabulary, unchanged


if __name__ == "__main__":
    unittest.main(verbosity=2)
