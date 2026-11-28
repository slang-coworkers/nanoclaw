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


if __name__ == "__main__":
    unittest.main()
