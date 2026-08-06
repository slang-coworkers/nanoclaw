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
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent / "SKILL.md"


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
        self.build()
        self.retire("1754300000001-old-spirv-rule", "1754300000002-new-spirv-rule")
        self.build()
        atom(self.kb, "1754300000001-old-spirv-rule", "Old SPIRV rule",
             superseded_by="1754300000009-corrected")
        self.build()
        self.assertIn("superseded_by: 1754300000009-corrected",
                      self.wiki_page("1754300000001-old-spirv-rule"))


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

    def test_corrupt_lineage_does_not_break_the_build(self):
        # Lineage is additive evidence, not a gate. A bad read degrades, it does not stop
        # the fold.
        Path(self.kb, ".lineage.json").write_text("{not json")
        self.build()
        self.assertTrue(Path(self.kb, "wiki", "index.md").exists())

    def test_lineage_is_written_atomically(self):
        self.build()
        leftovers = [p.name for p in Path(self.kb).glob(".lineage.*.tmp")]
        self.assertEqual(leftovers, [])


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
