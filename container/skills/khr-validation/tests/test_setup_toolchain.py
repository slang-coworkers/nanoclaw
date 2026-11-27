from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

import setup_toolchain


class SetupToolchainTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.job = self.root / "jobs" / "j"
        self.job.mkdir(parents=True)
        self.wheels = self.root / "wheels"
        self.wheels.mkdir()
        (self.wheels / "pkg-1.0-py3-none-any.whl").write_bytes(b"x")
        self.req = self.root / "req.txt"
        self.req.write_text("pkg==1.0 --hash=sha256:" + "0" * 64 + "\n")
        self.calls: list[list[str]] = []
        self.env = mock.patch.dict(
            os.environ, {"KHR_DEPENDENCY_ROOT": str(self.root / "deps")}
        )
        self.env.start()

    def tearDown(self) -> None:
        self.env.stop()
        self.tmp.cleanup()

    def pip(self, cmd: list[str]) -> int:
        self.calls.append(cmd)
        return 0

    def test_offline_hash_pinned_install_and_reuse(self) -> None:
        rec = setup_toolchain.setup(
            self.job, self.wheels, self.req, pip_runner=self.pip
        )
        self.assertFalse(rec["reused"])
        cmd = self.calls[0]
        for flag in ("--no-index", "--only-binary=:all:", "--require-hashes"):
            self.assertIn(flag, cmd)
        self.assertEqual(cmd[cmd.index("--find-links") + 1], str(self.wheels))
        self.assertTrue(
            (self.root / "deps" / "toolchain.env")
            .read_text()
            .startswith('export PATH="')
        )
        self.assertIn(
            "versions", json.loads((self.root / "deps" / "toolchain.json").read_text())
        )
        again = setup_toolchain.setup(
            self.job, self.wheels, self.req, pip_runner=self.pip
        )
        self.assertTrue(again["reused"])
        self.assertEqual(len(self.calls), 1)

    def test_changed_requirements_reinstall(self) -> None:
        setup_toolchain.setup(self.job, self.wheels, self.req, pip_runner=self.pip)
        self.req.write_text(self.req.read_text() + "# bump\n")
        setup_toolchain.setup(self.job, self.wheels, self.req, pip_runner=self.pip)
        self.assertEqual(len(self.calls), 2)

    def test_missing_cache_is_infrastructure_error(self) -> None:
        rc = setup_toolchain.main(
            [
                "--job",
                str(self.job),
                "--wheels",
                str(self.root / "nope"),
                "--requirements",
                str(self.req),
            ]
        )
        self.assertEqual(rc, 3)

    def test_failed_install_is_infrastructure_error(self) -> None:
        with self.assertRaises(SystemExit) as cm:
            setup_toolchain.setup(
                self.job, self.wheels, self.req, pip_runner=lambda cmd: 1
            )
        self.assertEqual(cm.exception.code, 4)

    def test_shipped_requirements_are_fully_hash_pinned(self) -> None:
        text = setup_toolchain.DEFAULT_REQUIREMENTS.read_text()
        pins = [
            line
            for line in text.splitlines()
            if "==" in line and not line.lstrip().startswith("#")
        ]
        self.assertGreaterEqual(len(pins), 5)
        body = text.replace("\\\n", " ")
        for line in body.splitlines():
            if "==" in line and not line.lstrip().startswith("#"):
                self.assertRegex(line, r"--hash=sha256:[0-9a-f]{64}")


if __name__ == "__main__":
    unittest.main()
