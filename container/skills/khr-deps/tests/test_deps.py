from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
sys.path.insert(0, str(HERE.parents[1] / "khr-job-prep" / "scripts"))

import fetch_deps
import khrdeps
import pins
import prepare_job

ALLOW = khrdeps.load_allowlist()
SHA = "a" * 40


def sh(cwd: Path, *args: str) -> str:
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "T",
        "GIT_AUTHOR_EMAIL": "t@x",
        "GIT_COMMITTER_NAME": "T",
        "GIT_COMMITTER_EMAIL": "t@x",
    }
    return subprocess.run(
        args, cwd=cwd, check=True, capture_output=True, text=True, env=env
    ).stdout.strip()


def repo_with(root: Path, files: dict[str, str]) -> tuple[Path, str]:
    root.mkdir(parents=True)
    sh(root, "git", "init", "-q", "-b", "main")
    for name, text in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(text)
    sh(root, "git", "add", "-A")
    sh(root, "git", "commit", "-q", "-m", "c")
    return root, sh(root, "git", "rev-parse", "HEAD")


class AllowlistTests(unittest.TestCase):
    def test_git_pin_rules(self) -> None:
        self.assertEqual(
            khrdeps.git_pin(
                "https://github.com/KhronosGroup/SPIRV-Headers.git", SHA, ALLOW
            )["repo"],
            "KhronosGroup/SPIRV-Headers",
        )
        self.assertEqual(
            khrdeps.git_pin(
                "https://github.com/KhronosGroup/Vulkan-Headers", "v1.4.330", ALLOW
            )["ref"],
            "v1.4.330",
        )
        for url, ref in [
            ("https://github.com/evil/repo.git", SHA),
            ("https://gitlab.com/KhronosGroup/SPIRV-Headers.git", SHA),
            ("https://github.com/KhronosGroup/SPIRV-Headers.git", "main"),
            ("https://github.com/KhronosGroup/SPIRV-Headers.git", "a" * 39),
        ]:
            with self.assertRaises(khrdeps.PinError):
                khrdeps.git_pin(url, ref, ALLOW)

    def test_npm_and_blob_rules(self) -> None:
        integ = "sha512-" + base64.b64encode(b"\x01" * 64).decode()
        self.assertEqual(
            khrdeps.npm_pin("https://registry.npmjs.org/a/-/a-1.0.0.tgz", integ, ALLOW)[
                "sha512"
            ],
            "01" * 64,
        )
        for url, i in [
            ("https://evil.example/a.tgz", integ),
            ("https://registry.npmjs.org/a/-/a-1.0.0.tgz", "sha1-abc"),
            ("https://registry.npmjs.org/a/../b.tgz", integ),
            ("https://registry.npmjs.org/a/-/a.tgz?x=1", integ),
        ]:
            with self.assertRaises((khrdeps.PinError, ValueError)):
                khrdeps.npm_pin(url, i, ALLOW)
        url = next(iter(ALLOW["archives"]))
        self.assertEqual(khrdeps.blob_pin(url, ALLOW)["sha256"], ALLOW["archives"][url])
        with self.assertRaises(khrdeps.PinError):
            khrdeps.blob_pin("https://github.com/evil/x.zip", ALLOW)


class ParserTests(unittest.TestCase):
    def test_known_good_both_forms(self) -> None:
        repos = json.dumps(
            {
                "repos": [
                    {
                        "name": "Vulkan-Headers",
                        "url": "https://github.com/KhronosGroup/Vulkan-Headers.git",
                        "commit": "v1.4.330",
                    },
                    {
                        "name": "x",
                        "url": "https://github.com/evil/x.git",
                        "commit": SHA,
                    },
                ]
            }
        ).encode()
        got = pins.parse_known_good(repos, ALLOW)
        self.assertEqual(got[0]["kind"], "git")
        self.assertEqual(got[1]["kind"], "unavailable")
        self.assertNotIn("evil", json.dumps(got[1]))
        commits = json.dumps(
            {
                "commits": [
                    {
                        "name": "spirv-tools",
                        "site": "github",
                        "subrepo": "KhronosGroup/SPIRV-Tools",
                        "commit": SHA,
                    }
                ]
            }
        ).encode()
        self.assertEqual(
            pins.parse_known_good(commits, ALLOW)[0]["repo"], "KhronosGroup/SPIRV-Tools"
        )

    def test_deps_ast_only(self) -> None:
        raw = b"""vars = {'github': 'https://github.com', 'h': '%s'}
deps = {
  'external/spirv-headers': Var('github') + '/KhronosGroup/SPIRV-Headers.git@' + Var('h'),
  'external/protobuf': Var('github') + '/protocolbuffers/protobuf.git@' + Var('h'),
  'buildtools': {'packages': [], 'dep_type': 'cipd'},
}""" % SHA.encode()
        got = pins.parse_deps(raw, ALLOW)
        self.assertEqual(
            [(p["kind"], p.get("repo")) for p in got],
            [("git", "KhronosGroup/SPIRV-Headers")],
        )
        with self.assertRaises(khrdeps.PinError):
            pins.parse_deps(
                b"vars = {}\ndeps = {'a': __import__('os').system('x')}", ALLOW
            )

    def test_package_lock(self) -> None:
        integ = "sha512-" + base64.b64encode(b"\x02" * 64).decode()
        raw = json.dumps(
            {
                "lockfileVersion": 3,
                "packages": {
                    "": {},
                    "node_modules/a": {
                        "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz",
                        "integrity": integ,
                    },
                    "node_modules/b": {"link": True},
                    "node_modules/c": {
                        "resolved": "https://evil.example/c.tgz",
                        "integrity": integ,
                    },
                },
            }
        ).encode()
        got = pins.parse_package_lock(raw, ALLOW)
        self.assertEqual([p["kind"] for p in got], ["npm", "unavailable"])

    def test_gitmodules_uses_recorded_gitlink(self) -> None:
        with tempfile.TemporaryDirectory() as t:
            r, _ = repo_with(
                Path(t) / "r",
                {
                    ".gitmodules": '[submodule "h"]\n\tpath = external/h\n\turl = https://github.com/KhronosGroup/SPIRV-Headers.git\n'
                },
            )
            sh(
                r,
                "git",
                "update-index",
                "--add",
                "--cacheinfo",
                f"160000,{SHA},external/h",
            )
            sh(r, "git", "commit", "-q", "-m", "gitlink")
            rev = sh(r, "git", "rev-parse", "HEAD")
            got = pins.extract(
                {"kind": "gitmodules", "path": ".gitmodules"}, r, rev, ALLOW
            )
            self.assertEqual(got["pins"][0]["ref"], SHA)

    def test_declaration_read_only_at_exact_commit(self) -> None:
        with tempfile.TemporaryDirectory() as t:
            r, rev = repo_with(Path(t) / "r", {"DEPS": "vars = {}\ndeps = {}\n"})
            with self.assertRaises(khrdeps.PinError):
                pins.read_at(r, "main", "DEPS", 1 << 20)
            with self.assertRaises(khrdeps.PinError):
                pins.read_at(r, rev, "../etc/passwd", 1 << 20)


class FetchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.gh = base / "gh"
        src, self.sha = repo_with(base / "src", {"README": "headers\n"})
        (self.gh / "KhronosGroup").mkdir(parents=True)
        sh(
            base,
            "git",
            "clone",
            "-q",
            "--bare",
            str(src),
            str(self.gh / "KhronosGroup" / "SPIRV-Headers.git"),
        )
        sh(
            self.gh / "KhronosGroup" / "SPIRV-Headers.git",
            "git",
            "config",
            "uploadpack.allowAnySHA1InWant",
            "true",
        )
        self.root = base / "cache"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_git_fetch_present_and_refusals(self) -> None:
        req = {
            "pins": [
                {
                    "kind": "git",
                    "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                    "ref": self.sha,
                },
                {
                    "kind": "git",
                    "url": "https://github.com/evil/repo.git",
                    "ref": self.sha,
                },
                {"kind": "blob", "url": "https://evil.example/x"},
            ]
        }
        res = fetch_deps.run(req, self.root, ALLOW, git_base=f"file://{self.gh}")
        self.assertEqual([r["status"] for r in res], ["fetched", "refused", "refused"])
        self.assertTrue(
            khrdeps.pin_present(
                self.root, khrdeps.git_pin(req["pins"][0]["url"], self.sha, ALLOW)
            )
        )
        again = fetch_deps.run(req, self.root, ALLOW, git_base=f"file://{self.gh}")
        self.assertEqual(again[0]["status"], "present")
        push = subprocess.run(
            [
                "git",
                "-C",
                str(khrdeps.mirror_path(self.root, "KhronosGroup/SPIRV-Headers")),
                "push",
                "origin",
                "HEAD",
            ],
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(push.returncode, 0)

    def test_download_hash_mismatch_never_lands(self) -> None:
        url = next(iter(ALLOW["files"]))

        class Opener:
            def __init__(self, body: bytes):
                self.body = body

            def open(self, req, timeout=0):
                return io.BytesIO(self.body)

        res = fetch_deps.run(
            {"pins": [{"kind": "blob", "url": url}]},
            self.root,
            ALLOW,
            opener=Opener(b"tampered"),
        )
        self.assertEqual(res[0]["status"], "failed")
        self.assertFalse((self.root / "blobs" / ALLOW["files"][url]).exists())
        self.assertEqual(list((self.root / "blobs").glob(".part-*")), [])

    def test_npm_download_verified(self) -> None:
        body = b"tarball-bytes"
        integ = "sha512-" + base64.b64encode(hashlib.sha512(body).digest()).decode()
        pin = khrdeps.npm_pin(
            "https://registry.npmjs.org/a/-/a-1.0.0.tgz", integ, ALLOW
        )

        class Opener:
            def open(self, req, timeout=0):
                return io.BytesIO(body)

        res = fetch_deps.run(
            {"pins": [{"kind": "npm", "url": pin["url"], "sha512": pin["sha512"]}]},
            self.root,
            ALLOW,
            opener=Opener(),
        )
        self.assertEqual(res[0]["status"], "fetched")


class InventoryTests(unittest.TestCase):
    def test_prepare_writes_inventory_then_ready_after_fetch(self) -> None:
        with tempfile.TemporaryDirectory() as t:
            base = Path(t)
            gh = base / "gh"
            dep, dep_sha = repo_with(base / "dep", {"x": "1\n"})
            (gh / "KhronosGroup").mkdir(parents=True)
            sh(
                base,
                "git",
                "clone",
                "-q",
                "--bare",
                str(dep),
                str(gh / "KhronosGroup" / "SPIRV-Headers.git"),
            )
            sh(
                gh / "KhronosGroup" / "SPIRV-Headers.git",
                "git",
                "config",
                "uploadpack.allowAnySHA1InWant",
                "true",
            )
            kg = json.dumps(
                {
                    "repos": [
                        {
                            "name": "SPIRV-Headers",
                            "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                            "commit": dep_sha,
                        }
                    ]
                }
            )
            src, _ = repo_with(
                base / "src", {"scripts/known_good.json": kg, "AGENTS.md": "rules\n"}
            )
            origin = base / "origin.git"
            sh(base, "git", "clone", "-q", "--bare", str(src), str(origin))
            agent = base / "agent"
            (agent / "jobs" / "j").mkdir(parents=True)
            (agent / "jobs" / "j" / "request.json").write_text(
                json.dumps({"project_id": 7, "kind": "issue", "iid": 1, "mode": "live"})
            )
            manifest = agent / "m.json"
            manifest.write_text(
                json.dumps(
                    {
                        "schema": 1,
                        "gitlabUrl": "https://gl.invalid",
                        "identity": {"name": "b", "email": "b@x"},
                        "cacheRoot": str(agent / "khr-cache"),
                        "repositories": [
                            {
                                "name": "vvl",
                                "projectPath": "g/vvl",
                                "cloneUrl": f"file://{origin}",
                                "dependencies": {
                                    "kind": "known-good",
                                    "path": "scripts/known_good.json",
                                },
                            }
                        ],
                    }
                )
            )
            deps = base / "shared"
            with mock.patch.dict(os.environ, {"KHR_DEPS_ROOT": str(deps)}):
                out = prepare_job.prepare(agent / "jobs" / "j", manifest)
                self.assertEqual(out["dependencies"]["missing"], 1)
                req = json.loads(
                    (agent / "jobs" / "j" / "pin-request.json").read_text()
                )
                self.assertEqual(
                    req["pins"],
                    [
                        {
                            "kind": "git",
                            "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                            "ref": dep_sha,
                        }
                    ],
                )
                fetch_deps.run(req, deps, ALLOW, git_base=f"file://{gh}")
                inv = prepare_job.inventory(
                    agent / "jobs" / "j", json.loads(manifest.read_text())
                )
                self.assertEqual(inv["summary"]["ready"], 1)
                self.assertFalse((agent / "jobs" / "j" / "pin-request.json").exists())
            for p in agent.rglob("*"):
                try:
                    p.chmod(0o755 if p.is_dir() else 0o644)
                except OSError:
                    pass


if __name__ == "__main__":
    unittest.main()
