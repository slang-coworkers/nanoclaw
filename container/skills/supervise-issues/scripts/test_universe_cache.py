#!/usr/bin/env python3
"""Tests for the cached pull: universe_cache.py and `pull-universe.sh --cache-dir`.

The hourly gate cannot afford a full pull (minutes on prod), so it refetches only
what changed. The risk of a cache is a stale answer, so these tests pin both
halves: the cached pull must produce the same chains as the full pull, and it
must refetch exactly what can have changed:

  * GitHub: chains the per-repo change listing names (directly, through their
    PR's number, or through a PR body that references them); nothing else.
  * outbound: a session whose container is running, or whose last_active moved.
  * a time box that runs out leaves chains `cache_cold`, never silently stale.

The end-to-end cases run the real pull-universe.sh against stub `ncl` and `gh`
executables that serve fixtures and log every call.

Run: python3 test_universe_cache.py
"""

import importlib.util
import json
import os
import subprocess
import tempfile
import textwrap
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("universe_cache", HERE / "universe_cache.py")
uc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(uc)

NOW = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
REPO = "acme/widget"


def thread(num, sessions):
    return {"thread": f"gh-issue-{REPO}-{num}", "repo": REPO, "issue": num, "sessions": sessions}


class PlanGithub(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def cache(self, now=NOW):
        return uc.UniverseCache(self.tmp.name, now)

    def test_first_pull_fetches_every_chain_most_recent_first(self):
        c = self.cache()
        threads = [thread(1, ["a"]), thread(2, ["b"])]
        keys = c.plan_github(threads, {"a": "2026-11-10 00:00", "b": "2026-11-16 11:00"},
                             lister=lambda *_: self.fail("no listing before the first sync"))
        self.assertEqual(keys, [f"{REPO}:2", f"{REPO}:1"])
        self.assertEqual(c.repos[REPO]["synced_at"], "2026-11-16T12:00:00Z")

    def test_only_changed_chains_are_refetched(self):
        c = self.cache()
        c.repos[REPO] = {"synced_at": "2026-11-16T11:00:00Z"}
        for n in (1, 2, 3):
            c.issues[f"{REPO}:{n}"] = {"state": "OPEN", "fetched_at": "2026-11-16T11:00:00Z",
                                       "bot_pr": {"number": 30} if n == 3 else None}
        seen = {}

        def lister(repo, since):
            seen["since"] = since
            return {2, 30}  # issue 2 changed, and chain 3's PR #30 changed

        keys = c.plan_github([thread(1, []), thread(2, []), thread(3, [])], {}, lister=lister)
        self.assertEqual(sorted(keys), [f"{REPO}:2", f"{REPO}:3"])
        # The listing starts SYNC_OVERLAP_S before the last one.
        self.assertEqual(seen["since"], "2026-11-16T10:50:00Z")

    def test_failed_listing_keeps_the_window_and_is_reported(self):
        c = self.cache()
        c.repos[REPO] = {"synced_at": "2026-11-16T11:00:00Z"}
        c.issues[f"{REPO}:1"] = {"state": "OPEN", "fetched_at": "2026-11-16T11:00:00Z"}
        self.assertEqual(c.plan_github([thread(1, [])], {}, lister=lambda *_: None), [])
        self.assertEqual(c.repos[REPO]["synced_at"], "2026-11-16T11:00:00Z")
        self.assertEqual(c.sync_errors, [REPO])

    def test_open_entries_are_refetched_after_max_age_but_closed_ones_are_not(self):
        c = self.cache()
        c.repos[REPO] = {"synced_at": "2026-11-16T11:00:00Z"}
        old = (NOW - timedelta(seconds=uc.MAX_AGE_S + 60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        c.issues[f"{REPO}:1"] = {"state": "OPEN", "fetched_at": old}
        c.issues[f"{REPO}:2"] = {"state": "CLOSED", "fetched_at": old}
        self.assertEqual(c.plan_github([thread(1, []), thread(2, [])], {}, lister=lambda *_: set()),
                         [f"{REPO}:1"])

    def test_malformed_repo_is_never_listed(self):
        c = self.cache()
        bad = {"thread": "gh-issue-acme/widget-1/recovery-7", "repo": "acme/widget-1/recovery",
               "issue": 7, "sessions": []}
        c.repos[bad["repo"]] = {"synced_at": "2026-11-16T11:00:00Z"}
        c.plan_github([bad], {}, lister=lambda *_: self.fail("must not list a malformed repo"))

    def test_repo_refused_while_another_lists_is_out_of_reach_for_a_day(self):
        # Prod: `gh-issue-slang/slang-12371`, a mistyped shader-slang/slang thread, got
        # HTTP 401 on its listing every hour while every other repo listed fine.
        bad = {"thread": "gh-issue-slang/slang-12371", "repo": "slang/slang", "issue": 12371, "sessions": []}
        good = thread(1, [])
        c = self.cache()
        for repo in (REPO, "slang/slang"):
            c.repos[repo] = {"synced_at": "2026-11-16T11:00:00Z"}
        old = (NOW - timedelta(seconds=uc.MAX_AGE_S + 60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        c.issues["slang/slang:12371"] = {"state": "OPEN", "degraded": True, "fetched_at": old}
        c.issues[f"{REPO}:1"] = {"state": "OPEN", "fetched_at": "2026-11-16T11:00:00Z"}
        listed = []

        def lister(repo, since):
            listed.append(repo)
            return uc.UNREACHABLE if repo == "slang/slang" else set()

        self.assertEqual(c.plan_github([bad, good], {}, lister=lister), [])
        self.assertEqual((c.unreachable, c.sync_errors), (["slang/slang"], []))
        self.assertEqual(c.repos["slang/slang"],
                         {"synced_at": "2026-11-16T11:00:00Z", "unreachable_at": "2026-11-16T12:00:00Z"})
        c.save(["slang/slang:12371", f"{REPO}:1"], [], {})

        # An hour later: neither listed nor fetched, and still reported.
        c = self.cache(NOW + timedelta(hours=1))
        listed.clear()
        self.assertEqual(c.plan_github([bad, good], {}, lister=lister), [])
        self.assertEqual((listed, c.unreachable), ([REPO], ["slang/slang"]))

        # A day later it is probed again; a repo that lists again is back in reach.
        c = self.cache(NOW + timedelta(seconds=uc.UNREACHABLE_RETRY_S + 60))
        listed.clear()
        c.plan_github([bad, good], {}, lister=lambda repo, since: listed.append(repo) or set())
        self.assertEqual((sorted(listed), c.unreachable), ([REPO, "slang/slang"], []))
        self.assertNotIn("unreachable_at", c.repos["slang/slang"])

    def test_every_listing_refused_is_a_sync_error_not_unreachable(self):
        # A dead token refuses every repo at once: no repo is marked out of reach.
        c = self.cache()
        for repo in (REPO, "acme/gadget"):
            c.repos[repo] = {"synced_at": "2026-11-16T11:00:00Z"}
        other = {"thread": "gh-issue-acme/gadget-2", "repo": "acme/gadget", "issue": 2, "sessions": []}
        c.plan_github([thread(1, []), other], {}, lister=lambda *_: uc.UNREACHABLE)
        self.assertEqual((sorted(c.sync_errors), c.unreachable), (["acme/gadget", REPO], []))
        self.assertNotIn("unreachable_at", c.repos[REPO])

    def test_list_changed_tells_a_refused_repo_from_a_failed_call(self):
        def gh(stderr, rc=1, stdout=""):
            return lambda *a, **k: subprocess.CompletedProcess(a, rc, stdout=stdout, stderr=stderr)

        with mock.patch.object(uc.subprocess, "run", gh("gh: Bad credentials (HTTP 401)\n")):
            self.assertIs(uc.list_changed(REPO, "x"), uc.UNREACHABLE)
        with mock.patch.object(uc.subprocess, "run", gh("gh: Not Found (HTTP 404)\n")):
            self.assertIs(uc.list_changed(REPO, "x"), uc.UNREACHABLE)
        with mock.patch.object(uc.subprocess, "run", gh("gh: API rate limit exceeded (HTTP 403)\n")):
            self.assertIsNone(uc.list_changed(REPO, "x"))
        with mock.patch.object(uc.subprocess, "run", gh("gh: Server Error (HTTP 502)\n")):
            self.assertIsNone(uc.list_changed(REPO, "x"))
        with mock.patch.object(uc.subprocess, "run", gh("", rc=0, stdout='[7, ""]\n')):
            self.assertEqual(uc.list_changed(REPO, "x"), {7})

    def test_body_refs(self):
        body = "Fixes #12, see other/repo#99 and https://github.com/acme/widget/issues/34 and /pull/x#5"
        self.assertEqual(uc.body_refs(body, REPO), {12, 34})


class OutboundCache(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.c = uc.UniverseCache(self.tmp.name, NOW)

    def tearDown(self):
        self.tmp.cleanup()

    def test_stopped_and_unchanged_is_current(self):
        s = {"id": "a", "last_active": "2026-11-16 10:00", "container_status": "stopped"}
        self.c.record_outbound(s, "2026-11-16T10:05:00Z", "done")
        self.assertTrue(self.c.outbound_is_current(s))
        # The host stamps last_active when it queues an inbound or starts the container.
        self.assertFalse(self.c.outbound_is_current(dict(s, last_active="2026-11-16 11:00")))
        # A running container can write an outbound without moving last_active.
        self.assertFalse(self.c.outbound_is_current(dict(s, container_status="running")))

    def test_read_taken_while_running_is_never_current(self):
        s = {"id": "a", "last_active": "2026-11-16 10:00", "container_status": "running"}
        self.c.record_outbound(s, "2026-11-16T10:05:00Z", "working")
        self.assertFalse(self.c.outbound_is_current(dict(s, container_status="stopped")))

    def test_a_read_without_outbound_keeps_the_older_one(self):
        s = {"id": "a", "last_active": "2026-11-16 10:00", "container_status": "stopped"}
        self.c.record_outbound(s, "2026-11-16T09:00:00Z", "older")
        self.c.record_outbound(dict(s, last_active="2026-11-16 11:00"), None, None)
        self.assertEqual(self.c.cached_outbound("a"), ("2026-11-16T09:00:00Z", "older"))

    def test_save_prunes_departed_chains_and_sessions(self):
        self.c.issues = {f"{REPO}:1": {"state": "OPEN", "bot_pr": {"number": 5}},
                         f"{REPO}:2": {"state": "OPEN", "bot_pr": {"number": 6}}}
        self.c.prs = {f"{REPO}:5": {}, f"{REPO}:6": {}}
        self.c.outbound = {"a": {}, "b": {}}
        self.c.save([f"{REPO}:1"], ["a"], {"at": "x"})
        gh = json.loads((Path(self.tmp.name) / uc.GITHUB_CACHE).read_text())
        self.assertEqual(list(gh["issues"]), [f"{REPO}:1"])
        self.assertEqual(list(gh["prs"]), [f"{REPO}:5"])
        lo = json.loads((Path(self.tmp.name) / uc.OUTBOUND_CACHE).read_text())
        self.assertEqual(list(lo["sessions"]), ["a"])


NCL_STUB = textwrap.dedent('''\
    #!/usr/bin/env python3
    import json, os, sys
    d = os.environ["STUB_DIR"]
    a = sys.argv[1:]
    with open(os.path.join(d, "calls.log"), "a") as f:
        f.write("ncl " + " ".join(a) + "\\n")
    fx = json.load(open(os.path.join(d, "ncl.json")))
    def out(obj):
        print(json.dumps({"id": "x", "ok": True, "data": obj}))
    if a[:2] == ["sessions", "list"]:
        out(fx["sessions"])
    elif a[:2] == ["groups", "list"]:
        out(fx["groups"])
    elif a[:2] == ["cost-cap", "stopped"]:
        out({"count": 0, "stopped": []})
    elif a[:2] == ["sessions", "messages"]:
        out(fx["messages"].get(a[a.index("--id") + 1], []))
    else:
        sys.exit(2)
''')

GH_STUB = textwrap.dedent('''\
    #!/usr/bin/env python3
    import json, os, re, sys, time
    d = os.environ["STUB_DIR"]
    a = sys.argv[1:]
    with open(os.path.join(d, "calls.log"), "a") as f:
        f.write("gh " + " ".join(x[:60] for x in a) + "\\n")
    fx = json.load(open(os.path.join(d, "gh.json")))
    if a[:2] == ["api", "graphql"]:
        time.sleep(float(os.environ.get("STUB_GH_DELAY") or 0))
        q = a[a.index("-f") + 1]
        m = re.search(r'repository\\(owner: "([^"]+)", name: "([^"]+)"\\)', q)
        repo = m.group(1) + "/" + m.group(2)
        data = {}
        for alias, kind, num in re.findall(r"(\\w+): (issueOrPullRequest|pullRequest)\\(number: (\\d+)\\)", q):
            data[alias] = fx["issues" if kind == "issueOrPullRequest" else "prs"].get(num)
        print(json.dumps({"data": {"repository": data}}))
    elif a[:1] == ["api"] and "--paginate" in a:
        for number, body in fx["changed"]:
            print(json.dumps([number, body]))
    elif a[:2] == ["issue", "view"]:
        print("OPEN")
    else:
        sys.exit(2)
''')


def fixtures():
    """Three chains: #100 triage-only, #200 fixer with PR #201, #300 closed."""
    sessions = [
        {"id": "sess-1", "thread_id": f"gh-issue-{REPO}-100", "agent_group_id": "ag-t",
         "container_status": "stopped", "last_active": "2026-11-16 10:00"},
        {"id": "sess-2", "thread_id": f"gh-issue-{REPO}-200", "agent_group_id": "ag-f",
         "container_status": "running", "last_active": "2026-11-16 11:00"},
        {"id": "sess-3", "thread_id": f"gh-issue-{REPO}-300", "agent_group_id": "ag-t",
         "container_status": "stopped", "last_active": "2026-11-01 10:00"},
        {"id": "sess-9", "thread_id": "slack-dm", "agent_group_id": "ag-t",
         "container_status": "stopped", "last_active": "2026-11-16 10:00"},
    ]
    ncl = {
        "sessions": sessions,
        "groups": [{"id": "ag-t", "folder": "slang-triager"}, {"id": "ag-f", "folder": "slang-fixer"}],
        "messages": {
            "sess-1": [{"direction": "out", "timestamp": "2026-11-16T10:01:00.000Z", "text": "triaged"}],
            "sess-2": [{"direction": "in", "timestamp": "2026-11-16T11:00:00.000Z", "text": "go"},
                       {"direction": "out", "timestamp": "2026-11-16T10:30:00.000Z", "text": "pushed"}],
        },
    }

    def comment(login, at):
        return {"author": {"login": login}, "createdAt": at}

    gh = {
        "changed": [],
        "issues": {
            "100": {"__typename": "Issue", "state": "OPEN",
                    "comments": {"nodes": [comment("nv-slang-bot[bot]", "2026-11-16T10:00:00Z")]},
                    "timelineItems": {"nodes": []}},
            "200": {"__typename": "Issue", "state": "OPEN", "comments": {"nodes": []},
                    "timelineItems": {"nodes": [{"source": {
                        "number": 201, "state": "OPEN", "isDraft": True,
                        "body": "Fixes #200", "headRefName": "fix/issue-200"}}]}},
            "300": {"__typename": "Issue", "state": "CLOSED", "comments": {"nodes": []},
                    "timelineItems": {"nodes": []}},
        },
        "prs": {
            "201": {"number": 201, "state": "OPEN", "isDraft": True, "body": "Fixes #200",
                    "headRefName": "fix/issue-200",
                    "comments": {"nodes": [comment("reviewer", "2026-11-16T09:00:00Z")]},
                    "reviews": {"nodes": []},
                    "commits": {"nodes": [{"commit": {"committedDate": "2026-11-16T10:20:00Z"}}]}},
        },
    }
    return ncl, gh


class CachedPullEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.stub_dir, self.bin, self.cache = root / "stub", root / "bin", root / "cache"
        self.stub_dir.mkdir()
        self.bin.mkdir()
        for name, body in (("ncl", NCL_STUB), ("gh", GH_STUB)):
            path = self.bin / name
            path.write_text(body)
            path.chmod(0o755)
        self.ncl, self.gh = fixtures()
        self.write_fixtures()

    def tearDown(self):
        self.tmp.cleanup()

    def write_fixtures(self):
        (self.stub_dir / "ncl.json").write_text(json.dumps(self.ncl))
        (self.stub_dir / "gh.json").write_text(json.dumps(self.gh))

    def pull(self, *args, **env):
        """Run pull-universe.sh; return (chains, the calls it made)."""
        log = self.stub_dir / "calls.log"
        if log.exists():
            log.unlink()
        r = subprocess.run(
            ["bash", str(HERE / "pull-universe.sh"), *args], capture_output=True, text=True,
            env={**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}", "STUB_DIR": str(self.stub_dir), **env},
            timeout=120, check=False)
        self.assertEqual(r.returncode, 0, r.stderr)
        calls = log.read_text().splitlines() if log.exists() else []
        return json.loads(r.stdout)["chains"], calls

    def cached_pull(self, **env):
        return self.pull("--cache-dir", str(self.cache), **env)

    @staticmethod
    def graphql_calls(calls):
        return [c for c in calls if c.startswith("gh api graphql")]

    @staticmethod
    def outbound_reads(calls):
        return sorted(c.split("--id ")[1].split()[0] for c in calls if c.startswith("ncl sessions messages"))

    def test_cold_cached_pull_matches_the_full_pull(self):
        full, _ = self.pull()
        cached, calls = self.cached_pull()
        self.assertEqual(cached, full)
        self.assertNotIn("cache_cold", json.dumps(cached))
        self.assertEqual(len(self.graphql_calls(calls)), 2)  # one issue batch, one PR batch
        self.assertEqual(self.outbound_reads(calls), ["sess-1", "sess-2"])  # the closed chain is skipped
        self.assertEqual(cached[f"gh-issue-{REPO}-200"]["our_last_outbound"], "2026-11-16T10:30:00.000Z")

    def test_unchanged_universe_rereads_only_the_running_session(self):
        first, _ = self.cached_pull()
        again, calls = self.cached_pull()
        self.assertEqual(again, first)
        self.assertEqual(self.graphql_calls(calls), [])
        self.assertEqual(self.outbound_reads(calls), ["sess-2"])

    def test_changed_issue_is_refetched_and_nothing_else(self):
        self.cached_pull()
        new_comment = {"author": {"login": "maintainer"}, "createdAt": "2026-11-16T11:30:00Z"}
        self.gh["issues"]["100"]["comments"]["nodes"].append(new_comment)
        self.gh["changed"] = [[100, ""]]
        self.write_fixtures()
        chains, calls = self.cached_pull()
        graphql = self.graphql_calls(calls)
        self.assertEqual(len(graphql), 1)  # #100's issue batch; it has no PR
        authors = [c["author"] for c in chains[f"gh-issue-{REPO}-100"]["comments"]]
        self.assertIn("maintainer", authors)

    def test_new_pr_marks_the_issue_it_fixes_as_changed(self):
        self.cached_pull()
        self.gh["changed"] = [[250, "Fixes #100"]]
        self.write_fixtures()
        _, calls = self.cached_pull()
        self.assertEqual(len(self.graphql_calls(calls)), 1)

    def test_outbound_is_reread_when_last_active_moves(self):
        self.cached_pull()
        self.ncl["sessions"][0]["last_active"] = "2026-11-16 11:40"
        self.ncl["messages"]["sess-1"].insert(
            0, {"direction": "out", "timestamp": "2026-11-16T11:41:00.000Z", "text": "answered"})
        self.write_fixtures()
        chains, calls = self.cached_pull()
        self.assertEqual(self.outbound_reads(calls), ["sess-1", "sess-2"])
        self.assertEqual(chains[f"gh-issue-{REPO}-100"]["our_last_outbound"], "2026-11-16T11:41:00.000Z")

    def test_exhausted_budget_marks_chains_cold_and_the_next_pull_warms_them(self):
        # Each GraphQL call outlasts the whole budget, so at most the issue batch
        # runs: the PR batch and every outbound read are cut, and no open chain
        # may look warm.
        chains, _ = self.cached_pull_with("--budget-s", "1", STUB_GH_DELAY="2")
        self.assertLessEqual({f"gh-issue-{REPO}-100", f"gh-issue-{REPO}-200"}, self.cold(chains))
        chains, _ = self.cached_pull()
        self.assertEqual(self.cold(chains), set())
        report = json.loads((self.cache / uc.REPORT).read_text())
        self.assertEqual(report["cold_chains"], 0)
        self.assertEqual(report["dirty_left"], 0)

    def cached_pull_with(self, *args, **env):
        return self.pull("--cache-dir", str(self.cache), *args, **env)

    def test_gate_runs_the_real_cached_pull(self):
        # The gate's default command: pull-universe.sh --cache-dir under the agent dir.
        agent = Path(self.tmp.name) / "agent"
        r = subprocess.run(
            ["python3", str(HERE / "supervise-gate.py"), "--gate"], capture_output=True, text=True,
            env={**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}", "STUB_DIR": str(self.stub_dir),
                 "SUPERVISE_GATE_AGENT_DIR": str(agent)},
            timeout=120, check=False)
        self.assertEqual(r.returncode, 0, r.stderr)
        out = json.loads(r.stdout.strip().splitlines()[-1])
        self.assertIsNone(out["data"]["degraded"], out)
        self.assertEqual(out["data"]["chains"]["in_flight"], 2)
        self.assertEqual(out["data"]["chains"]["cold"], 0)
        self.assertTrue((agent / ".supervise-gate" / "cache" / uc.GITHUB_CACHE).exists())
        record = json.loads((agent / ".supervise-gate" / "last-run.json").read_text())
        self.assertEqual(record["pull"]["issues_fetched"], 3)

    @staticmethod
    def cold(chains):
        return {t for t, c in chains.items() if c.get("cache_cold")}


if __name__ == "__main__":
    unittest.main(verbosity=2)
