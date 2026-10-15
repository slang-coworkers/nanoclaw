"""Tests for practices_check.py and the nanoclaw_practices metric.

Every fixture is built in a temporary directory: a v2.db with the columns the checks
read, session mailboxes with the messages_in schema from src/mailbox/sqlite/schema.ts,
group directories (one through a symlink), host logs stamped the way src/log.ts
stamps them, and a git repository with a fake remote-tracking branch. No test opens a
production path, and the module under test is imported with NANOCLAW_DIR pointing at
the fixture so its defaults resolve there too.

Runs under both `python3 -m unittest discover -s ops/practices-check -p 'test_*.py'`
(what CI runs) and `python3 -m pytest ops/practices-check -q`.
"""

import contextlib
import datetime as dt
import importlib.util
import io
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
# Log stamps are local wall-clock time (src/log.ts), so fixture times are local too.
LOCAL = dt.datetime.now(dt.timezone.utc).astimezone().tzinfo
REPO = os.path.dirname(os.path.dirname(HERE))

MESSAGES_IN = """
CREATE TABLE IF NOT EXISTS messages_in (
  id TEXT PRIMARY KEY, seq INTEGER UNIQUE, kind TEXT NOT NULL, timestamp TEXT NOT NULL,
  status TEXT DEFAULT 'pending', process_after TEXT, recurrence TEXT, series_id TEXT,
  tries INTEGER DEFAULT 0, trigger INTEGER NOT NULL DEFAULT 1, platform_id TEXT,
  channel_type TEXT, thread_id TEXT, content TEXT NOT NULL, source_session_id TEXT,
  on_wake INTEGER NOT NULL DEFAULT 0, failure_class TEXT, gated INTEGER NOT NULL DEFAULT 0
);
"""


def load_module(name, path, env):
    """Import a script by path with `env` applied first, so module-level defaults
    (NANOCLAW_DIR and the paths derived from it) resolve inside the fixture."""
    saved = {k: os.environ.get(k) for k in env}
    os.environ.update(env)
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules.pop(name, None)
        spec.loader.exec_module(mod)
        return mod
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


class Fixture:
    """A fake NANOCLAW_DIR with the pieces the checks read."""

    def __init__(self):
        self.root = tempfile.mkdtemp(prefix="practices-check-test.")
        self.data = os.path.join(self.root, "data")
        self.groups = os.path.join(self.root, "groups")
        self.sessions = os.path.join(self.data, "v2-sessions")
        self.logs = os.path.join(self.root, "logs")
        for d in (self.data, self.groups, self.sessions, self.logs):
            os.makedirs(d)
        self.db = os.path.join(self.data, "v2.db")
        con = sqlite3.connect(self.db)
        con.executescript(
            """
            CREATE TABLE agent_groups (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL, paused INTEGER NOT NULL DEFAULT 0,
              coworker_type TEXT, is_admin INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE sessions (
              id TEXT PRIMARY KEY, agent_group_id TEXT NOT NULL, status TEXT, created_at TEXT NOT NULL
            );
            """
        )
        con.commit()
        con.close()

    def cleanup(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def add_group(self, gid, name, folder, paused=0, coworker_type="triager", is_admin=0, make_dir=True):
        con = sqlite3.connect(self.db)
        con.execute(
            "INSERT INTO agent_groups (id, name, folder, created_at, paused, coworker_type, is_admin)"
            " VALUES (?, ?, ?, '2026-01-01T00:00:00Z', ?, ?, ?)",
            (gid, name, folder, paused, coworker_type, is_admin),
        )
        con.commit()
        con.close()
        if make_dir:
            os.makedirs(os.path.join(self.groups, folder), exist_ok=True)

    def write_group_file(self, folder, fname, size):
        with open(os.path.join(self.groups, folder, fname), "w") as fh:
            fh.write("x" * size)

    def mailbox(self, gid, sid="sess-1"):
        d = os.path.join(self.sessions, gid, sid)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "inbound.db")
        con = sqlite3.connect(path)
        con.executescript(MESSAGES_IN)
        con.commit()
        con.close()
        return path

    def add_task(self, mailbox, row_id, series, status, recurrence, prompt, script=None, failure_class=None):
        con = sqlite3.connect(mailbox)
        seq = (con.execute("SELECT COALESCE(MAX(seq), 0) FROM messages_in").fetchone()[0] or 0) + 2
        content = json.dumps({"prompt": prompt, "script": script})
        con.execute(
            "INSERT INTO messages_in (id, seq, kind, timestamp, status, process_after, recurrence, series_id,"
            " content, failure_class) VALUES (?, ?, 'task', '2026-01-01T00:00:00Z', ?, '2099-01-01T00:00:00Z',"
            " ?, ?, ?, ?)",
            (row_id, seq, status, recurrence, series, content, failure_class),
        )
        con.commit()
        con.close()

    def write_log(self, name, lines, mtime=None):
        path = os.path.join(self.logs, name)
        with open(path, "w") as fh:
            fh.write("\n".join(lines) + "\n")
        if mtime is not None:
            os.utime(path, (mtime.timestamp(), mtime.timestamp()))
        return path


def stamp(t, msg, level="WARN", **kv):
    """One host-log line as src/log.ts writes it: time of day, ANSI-coloured level
    tag, message, then key=json pairs."""
    tag = f"\x1b[33m{level}\x1b[39m"
    extra = "".join(f" \x1b[35m{k}\x1b[39m={json.dumps(v)}" for k, v in kv.items())
    return f"[{t.strftime('%H:%M:%S')}.000] {tag} \x1b[36m{msg}\x1b[39m{extra}"


class PracticesCheckTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fx = Fixture()
        cls.pc = load_module(
            "practices_check_under_test",
            os.path.join(HERE, "practices_check.py"),
            {"NANOCLAW_DIR": cls.fx.root, "PRACTICES_CHECK_OUT": os.path.join(cls.fx.root, "out")},
        )

    @classmethod
    def tearDownClass(cls):
        cls.fx.cleanup()

    def setUp(self):
        con = sqlite3.connect(self.fx.db)
        con.execute("DELETE FROM agent_groups")
        con.commit()
        con.close()
        for d in (self.fx.groups, self.fx.sessions, self.fx.logs):
            shutil.rmtree(d)
            os.makedirs(d)
        self.rep = self.pc.Report()

    def check(self, name):
        found = [c for c in self.rep.checks if c["check"] == name]
        self.assertEqual(len(found), 1, f"{name} reported {len(found)} times: {self.rep.checks}")
        return found[0]

    # ---- groups ----

    def test_instruction_bloat_follows_symlinked_group_dirs_and_skips_paused(self):
        self.fx.add_group("g1", "Alpha", "alpha")
        self.fx.add_group("g2", "Beta", "beta", make_dir=False)
        self.fx.add_group("g3", "Gamma", "gamma", paused=1)
        real = os.path.join(self.fx.root, "elsewhere-beta")
        os.makedirs(real)
        os.symlink(real, os.path.join(self.fx.groups, "beta"))
        self.fx.write_group_file("alpha", "CLAUDE.local.md", 100)
        self.fx.write_group_file("beta", "CLAUDE.local.md", 20_001)
        self.fx.write_group_file("beta", "CLAUDE.md", 60_001)
        self.fx.write_group_file("gamma", "CLAUDE.local.md", 90_000)
        groups = self.pc.load_groups(self.fx.db)
        self.pc.check_instruction_bloat(self.rep, groups, self.fx.groups)
        c = self.check("instruction-bloat")
        self.assertEqual(c["state"], "DRIFT")
        self.assertEqual(sorted((f["group"], f["file"]) for f in c["findings"]),
                         [("beta", "CLAUDE.local.md"), ("beta", "CLAUDE.md")])
        self.assertEqual(c["findings"][0]["value"], 20_001)
        self.assertEqual(c["findings"][0]["threshold"], 20_000)

    def test_instruction_bloat_ok_when_within_limits(self):
        self.fx.add_group("g1", "Alpha", "alpha")
        self.fx.write_group_file("alpha", "CLAUDE.local.md", 20_000)
        groups = self.pc.load_groups(self.fx.db)
        self.pc.check_instruction_bloat(self.rep, groups, self.fx.groups)
        self.assertEqual(self.check("instruction-bloat")["state"], "OK")

    def test_untyped_groups_excludes_admin_and_paused(self):
        self.fx.add_group("g1", "A", "a", coworker_type=None)
        self.fx.add_group("g2", "B", "b", coworker_type="default")
        self.fx.add_group("g3", "C", "c", coworker_type="")
        self.fx.add_group("g4", "D", "d", coworker_type=None, is_admin=1)
        self.fx.add_group("g5", "E", "e", coworker_type=None, paused=1)
        self.fx.add_group("g6", "F", "f", coworker_type="reviewer")
        groups = self.pc.load_groups(self.fx.db)
        self.pc.check_untyped_groups(self.rep, groups)
        c = self.check("untyped-groups")
        self.assertEqual(c["state"], "DRIFT")
        self.assertEqual(sorted(f["group"] for f in c["findings"]), ["a", "b", "c"])

    def test_duplicate_names_among_live_groups_only(self):
        self.fx.add_group("g1", "Triager", "t1")
        self.fx.add_group("g2", "triager ", "t2")
        self.fx.add_group("g3", "Triager", "t3", paused=1)
        self.fx.add_group("g4", "Reviewer", "r1")
        groups = self.pc.load_groups(self.fx.db)
        self.pc.check_duplicate_names(self.rep, groups)
        c = self.check("duplicate-names")
        self.assertEqual(c["state"], "DRIFT")
        self.assertEqual(len(c["findings"]), 1)
        self.assertEqual(c["findings"][0]["groups"], ["t1", "t2"])

    def test_groups_unavailable_when_paused_column_missing(self):
        con = sqlite3.connect(self.fx.db)
        con.executescript("DROP TABLE agent_groups; CREATE TABLE agent_groups (id TEXT, name TEXT, folder TEXT);")
        con.commit()
        con.close()
        try:
            with self.assertRaises(self.pc.GroupsUnavailable):
                self.pc.load_groups(self.fx.db)
        finally:
            os.unlink(self.fx.db)
            self._recreate_db()

    def _recreate_db(self):
        con = sqlite3.connect(self.fx.db)
        con.executescript(
            """
            CREATE TABLE agent_groups (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL, paused INTEGER NOT NULL DEFAULT 0,
              coworker_type TEXT, is_admin INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE sessions (
              id TEXT PRIMARY KEY, agent_group_id TEXT NOT NULL, status TEXT, created_at TEXT NOT NULL
            );
            """
        )
        con.commit()
        con.close()

    # ---- series ----

    def test_series_checks(self):
        self.fx.add_group("g1", "A", "a")
        self.fx.add_group("g2", "B", "b", paused=1)
        mb = self.fx.mailbox("g1")
        # per-issue by name, recurring
        self.fx.add_task(mb, "i13435-gate-ab12", "i13435-gate-ab12", "pending", "0 9 * * *", "check the gate")
        # per-issue by prompt (exactly one #NNNN), recurring
        self.fx.add_task(mb, "watch-pr-9f00", "watch-pr-9f00", "pending", "0 */6 * * *", "Re-check #12345 for CI")
        # two issue refs: not per-issue; ungated and frequent
        self.fx.add_task(mb, "hot-1111", "hot-1111", "pending", "*/10 * * * *", "scan #100 and #200")
        # frequent but gated by a script: fine
        self.fx.add_task(mb, "gated-2222", "gated-2222", "pending", "*/5 * * * *", "poll", script="exit 1")
        # one-shot per-issue: fine (no recurrence)
        self.fx.add_task(mb, "i13000-once-3333", "i13000-once-3333", "pending", None, "once")
        # failing streak of 3, not script class
        for i in range(3):
            self.fx.add_task(mb, f"fail-{i}", "flaky-4444", "failed", "0 * * * *", "flaky", failure_class="turn")
        self.fx.add_task(mb, "fail-live", "flaky-4444", "pending", "0 * * * *", "flaky", script="true")
        # auto-paused: 8 script failures then a paused row
        for i in range(8):
            self.fx.add_task(mb, f"sf-{i}", "mon-5555", "failed", "0 * * * *", "mon", script="x", failure_class="script")
        self.fx.add_task(mb, "sf-live", "mon-5555", "paused", "0 * * * *", "mon", script="x")
        # recovered: failures then a completed run, then live
        self.fx.add_task(mb, "rc-0", "ok-6666", "failed", "0 * * * *", "ok", failure_class="turn")
        self.fx.add_task(mb, "rc-1", "ok-6666", "completed", "0 * * * *", "ok")
        self.fx.add_task(mb, "rc-live", "ok-6666", "pending", "0 * * * *", "ok", script="true")
        # paused group: ignored entirely
        mb2 = self.fx.mailbox("g2")
        self.fx.add_task(mb2, "p-1", "p-1", "pending", "* * * * *", "spam #4444")
        # a `.context` sibling dir must not be read as a session
        os.makedirs(os.path.join(self.fx.sessions, "g1", ".context"))

        groups = self.pc.load_groups(self.fx.db)
        series, problems = self.pc.load_series(groups, self.fx.sessions)
        self.assertEqual(problems, [])
        self.assertEqual(sorted(s["series_id"] for s in series),
                         ["flaky-4444", "gated-2222", "hot-1111", "i13000-once-3333",
                          "i13435-gate-ab12", "mon-5555", "ok-6666", "watch-pr-9f00"])
        self.pc.check_series(self.rep, series, problems)

        per_issue = self.check("per-issue-series")
        self.assertEqual(per_issue["state"], "DRIFT")
        self.assertEqual(sorted(f["series"] for f in per_issue["findings"]), ["i13435-gate-ab12", "watch-pr-9f00"])

        ungated = self.check("ungated-series")
        self.assertEqual(ungated["state"], "DRIFT")
        self.assertEqual([f["series"] for f in ungated["findings"]], ["hot-1111"])
        self.assertEqual(ungated["findings"][0]["value"], 144)
        self.assertEqual(ungated["findings"][0]["threshold"], 4)

        failing = self.check("failing-series")
        self.assertEqual(failing["state"], "DRIFT")
        kinds = {f["series"]: f["kind"] for f in failing["findings"]}
        self.assertEqual(kinds, {"flaky-4444": "failing", "mon-5555": "auto-paused"})

    def test_unreadable_mailbox_makes_series_checks_unknown(self):
        self.fx.add_group("g1", "A", "a")
        mb = self.fx.mailbox("g1")
        with open(mb, "wb") as fh:
            fh.write(b"not a database at all, long enough to be read as a header" * 4)
        groups = self.pc.load_groups(self.fx.db)
        series, problems = self.pc.load_series(groups, self.fx.sessions)
        self.assertEqual(series, [])
        self.assertEqual(len(problems), 1)
        self.pc.check_series(self.rep, series, problems)
        for name in ("per-issue-series", "ungated-series", "failing-series"):
            self.assertEqual(self.check(name)["state"], "UNKNOWN")

    def test_unparseable_cron_is_unknown_not_clean(self):
        self.fx.add_group("g1", "A", "a")
        mb = self.fx.mailbox("g1")
        self.fx.add_task(mb, "w-1", "weird-0001", "pending", "every 5 minutes", "scan #1 #2")
        groups = self.pc.load_groups(self.fx.db)
        series, problems = self.pc.load_series(groups, self.fx.sessions)
        self.pc.check_series(self.rep, series, problems)
        self.assertEqual(self.check("ungated-series")["state"], "UNKNOWN")
        self.assertEqual(self.check("per-issue-series")["state"], "OK")

    def test_legacy_plain_string_content(self):
        parsed = self.pc.parse_task_content("just a prompt #4321")
        self.assertEqual(parsed, {"prompt": "just a prompt #4321", "script": None})

    # ---- cron ----

    def test_fires_per_day(self):
        start = dt.datetime(2026, 3, 2, 0, 0, tzinfo=dt.timezone.utc)  # a Monday
        f = self.pc.fires_per_day
        self.assertEqual(f("0 9 * * *", start), 1)
        self.assertEqual(f("0 */6 * * *", start), 4)
        self.assertEqual(f("*/15 * * * *", start), 96)
        self.assertEqual(f("@hourly", start), 24)
        self.assertEqual(f("0 9 * * 1-5", start), 1)
        self.assertEqual(f("0 9 * * sat,sun", start), 0)
        self.assertEqual(f("30 8 1 * *", start), 0)
        self.assertEqual(f("0 0 2 3 *", start), 1)
        self.assertEqual(f("0,30 * * * *", start), 48)
        self.assertEqual(f("*/30 * * * * *", start), 2 * 1440)  # leading seconds field
        with self.assertRaises(self.pc.CronError):
            f("every 5 minutes", start)
        with self.assertRaises(self.pc.CronError):
            f("0 25 * * *", start)

    # ---- disk ----

    def test_disk_pressure_reports_value(self):
        self.pc.check_disk(self.rep, self.fx.groups)
        c = self.check("disk-pressure")
        self.assertIn(c["state"], ("OK", "DRIFT"))
        self.assertIsInstance(c["value"], float)

    def test_disk_pressure_threshold_from_env(self):
        os.environ["PRACTICES_DISK_FREE_MIN_PCT"] = "101"
        try:
            self.pc.check_disk(self.rep, self.fx.groups)
        finally:
            del os.environ["PRACTICES_DISK_FREE_MIN_PCT"]
        c = self.check("disk-pressure")
        self.assertEqual(c["state"], "DRIFT")
        self.assertEqual(c["findings"][0]["threshold"], 101)

    # ---- logs ----

    def test_recent_log_lines_crosses_midnight_and_ignores_old_rotation(self):
        now = dt.datetime(2026, 5, 10, 0, 30, 0, tzinfo=LOCAL)
        lines = [
            stamp(now - dt.timedelta(hours=3), "old"),
            stamp(now - dt.timedelta(minutes=50), "before midnight"),
            "  continuation without a stamp",
            stamp(now - dt.timedelta(minutes=10), "after midnight"),
        ]
        path = self.fx.write_log("nanoclaw.error.log", lines, mtime=now)
        got, err = self.pc.recent_log_lines(path, 3600, now=now)
        self.assertIsNone(err)
        self.assertEqual([ln.split("]", 1)[0] for ln in got][:1], [f"[{(now - dt.timedelta(minutes=50)).strftime('%H:%M:%S')}.000"])
        self.assertEqual(len(got), 3)
        # A rotated file whose last write was two days ago contributes nothing to a
        # one-hour window even though its stamps look like today's.
        old = self.fx.write_log("nanoclaw.error.log.1", [stamp(now - dt.timedelta(minutes=5), "stale")],
                                mtime=now - dt.timedelta(days=2))
        got, err = self.pc.recent_log_lines(old, 3600, now=now)
        self.assertIsNone(err)
        self.assertEqual(got, [])

    def test_recent_log_lines_without_stamps_is_an_error(self):
        path = self.fx.write_log("nanoclaw.log", ["no stamps here", "none at all"])
        got, err = self.pc.recent_log_lines(path, 3600)
        self.assertIsNone(got)
        self.assertIn("no timestamped", err)

    def test_skill_noise_counts_both_logs_within_the_hour(self):
        now = dt.datetime(2026, 5, 10, 14, 0, 0, tzinfo=LOCAL)
        recent = now - dt.timedelta(minutes=20)
        old = now - dt.timedelta(hours=2)
        err_lines = [stamp(old, "Shared skill not symlinked: real entry occupies the path", skill="x")]
        err_lines += [stamp(recent, "Shared skill not symlinked: real entry occupies the path", skill="x")] * 21
        log = self.fx.write_log("nanoclaw.log", [stamp(recent, "Spawning session", level="INFO")], mtime=now)
        errlog = self.fx.write_log("nanoclaw.error.log", err_lines, mtime=now)
        self.pc.check_skill_noise(self.rep, log=log, errlog=errlog, now=now)
        c = self.check("skill-noise")
        self.assertEqual(c["state"], "DRIFT")
        self.assertEqual(c["value"], 21)
        self.assertEqual(c["findings"][0]["threshold"], 20)

    def test_skill_noise_unknown_without_logs(self):
        self.pc.check_skill_noise(self.rep, log=os.path.join(self.fx.logs, "none"), errlog=os.path.join(self.fx.logs, "none2"))
        self.assertEqual(self.check("skill-noise")["state"], "UNKNOWN")

    def test_compaction_storms_per_group_skipping_paused(self):
        self.fx.add_group("g1", "A", "alpha")
        self.fx.add_group("g2", "B", "beta", paused=1)
        groups = self.pc.load_groups(self.fx.db)
        now = dt.datetime(2026, 5, 10, 14, 0, 0, tzinfo=LOCAL)
        msg = "CLAUDE.md stale — restarting container so spawn republishes document and markers"
        # Chronological, as the host writes it: one restart outside the 24h window,
        # then six for alpha and nine for the paused beta inside it.
        events = [(now - dt.timedelta(hours=30), "alpha")]
        events += [(now - dt.timedelta(hours=i + 1), "alpha") for i in range(6)]
        events += [(now - dt.timedelta(hours=i + 1), "beta") for i in range(9)]
        events.sort()
        lines = [stamp(t, msg, sessionId="s", folder=folder, hash="abc") for t, folder in events]
        errlog = self.fx.write_log("nanoclaw.error.log", lines, mtime=now)
        log = self.fx.write_log("nanoclaw.log", [stamp(now, "Sweep tick", level="INFO")], mtime=now)
        self.pc.check_compaction_storms(self.rep, groups, log=log, errlog=errlog, now=now)
        c = self.check("compaction-storms")
        self.assertEqual(c["state"], "DRIFT")
        self.assertEqual([(f["group"], f["value"]) for f in c["findings"]], [("alpha", 6)])

    # ---- git ----

    def test_branch_drift_counts_only_and_is_unknown_without_remote_refs(self):
        repo = os.path.join(self.fx.root, "repo")
        os.makedirs(repo)

        def g(*a):
            subprocess.run(["git", "-C", repo, *a], check=True, capture_output=True,
                           env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
                                "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"})

        g("init", "-q", "-b", "prod")
        g("commit", "-q", "--allow-empty", "-m", "base")
        self.pc.check_branch_drift(self.rep, repo)
        self.assertEqual(self.check("branch-drift")["state"], "UNKNOWN")

        self.rep = self.pc.Report()
        g("update-ref", "refs/remotes/origin/nv-main", "HEAD")
        g("commit", "-q", "--allow-empty", "-m", "cherry-pick 1")
        g("commit", "-q", "--allow-empty", "-m", "cherry-pick 2")
        self.pc.check_branch_drift(self.rep, repo)
        c = self.check("branch-drift")
        self.assertEqual(c["state"], "OK")
        self.assertEqual(c["value"], 2)
        self.assertEqual(c["findings"][0]["level"], "info")

    # ---- orchestration / report ----

    def test_end_to_end_writes_report_and_exit_code(self):
        self.fx.add_group("g1", "A", "alpha", coworker_type=None)
        now = dt.datetime.now(LOCAL)
        self.fx.write_log("nanoclaw.log", [stamp(now, "Sweep tick", level="INFO")])
        self.fx.write_log("nanoclaw.error.log", [stamp(now, "boot", level="WARN")])
        out = os.path.join(self.fx.root, "out")
        shutil.rmtree(out, ignore_errors=True)
        with contextlib.redirect_stdout(io.StringIO()):
            code = self.pc.main(["--quiet", "--out", out])
        self.assertEqual(code, 1)  # the untyped group is a finding; branch-drift UNKNOWN is outranked
        with open(os.path.join(out, "latest.json")) as fh:
            doc = json.load(fh)
        self.assertEqual(doc["status"], "findings")
        self.assertFalse(doc["complete"])  # the fixture root is not a git repo
        self.assertEqual(doc["counts"]["perCheck"]["untyped-groups"], 1)
        self.assertEqual(doc["counts"]["perCheck"]["duplicate-names"], 0)
        names = [c["check"] for c in doc["checks"]]
        for expected in ("instruction-bloat", "untyped-groups", "duplicate-names", "per-issue-series",
                         "ungated-series", "failing-series", "disk-pressure", "skill-noise",
                         "compaction-storms", "branch-drift"):
            self.assertIn(expected, names)
        with open(os.path.join(out, "latest.md")) as fh:
            md = fh.read()
        self.assertIn("| untyped-groups | DRIFT |", md)
        with open(os.path.join(out, "history.log")) as fh:
            history = fh.read().splitlines()
        self.assertEqual(len(history), 1)
        self.assertIn("status=findings findings=1", history[0])
        # a second run appends, never truncates
        with contextlib.redirect_stdout(io.StringIO()):
            self.pc.main(["--quiet", "--out", out])
        with open(os.path.join(out, "history.log")) as fh:
            self.assertEqual(len(fh.read().splitlines()), 2)

    def test_missing_db_makes_group_checks_unknown_not_clean(self):
        os.rename(self.fx.db, self.fx.db + ".away")
        try:
            self.pc.run_all(self.rep, self.fx.root)
        finally:
            os.rename(self.fx.db + ".away", self.fx.db)
        for name in ("instruction-bloat", "untyped-groups", "duplicate-names", "per-issue-series"):
            self.assertEqual(self.check(name)["state"], "UNKNOWN")
        doc = self.pc.build_document(self.rep, 0)
        self.assertEqual(doc["exitCode"], 2)

    def test_check_that_raises_becomes_unknown(self):
        original = self.pc.check_disk
        self.pc.check_disk = lambda rep, *a, **k: 1 / 0
        try:
            self.pc.run_all(self.rep, self.fx.root)
        finally:
            self.pc.check_disk = original
        c = self.check("disk-pressure")
        self.assertEqual(c["state"], "UNKNOWN")
        self.assertIn("ZeroDivisionError", c["summary"])


class MetricsTest(unittest.TestCase):
    """The nanoclaw_practices measurement re-emits latest.json without re-deriving
    any check."""

    def setUp(self):
        self.fx = Fixture()
        self.metrics = load_module(
            "nanoclaw_metrics_under_test",
            os.path.join(REPO, "ops", "metrics", "nanoclaw-metrics.py"),
            {"NANOCLAW_DIR": self.fx.root},
        )

    def tearDown(self):
        self.fx.cleanup()

    def test_emits_counts_from_latest_json(self):
        out_dir = os.path.join(self.fx.data, "shared", "practices-check")
        os.makedirs(out_dir)
        doc = {
            "status": "findings", "complete": False, "exitCode": 1,
            "counts": {"ok": 7, "drift": 2, "unknown": 1, "findings": 3,
                       "perCheck": {"untyped-groups": 2, "ungated-series": 1, "branch-drift": 0}},
            "checks": [{"check": "branch-drift", "state": "OK", "summary": "", "findings": [], "value": 4}],
        }
        with open(os.path.join(out_dir, "latest.json"), "w") as fh:
            json.dump(doc, fh)
        self.metrics.collect_practices()
        self.assertEqual(len(self.metrics._out), 1)
        line = self.metrics._out[0]
        self.assertTrue(line.startswith("nanoclaw_practices,status=findings "), line)
        for frag in ("findings=3i", "unknown=1i", "c_untyped_groups=2i", "c_ungated_series=1i",
                     "branch_ahead_commits=4i", "complete=false", "exit_code=1i"):
            self.assertIn(frag, line)

    def test_missing_report_is_an_error_not_zero(self):
        with self.assertRaises(OSError):
            self.metrics.collect_practices()
        self.assertEqual(self.metrics._out, [])


if __name__ == "__main__":
    unittest.main()
