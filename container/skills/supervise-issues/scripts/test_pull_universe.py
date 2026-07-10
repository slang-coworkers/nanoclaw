#!/usr/bin/env python3
"""Tests for pull-universe.sh's GraphQL salvage logic.

The enrichment step lives inside a bash heredoc, so we can't import it. Instead
we extract the `gh_graphql` function body from the script and exercise it with a
mocked `subprocess.run`, pinning the exact bug that caused the "1/147 PRs"
enrichment collapse: `gh api graphql` exits non-zero on GraphQL *partial
success* (HTTP 200 with a valid `data` object AND an `errors` array, e.g. when a
few aliased numbers don't resolve). The old code treated rc!=0 as total failure
and discarded the whole batch. gh_graphql must now SALVAGE the data.

Run: python3 test_pull_universe.py
"""

import re
import sys
import types
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "pull-universe.sh"


def load_gh_graphql():
    """Extract the gh_graphql def from the shell script and compile it into a
    module with a controllable `subprocess` and `sys` (for stderr capture)."""
    src = SCRIPT.read_text()
    m = re.search(r"^def gh_graphql\(query\):.*?(?=\n^def )", src,
                  re.DOTALL | re.MULTILINE)
    assert m, "could not locate gh_graphql() in pull-universe.sh"
    mod = types.ModuleType("pu_graphql")
    # json is a real import the function relies on.
    import json as _json
    mod.json = _json
    mod.sys = sys
    exec(compile(m.group(0), "gh_graphql", "exec"), mod.__dict__)
    return mod


class FakeCompleted:
    def __init__(self, returncode, stdout, stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class GraphqlSalvage(unittest.TestCase):
    def setUp(self):
        self.mod = load_gh_graphql()

    def _patch(self, completed):
        fake_sub = types.SimpleNamespace(run=lambda *a, **k: completed)
        self.mod.subprocess = fake_sub

    def test_clean_success(self):
        self._patch(FakeCompleted(0, '{"data": {"repository": {"i1": {"state": "OPEN"}}}}'))
        out = self.mod.gh_graphql("{ q }")
        self.assertIsNotNone(out)
        self.assertEqual(out["data"]["repository"]["i1"]["state"], "OPEN")

    def test_partial_success_is_salvaged(self):
        # THE #1/147 BUG: rc=1, but valid data present alongside NOT_FOUND errors.
        body = (
            '{"data": {"repository": {"i1": {"state": "OPEN"}, "i9085": null}},'
            ' "errors": [{"type": "NOT_FOUND", "path": ["repository", "i9085"],'
            ' "message": "Could not resolve to an Issue with the number of 9085."}]}'
        )
        self._patch(FakeCompleted(1, body, "gh: Could not resolve..."))
        out = self.mod.gh_graphql("{ q }")
        self.assertIsNotNone(out, "partial-success data must be salvaged, not discarded")
        self.assertEqual(out["data"]["repository"]["i1"]["state"], "OPEN")

    def test_total_failure_returns_none(self):
        # Genuine failure: non-zero exit AND no usable data -> None (REST fallback).
        self._patch(FakeCompleted(1, "", "some transport error"))
        self.assertIsNone(self.mod.gh_graphql("{ q }"))

    def test_unparseable_stdout_returns_none(self):
        self._patch(FakeCompleted(0, "not json at all"))
        self.assertIsNone(self.mod.gh_graphql("{ q }"))

    def test_data_null_returns_none(self):
        # data: null with only errors -> nothing to salvage.
        self._patch(FakeCompleted(1, '{"data": null, "errors": [{"message": "x"}]}'))
        self.assertIsNone(self.mod.gh_graphql("{ q }"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
