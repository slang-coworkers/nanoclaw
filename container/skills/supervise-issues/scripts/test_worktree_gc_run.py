#!/usr/bin/env python3
"""End-to-end tests for worktree-gc-run.sh against a real git sandbox.

Each test builds a throwaway group directory with real base clones, worktrees
and clones, ages them, runs the gate exactly as the hourly task does, and reads
back the gate JSON, last-run.json and the disk. They pin the failures seen on
production: per-task `wt-*` clones and orphaned worktrees that no run ever
reaped, a worktree registered with a second base mistaken for an orphan, and a
gate that must stay quiet when nothing went wrong.
Run: python3 test_worktree_gc_run.py
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUN = HERE / "worktree-gc-run.sh"
DAY = 86400
OLD_DAYS = 10  # older than every idle threshold a scratch or orphan tree is held to

GIT_ENV = {
    "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t",
    "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_NOSYSTEM": "1",
}


def sh(*args, cwd=None, env=None, check=True):
    return subprocess.run(list(args), cwd=cwd, env={**os.environ, **GIT_ENV, **(env or {})},
                          capture_output=True, text=True, check=check)


def git(cwd, *args, days_ago=0):
    """Run git; `days_ago` back-dates commits and reflog entries."""
    env = {}
    if days_ago:
        stamp = f"@{int(time.time()) - days_ago * DAY} +0000"
        env = {"GIT_AUTHOR_DATE": stamp, "GIT_COMMITTER_DATE": stamp}
    return sh("git", "-C", str(cwd), *args, env=env)


def age_tree(path: Path, days: float):
    """Set the mtime of `path` and everything under it to `days` ago."""
    t = time.time() - days * DAY
    for root, dirs, files in os.walk(path):
        for n in dirs + files:
            p = os.path.join(root, n)
            if not os.path.islink(p):
                os.utime(p, (t, t))
    os.utime(path, (t, t))


class Sandbox:
    def __init__(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="wtgc-"))
        self.agent = self.tmp / "agent"
        self.agent.mkdir()
        # A fake `gh` that resolves nothing, so no test depends on GitHub.
        self.bin = self.tmp / "bin"
        self.bin.mkdir()
        (self.bin / "gh").write_text("#!/bin/sh\necho '{}'\nexit 1\n")
        (self.bin / "gh").chmod(0o755)

    def base(self, name):
        b = self.agent / name
        git(self.tmp, "init", "-q", "-b", "master", str(b), days_ago=OLD_DAYS)
        (b / ".gitignore").write_text("build/\n")
        (b / "f.txt").write_text("v1\n")
        git(b, "add", "-A")
        git(b, "commit", "-qm", "init", days_ago=OLD_DAYS)
        return b

    def worktree(self, base, name, days=OLD_DAYS):
        git(base, "worktree", "add", "-q", "--detach", str(self.agent / name), days_ago=days)
        return self.agent / name

    def clone(self, base, name):
        git(self.agent, "clone", "-q", "--shared", str(base), name, days_ago=OLD_DAYS)
        return self.agent / name

    def age_all(self, days=OLD_DAYS):
        age_tree(self.agent, days)

    def run(self, *flags, **env):
        r = sh("bash", str(RUN), *flags, env={"WORKTREE_GC_AGENT": str(self.agent),
                                              "PATH": f"{self.bin}:{os.environ['PATH']}",
                                              **{k: str(v) for k, v in env.items()}}, check=False)
        self.stderr = r.stderr
        lines = r.stdout.strip().splitlines()
        return json.loads(lines[-1]) if lines else None

    def report(self):
        return json.loads((self.agent / ".worktree-gc" / "last-run.json").read_text())

    def cleanup(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class GateTest(unittest.TestCase):
    def setUp(self):
        self.s = Sandbox()
        self.slang = self.s.base("slang")

    def tearDown(self):
        self.s.cleanup()

    def saved_branches(self, repo):
        return git(repo, "branch", "--list", "wip/reap/*", "--format=%(refname:short)").stdout.split()

    def test_quiet_gate_when_nothing_to_do(self):
        # Every hourly fire used to print a prompt-shaped task row; the gate itself
        # must answer wakeAgent=false whenever no action failed and the disk is fine.
        out = self.s.run("--gate")
        self.assertIsNotNone(out, self.s.stderr)
        free = shutil.disk_usage(self.s.agent)
        escalate = 100 * free.free / free.total < 10
        self.assertEqual(out["wakeAgent"], escalate)
        self.assertEqual(out["data"]["errors"], 0)
        self.assertEqual(self.s.report()["errors"], [])

    def test_orphaned_wt_directory_is_saved_then_reaped(self):
        # `git worktree add wt-tmp-1; mv wt-tmp-1 wt-1234-verify`, then a prune
        # that ran before the fix: the administrative dir is gone, git no longer
        # knows the tree, and the old sweep skipped it forever for having `.git`.
        wt = self.s.worktree(self.slang, "wt-tmp-1")
        (wt / "f.txt").write_text("edited in the orphan\n")
        wt.rename(self.s.agent / "wt-1234-verify")
        git(self.slang, "worktree", "prune")
        self.s.age_all()
        out = self.s.run("--gate")
        self.assertFalse(out["data"]["errors"], self.s.report())
        self.assertFalse((self.s.agent / "wt-1234-verify").exists())
        self.assertIn("wip/reap/wt-1234-verify", self.saved_branches(self.slang))
        saved = git(self.slang, "show", "wip/reap/wt-1234-verify:f.txt").stdout
        self.assertEqual(saved, "edited in the orphan\n")

    def test_renamed_worktree_is_repaired_not_orphaned(self):
        # A rename the GC sees before any prune keeps its worktree record.
        wt = self.s.worktree(self.slang, "wt-tmp-2")
        wt.rename(self.s.agent / "wt-slang-2222")
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["errors"], 0)
        self.assertIn("wt-slang-2222", self.s.report()["plan"]["repaired"])
        listed = git(self.slang, "worktree", "list", "--porcelain").stdout
        self.assertIn(str(self.s.agent / "wt-slang-2222"), listed)
        self.assertTrue((self.s.agent / "wt-slang-2222").exists())

    def test_clean_full_clone_is_reaped_without_a_bundle(self):
        self.s.clone(self.slang, "wt-3333-revA")
        self.s.age_all()
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["reaped"], 1, self.s.report())
        self.assertFalse((self.s.agent / "wt-3333-revA").exists())
        self.assertFalse((self.s.agent / ".worktree-gc" / "saved").exists())

    def test_dirty_full_clone_is_bundled_before_it_is_reaped(self):
        c = self.s.clone(self.slang, "wt-4444-drill")
        (c / "f.txt").write_text("uncommitted\n")
        (c / "new.txt").write_text("untracked\n")
        self.s.age_all()
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["errors"], 0, self.s.report())
        self.assertFalse((self.s.agent / "wt-4444-drill").exists())
        bundles = list((self.s.agent / ".worktree-gc" / "saved").glob("wt-4444-drill.*.bundle"))
        self.assertEqual(len(bundles), 1)
        # The bundle restores the uncommitted edit and the untracked file.
        restore = self.s.tmp / "restore"
        git(self.s.tmp, "clone", "-q", str(self.slang), str(restore))
        git(restore, "fetch", "-q", str(bundles[0]), "HEAD:refs/heads/restored")
        self.assertEqual(git(restore, "show", "restored:f.txt").stdout, "uncommitted\n")
        self.assertEqual(git(restore, "show", "restored:new.txt").stdout, "untracked\n")

    def test_recently_used_full_clone_is_kept(self):
        c = self.s.clone(self.slang, "wt-5555-revA")
        self.s.age_all()
        git(c, "checkout", "-q", "-b", "review")  # a reflog entry from today
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["reaped"], 0)
        self.assertTrue(c.exists())

    def test_boot_refresh_pull_is_not_agent_use(self):
        # refresh-clones.ts fast-forwards every clone at container boot; that
        # reflog entry must not make an abandoned review clone look in use.
        c = self.s.clone(self.slang, "wt-6666-revC")
        (self.slang / "f.txt").write_text("v2\n")
        git(self.slang, "commit", "-qam", "upstream moves", days_ago=OLD_DAYS)
        self.s.age_all()
        git(c, "pull", "--ff-only", "--quiet")
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["reaped"], 1, self.s.report())

    def test_clone_another_clone_borrows_objects_from_is_kept(self):
        self.s.clone(self.slang, "wt-7777-base")
        git(self.s.agent, "clone", "-q", "--shared", str(self.s.agent / "wt-7777-base"), "wt-7777-revA",
            days_ago=OLD_DAYS)
        c2 = self.s.agent / "wt-7777-revA"
        self.s.age_all()
        git(c2, "checkout", "-q", "-b", "in-use")  # the borrower is still in use
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["reaped"], 0, self.s.report())
        self.assertTrue((self.s.agent / "wt-7777-base").exists())

    def test_worktree_of_the_second_base_is_classified_not_orphaned(self):
        # The old sweep compared every wt-* against the FIRST base's worktree list
        # only, so a slangpy worktree was "unknown"; it must be a regular worktree.
        slangpy = self.s.base("slangpy")
        self.s.worktree(slangpy, "wt-slangpy-8888")
        self.s.worktree(self.slang, "wt-8889-scratch")
        self.s.age_all(0.2)
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["errors"], 0)
        self.assertEqual(out["data"]["plan"]["shapes"], {"worktree": 2})
        self.assertTrue((self.s.agent / "wt-slangpy-8888").exists())

    def test_idle_worktree_is_saved_as_a_branch_and_reaped(self):
        wt = self.s.worktree(self.slang, "wt-9999-verify")
        (wt / "f.txt").write_text("wip\n")
        self.s.age_all()
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["reaped"], 1, self.s.report())
        self.assertEqual(git(self.slang, "show", "wip/reap/wt-9999-verify:f.txt").stdout, "wip\n")
        self.assertNotIn("wt-9999-verify", git(self.slang, "worktree", "list").stdout)

    def test_skipped_worktree_keeps_its_idle_clock(self):
        # The save check's `git status` used to write the refreshed index back, which
        # made a worktree skipped for its size look freshly used on the next fire.
        wt = self.s.worktree(self.slang, "wt-8888-verify")
        with open(wt / "big.bin", "wb") as f:
            f.truncate(201 * 1024 * 1024)  # sparse: above SAVE_MAX_MB, no real disk
        self.s.age_all()
        index = Path(git(wt, "rev-parse", "--path-format=absolute", "--git-path", "index").stdout.strip())
        before = index.stat().st_mtime
        for _ in range(2):
            self.s.run("--gate")
            self.assertTrue(any(s.startswith("wt-8888-verify:") for s in self.s.report()["skipped"]),
                            self.s.report())
        self.assertEqual(index.stat().st_mtime, before)
        self.assertTrue(wt.exists())

    def test_backlog_drains_across_fires_under_the_time_box(self):
        for i in range(3):
            self.s.clone(self.slang, f"wt-100{i}-revA")
        self.s.age_all()
        out = self.s.run("--gate", GATE_BUDGET_S=0)
        self.assertEqual(out["data"]["reaped"], 0)
        self.assertEqual(out["data"]["left_for_next_run"], 3)
        self.assertEqual(out["data"]["errors"], 0)
        self.assertFalse(out["wakeAgent"] and out["data"]["errors"])
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["reaped"], 3, self.s.report())
        self.assertEqual(out["data"]["left_for_next_run"], 0)
        self.assertEqual(list((self.s.agent / ".worktree-gc" / "trash").iterdir()), [])

    def test_runs_entries_past_retention_are_expired(self):
        runs = self.s.agent / "runs"
        (runs / "A-1-r1").mkdir(parents=True)
        (runs / "A-1-r1" / "run.log").write_text("old\n")
        age_tree(runs / "A-1-r1", 30)
        (runs / "A-2-r1").mkdir()
        (runs / "A-2-r1" / "run.log").write_text("new\n")
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["runs_expired"], 1, self.s.report())
        self.assertFalse((runs / "A-1-r1").exists())
        self.assertTrue((runs / "A-2-r1").exists())

    def test_runs_entry_a_clone_borrows_from_is_kept(self):
        runs = self.s.agent / "runs"
        runs.mkdir()
        git(runs, "clone", "-q", "--bare", "--shared", str(self.slang), "13387-base.git", days_ago=30)
        git(self.s.agent, "clone", "-q", "--shared", str(runs / "13387-base.git"), "wt-13387-revA")
        age_tree(runs, 30)
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["runs_expired"], 0, self.s.report())
        self.assertTrue((runs / "13387-base.git").exists())

    def test_failed_save_wakes_the_agent(self):
        c = self.s.clone(self.slang, "wt-1111-revA")
        (c / "f.txt").write_text("dirty\n")
        self.s.age_all()
        hook = c / ".git" / "objects"
        hook.chmod(0o500)  # commit cannot write objects
        try:
            out = self.s.run("--gate")
        finally:
            hook.chmod(0o700)
        self.assertTrue(out["wakeAgent"])
        self.assertTrue(c.exists(), "a tree whose save failed must stay")

    def test_stale_top_level_wt_files_are_expired(self):
        # Build logs agents write next to a checkout: wt-12249-build.log and friends.
        old = self.s.agent / "wt-12249-build.log"
        old.write_text("log\n")
        age_tree(old, 30)
        fresh = self.s.agent / "wt-14500-build.log"
        fresh.write_text("log\n")
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["files_expired"], 1, self.s.report())
        self.assertFalse(old.exists())
        self.assertTrue(fresh.exists())

    def test_stale_scratch_directories_are_expired_and_durable_ones_kept(self):
        for name in ("review-14416", "devin-13619-r2", "B-13514-r2", "scratch-voidptr", "tools", "memory"):
            (self.s.agent / name).mkdir()
            (self.s.agent / name / "notes.md").write_text("x\n")
        self.s.age_all(30)
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["scratch_expired"], 4, self.s.report())
        for name in ("review-14416", "devin-13619-r2", "B-13514-r2", "scratch-voidptr"):
            self.assertFalse((self.s.agent / name).exists(), name)
        self.assertTrue((self.s.agent / "tools").exists())
        self.assertTrue((self.s.agent / "memory").exists())

    def test_recent_scratch_directory_is_kept(self):
        (self.s.agent / "review-14500").mkdir()
        (self.s.agent / "review-14500" / "lead-section.md").write_text("x\n")
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["scratch_expired"], 0)
        self.assertTrue((self.s.agent / "review-14500").exists())

    def test_scratch_clone_inside_a_scratch_dir_is_bundled_first(self):
        d = self.s.agent / "scratch-881"
        d.mkdir()
        git(d, "clone", "-q", str(self.slang), "repo", days_ago=30)
        (d / "repo" / "f.txt").write_text("edit\n")
        self.s.age_all(30)
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["errors"], 0, self.s.report())
        self.assertFalse(d.exists())
        bundles = list((self.s.agent / ".worktree-gc" / "saved").glob("scratch-881-repo.*.bundle"))
        self.assertEqual(len(bundles), 1, self.s.report())

    def test_bare_clone_is_kept_while_a_checkout_borrows_from_it(self):
        git(self.s.agent, "clone", "-q", "--bare", "--shared", str(self.slang), "bare-13387.git", days_ago=30)
        c = self.s.agent / "wt-13387-revA"
        git(self.s.agent, "clone", "-q", "--shared", str(self.s.agent / "bare-13387.git"), c.name, days_ago=30)
        self.s.age_all(30)
        git(c, "checkout", "-q", "-b", "in-use")  # the borrower is in use, so it stays
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["scratch_expired"], 0, self.s.report())
        self.assertTrue((self.s.agent / "bare-13387.git").exists())

    def test_bare_clone_with_commits_of_its_own_is_bundled_then_expired(self):
        bare = self.s.agent / "bare-13388.git"
        git(self.s.agent, "clone", "-q", "--bare", "--shared", str(self.slang), bare.name, days_ago=30)
        other = self.s.tmp / "other"
        git(self.s.tmp, "clone", "-q", str(self.slang), str(other))
        (other / "g.txt").write_text("pr head\n")
        git(other, "add", "-A")
        git(other, "commit", "-qm", "pr head", days_ago=30)
        sh("git", "--git-dir", str(bare), "fetch", "-q", str(other), "master:refs/heads/pr")
        self.s.age_all(30)
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["scratch_expired"], 1, self.s.report())
        self.assertFalse(bare.exists())
        self.assertEqual(len(list((self.s.agent / ".worktree-gc" / "saved").glob("bare-13388.git.*.bundle"))), 1)

    def test_clone_with_an_unborn_head_is_reaped_without_error(self):
        # `git init` + `remote add` whose fetch never finished: no commit, clean tree.
        # Production: slang-triager's scratch-13527/dxc failed its save every hour.
        d = self.s.agent / "scratch-13527"
        d.mkdir()
        git(d, "init", "-q", "-b", "master", "dxc")
        git(d / "dxc", "remote", "add", "origin", "https://example.invalid/dxc.git")
        unborn_wt = self.s.agent / "wt-13528-verify"
        git(self.s.agent, "init", "-q", "-b", "master", unborn_wt.name)
        self.s.age_all(30)
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["errors"], 0, self.s.report())
        self.assertFalse(d.exists())
        self.assertFalse(unborn_wt.exists())

    def test_unborn_clone_with_files_is_committed_and_bundled(self):
        c = self.s.agent / "wt-13529-drill"
        git(self.s.agent, "init", "-q", "-b", "master", c.name)
        (c / "notes.txt").write_text("only copy\n")
        self.s.age_all(30)
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["errors"], 0, self.s.report())
        bundles = list((self.s.agent / ".worktree-gc" / "saved").glob("wt-13529-drill.*.bundle"))
        self.assertEqual(len(bundles), 1, self.s.report())

    def test_plain_wt_directory_is_kept_and_reported(self):
        (self.s.agent / "wt-notes").mkdir()
        (self.s.agent / "wt-notes" / "draft.md").write_text("x\n")
        self.s.age_all()
        out = self.s.run("--gate")
        self.assertEqual(out["data"]["errors"], 0)
        self.assertTrue((self.s.agent / "wt-notes").exists())


if __name__ == "__main__":
    unittest.main()
