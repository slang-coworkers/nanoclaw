from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

import khrjob


def sh(cwd: Path, *args: str) -> str:
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "T",
        "GIT_AUTHOR_EMAIL": "t@x",
        "GIT_COMMITTER_NAME": "T",
        "GIT_COMMITTER_EMAIL": "t@x",
        "GIT_CONFIG_GLOBAL": os.devnull,
    }
    return subprocess.run(
        args, cwd=cwd, check=True, capture_output=True, text=True, env=env
    ).stdout.strip()


class JobGitEnv(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="khr-gitenv-"))
        self.repo = self.tmp / "repo"
        self.repo.mkdir()
        sh(self.repo, "git", "init", "-q", "-b", "main")
        (self.repo / "AGENTS.md").write_text("trusted\n")
        sh(self.repo, "git", "add", "-A")
        sh(self.repo, "git", "commit", "-q", "-m", "c")

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_missing_object_never_runs_a_configured_upload_pack(self) -> None:
        blob = sh(self.repo, "git", "rev-parse", "HEAD:AGENTS.md")
        (self.repo / ".git/objects" / blob[:2] / blob[2:]).unlink()
        marker = self.tmp / "upload-pack-ran"
        hook = self.tmp / "evil-upload-pack"
        hook.write_text(f"#!/bin/sh\ntouch {marker}\nexit 1\n")
        hook.chmod(0o755)
        for key, value in (
            ("core.repositoryformatversion", "1"),
            ("extensions.partialClone", "origin"),
            ("remote.origin.url", f"file://{self.tmp / 'nowhere'}"),
            ("remote.origin.promisor", "true"),
            ("remote.origin.uploadpack", str(hook)),
        ):
            sh(self.repo, "git", "config", key, value)
        with self.assertRaises(khrjob.JobError):
            khrjob.git_bytes(self.repo, "cat-file", "blob", blob)
        self.assertFalse(marker.exists(), "lazy fetch ran the configured upload-pack")

    def test_replacement_refs_are_ignored(self) -> None:
        real = sh(self.repo, "git", "rev-parse", "HEAD:AGENTS.md")
        (self.tmp / "fake").write_text("injected\n")
        fake = sh(self.repo, "git", "hash-object", "-w", str(self.tmp / "fake"))
        sh(self.repo, "git", "replace", "-f", real, fake)
        self.assertEqual(
            khrjob.git_bytes(self.repo, "cat-file", "blob", real), b"trusted\n"
        )

    def test_no_show_signature_keeps_gpg_program_from_running(self) -> None:
        # A commit carrying a signature header, plus log.showSignature and a
        # marker gpg.program, as a hostile repository could configure.
        tree = sh(self.repo, "git", "rev-parse", "HEAD^{tree}")
        body = (
            f"tree {tree}\nauthor T <t@x> 1 +0000\ncommitter T <t@x> 1 +0000\n"
            "gpgsig -----BEGIN PGP SIGNATURE-----\n \n AAAA\n -----END PGP SIGNATURE-----\n\nsigned\n"
        )
        (self.tmp / "c").write_text(body)
        signed = sh(
            self.repo, "git", "hash-object", "-t", "commit", "-w", str(self.tmp / "c")
        )
        marker = self.tmp / "gpg-ran"
        gpg = self.tmp / "gpg"
        gpg.write_text(f"#!/bin/sh\ntouch {marker}\nexit 1\n")
        gpg.chmod(0o755)
        sh(self.repo, "git", "config", "log.showSignature", "true")
        sh(self.repo, "git", "config", "gpg.program", str(gpg))
        khrjob.git(self.repo, "log", "-1", "--format=%ct", signed, check=False)
        self.assertTrue(marker.exists(), "this git verifies signatures on plain log")
        marker.unlink()
        khrjob.git(
            self.repo, "log", "--no-show-signature", "-1", "--format=%ct", signed
        )
        self.assertFalse(marker.exists())

    def marker_script(self, name: str) -> tuple[Path, Path]:
        marker = self.tmp / f"{name}-ran"
        script = self.tmp / name
        script.write_text(f"#!/bin/sh\ntouch {marker}\nexit 1\n")
        script.chmod(0o755)
        return script, marker

    def test_fsmonitor_is_not_run_by_status(self) -> None:
        script, marker = self.marker_script("fsmonitor")
        sh(self.repo, "git", "config", "core.fsmonitor", str(script))
        khrjob.git(self.repo, "status", "--porcelain")
        self.assertFalse(marker.exists())

    def test_hooks_are_not_run_by_worktree_add(self) -> None:
        script, marker = self.marker_script("post-checkout")
        hooks = self.repo / ".git" / "hooks"
        hooks.mkdir(exist_ok=True)
        shutil.copy(script, hooks / "post-checkout")
        khrjob.git(
            self.repo,
            "worktree",
            "add",
            "--quiet",
            "-b",
            "t",
            str(self.tmp / "wt"),
            "HEAD",
        )
        self.assertTrue((self.tmp / "wt" / "AGENTS.md").exists())
        self.assertFalse(marker.exists())

    def test_filters_are_refused_before_checkout_or_status(self) -> None:
        khrjob.reject_filters(self.repo)  # none in the repository's own config
        sh(self.repo, "git", "config", "filter.x.smudge", "cat")
        with self.assertRaisesRegex(khrjob.JobError, "git filters"):
            khrjob.reject_filters(self.repo)

    def test_linked_worktree_without_filters_is_accepted(self) -> None:
        khrjob.git(
            self.repo,
            "worktree",
            "add",
            "--quiet",
            "-b",
            "w",
            str(self.tmp / "wt"),
            "HEAD",
        )
        khrjob.reject_filters(self.tmp / "wt")

    def test_filter_in_per_worktree_config_is_refused(self) -> None:
        khrjob.git(
            self.repo,
            "worktree",
            "add",
            "--quiet",
            "-b",
            "w",
            str(self.tmp / "wt"),
            "HEAD",
        )
        sh(self.repo, "git", "config", "extensions.worktreeConfig", "true")
        sh(self.tmp / "wt", "git", "config", "--worktree", "filter.x.clean", "cat")
        with self.assertRaisesRegex(khrjob.JobError, "git filters"):
            khrjob.reject_filters(self.tmp / "wt")

    def test_filter_hidden_in_an_included_file_is_refused(self) -> None:
        inc = self.tmp / "inc.cfg"
        inc.write_text('[filter "x"]\n\tclean = cat\n')
        sh(self.repo, "git", "config", "include.path", str(inc))
        with self.assertRaisesRegex(khrjob.JobError, "git filters"):
            khrjob.reject_filters(self.repo)

    def test_log_encoding_is_forced_to_utf8(self) -> None:
        sh(self.repo, "git", "config", "i18n.logOutputEncoding", "UTF-16")
        out = khrjob.git(
            self.repo,
            "log",
            "--no-show-signature",
            "--encoding=UTF-8",
            "-1",
            "--format=%an",
        )
        self.assertEqual(out, "T")

    def test_credential_helpers_and_askpass_are_disabled(self) -> None:
        env = khrjob.git_env()
        pairs = {
            env[f"GIT_CONFIG_KEY_{i}"]: env[f"GIT_CONFIG_VALUE_{i}"]
            for i in range(int(env["GIT_CONFIG_COUNT"]))
        }
        self.assertEqual(pairs["credential.helper"], "")
        self.assertEqual(pairs["core.hooksPath"], "/dev/null")
        self.assertEqual(pairs["core.fsmonitor"], "false")
        self.assertEqual(env["GIT_ASKPASS"], "/bin/false")
        self.assertEqual(env["GIT_ALLOW_PROTOCOL"], "https:file")
        sh(self.repo, "git", "config", "credential.helper", "!touch /tmp/never")
        got = subprocess.run(
            ["git", "-C", str(self.repo), "config", "--get-all", "credential.helper"],
            capture_output=True,
            text=True,
            env=env,
            check=False,
        ).stdout.splitlines()
        self.assertEqual(got[-1], "", "command-scope empty helper resets the list")

    def test_every_explicit_fetch_names_its_upload_pack(self) -> None:
        import re

        scripts = HERE.parents[1]
        calls = []
        for path in sorted(scripts.glob("khr-*/scripts/*.py")):
            text = path.read_text()
            for m in re.finditer(r'"fetch",', text):
                window = text[m.end() : m.end() + 160]
                calls.append((path.name, "--upload-pack=" in window))
        self.assertTrue(calls)
        self.assertEqual([c for c in calls if not c[1]], [])

    def test_every_job_git_log_disables_signatures(self) -> None:
        import re

        scripts = HERE.parents[1]
        calls = []
        for path in sorted(scripts.glob("khr-*/scripts/*.py")):
            text = path.read_text()
            for m in re.finditer(r'"log",', text):
                window = text[m.end() : m.end() + 240]
                calls.append(
                    (
                        path.name,
                        "--no-show-signature" in window
                        and "--encoding=UTF-8" in window,
                    )
                )
        self.assertTrue(calls, "found no git log calls to check")
        self.assertEqual([c for c in calls if not c[1]], [])


if __name__ == "__main__":
    unittest.main()
