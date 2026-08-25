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
    # The function under test lives inside pull-universe.sh and has no importable
    # form. Executing the extracted source is the only way to test the real thing
    # rather than a copy that can drift from it.
    exec(compile(m.group(0), "gh_graphql", "exec"), mod.__dict__)  # noqa: S102
    return mod


def load_cost_status():
    """Extract cost_status() from pull-universe.sh's Step 1b heredoc (the
    per-session cost-cap stamping step) into a module with a controllable
    `subprocess`, mirroring load_gh_graphql()'s extraction style."""
    src = SCRIPT.read_text()
    start = src.index("def cost_status(session_id):")
    end = src.index("stopped = 0")
    mod = types.ModuleType("pu_cost_status")
    # json is a real import the function relies on.
    import json as _json
    mod.json = _json
    exec(compile(src[start:end], "cost_status", "exec"), mod.__dict__)  # noqa: S102
    return mod


def load_classify_error_text():
    """Extract classify_error_text() (+ its signature-list module globals) from
    the Step-4b heredoc and compile it standalone."""
    src = SCRIPT.read_text()
    start = src.index("_PERMANENT_SIGNATURES")
    end = src.index("def ncl_last_outbound")
    mod = types.ModuleType("pu_classify")
    exec(compile(src[start:end], "classify_error_text", "exec"), mod.__dict__)  # noqa: S102
    return mod.classify_error_text


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


class CostStatusStamping(unittest.TestCase):
    """Step 1b stamps `cost_status` onto every gh-issue session via `ncl
    cost-cap status`, so scan.py can distinguish a session that's merely idle
    from one deliberately `stopped` pending a human cost decision (see
    scan.py::any_session_cost_stopped). The live ncl round-trip needs a
    running container (covered by the skill's own smoke run); these tests pin
    the pure parsing/fallback logic — every non-clean-success path must
    degrade to 'unknown', never raise — plus the wiring order structurally."""

    def setUp(self):
        self.mod = load_cost_status()

    def _patch(self, completed=None, raises=None):
        if raises is not None:
            def run(*_a, **_k):
                raise raises
            self.mod.subprocess = types.SimpleNamespace(run=run)
        else:
            self.mod.subprocess = types.SimpleNamespace(run=lambda *a, **k: completed)

    def test_stopped_status_is_reported(self):
        self._patch(FakeCompleted(0, '{"data": {"status": "stopped"}}'))
        self.assertEqual(self.mod.cost_status("sess-1"), "stopped")

    def test_ok_status_is_reported(self):
        self._patch(FakeCompleted(0, '{"data": {"status": "ok"}}'))
        self.assertEqual(self.mod.cost_status("sess-1"), "ok")

    def test_nonzero_returncode_is_unknown(self):
        self._patch(FakeCompleted(1, ""))
        self.assertEqual(self.mod.cost_status("sess-1"), "unknown")

    def test_empty_stdout_is_unknown(self):
        self._patch(FakeCompleted(0, "   "))
        self.assertEqual(self.mod.cost_status("sess-1"), "unknown")

    def test_unparseable_json_is_unknown(self):
        self._patch(FakeCompleted(0, "not json"))
        self.assertEqual(self.mod.cost_status("sess-1"), "unknown")

    def test_missing_status_field_is_unknown(self):
        self._patch(FakeCompleted(0, '{"data": {}}'))
        self.assertEqual(self.mod.cost_status("sess-1"), "unknown")

    def test_missing_data_field_is_unknown(self):
        self._patch(FakeCompleted(0, '{"ok": true}'))
        self.assertEqual(self.mod.cost_status("sess-1"), "unknown")

    def test_subprocess_exception_is_unknown(self):
        # e.g. a subprocess.TimeoutExpired — must degrade, never crash the pull.
        self._patch(raises=RuntimeError("boom"))
        self.assertEqual(self.mod.cost_status("sess-1"), "unknown")

    def test_step1b_runs_before_thread_grouping_and_feeds_final_payload(self):
        # Structural assertion: Step 1b reassigns GH_SESSIONS with cost_status
        # BEFORE Step 2 groups sessions into THREADS, and the SAME (now
        # cost_status-enriched) variable is what Step 5 writes as the
        # payload's "sessions" field — i.e. scan.py actually receives it.
        src = SCRIPT.read_text()
        step1b = src.index('s["cost_status"] = status')
        step2 = src.index('THREADS=$(echo "$GH_SESSIONS"')
        final_write = src.index('> "$TMPD/gh_sessions.json"')
        self.assertLess(step1b, step2, "cost_status stamping must happen before Step 2 groups sessions")
        self.assertLess(step2, final_write)


class ErrorClassification(unittest.TestCase):
    """last_outbound_error_class feeds scan.py's stopped+errored bounce limb.
    Mirror of container/agent-runner/src/transient-error.ts — a bounced a2a
    handoff (the #12097 shape) must classify as transient; a genuine 403 as
    permanent; a novel error as unknown; and a NORMAL reply as None (no false
    positive that would trigger a spurious nudge)."""

    def setUp(self):
        self.cet = load_classify_error_text()

    def test_not_logged_in_is_transient(self):
        self.assertEqual(self.cet("Not logged in · Please run /login"), "transient")

    def test_wrapped_error_result_is_transient(self):
        self.assertEqual(
            self.cet("Error: Claude Code returned an error result: Not logged in · Please run /login"),
            "transient")

    def test_billing_403_is_permanent(self):
        self.assertEqual(self.cet("Error: 403 billing_error: credit balance too low"), "permanent")

    def test_novel_error_is_unknown(self):
        self.assertEqual(self.cet("Error: something totally novel happened"), "unknown")

    def test_normal_reply_mentioning_login_is_not_an_error(self):
        # The critical false-positive guard: a real reply that happens to say
        # "login" must NOT class as an error (would trigger a spurious nudge).
        self.assertIsNone(self.cet("Here is my normal reply about a login button"))

    def test_fix_report_is_not_an_error(self):
        self.assertIsNone(self.cet("[Fix Report] shader-slang/slang#12097: done"))

    def test_empty_is_none(self):
        self.assertIsNone(self.cet(""))
        self.assertIsNone(self.cet(None))


class DispositionRehydration(unittest.TestCase):
    """pull-universe.sh must rehydrate each chain's disposition from the prior
    supervisor-state before scan.py classifies it — without it the HUMAN_OWNED
    gate always sees None and over-flags (the Tick-86 105->1 reconciliation
    noise that gave the LLM license to park the real #12097 nudge). We pin the
    rehydration expression the Step-4b block uses."""

    def test_step4b_rehydrates_prior_disposition(self):
        # Structural assertion: the Step-4b heredoc reads prior_state and copies
        # a prior snapshot's disposition onto the chain. This guards the wiring
        # (the heavy end-to-end path needs live ncl/gh and is covered by the
        # skill's own smoke run).
        src = SCRIPT.read_text()
        self.assertIn("prior_state = json.load", src)
        self.assertIn('prior_snap.get("disposition")', src)
        self.assertIn('chain["disposition"] = prior_snap["disposition"]', src)
        # And the state file is written BEFORE Step 4b runs (not only at Step 5).
        step4b = src.index("INCLUDE_CLOSED=\"$INCLUDE_CLOSED\" python3")
        state_write = src.index('printf \'%s\' "$STATE" > "$TMPD/state.json"')
        self.assertLess(state_write, step4b,
                        "state.json must be written before Step 4b for rehydration")


if __name__ == "__main__":
    unittest.main(verbosity=2)
