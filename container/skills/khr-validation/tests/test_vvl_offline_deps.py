from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
sys.path.insert(0, str(HERE.parents[1] / "khr-deps" / "scripts"))

import khrdeps
import pins
import vvl_offline_deps as vod

SLANG_URL = (
    "https://github.com/shader-slang/slang/releases/download/"
    "v{release}/slang-{release}-{system}-{arch}.zip"
)
SLANG_MAP = {"64": "x86_64", "darwin": "macos"}


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


def make_repo(path: Path, files: dict[str, str]) -> str:
    path.mkdir(parents=True)
    sh(path, "git", "init", "-q", "-b", "main")
    for rel, text in files.items():
        (path / rel).parent.mkdir(parents=True, exist_ok=True)
        (path / rel).write_text(text)
    sh(path, "git", "add", "-A")
    sh(path, "git", "commit", "-q", "-m", "c")
    return sh(path, "git", "rev-parse", "HEAD")


def zip_bytes(entries: list[tuple[str, str, int]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data, mode in entries:
            info = zipfile.ZipInfo(name)
            info.external_attr = mode << 16
            z.writestr(info, data)
    return buf.getvalue()


class VvlOfflineDeps(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="khr-vod-"))
        self.cache = self.tmp / "cache"
        src = self.tmp / "src"
        # Vulkan-Headers pinned by tag, SPIRV-Headers by exact SHA.
        make_repo(src / "headers", {"include/vulkan.h": "v1\n"})
        sh(src / "headers", "git", "tag", "v1.4.369")
        (src / "headers" / "include" / "vulkan.h").write_text("v2 unpinned\n")
        sh(src / "headers", "git", "commit", "-qam", "newer")
        self.spirv_sha = make_repo(src / "spirv", {"spirv.h": "spv\n"})
        for repo, work in (
            ("KhronosGroup/Vulkan-Headers", src / "headers"),
            ("KhronosGroup/SPIRV-Headers", src / "spirv"),
        ):
            mirror = khrdeps.mirror_path(self.cache, repo)
            mirror.parent.mkdir(parents=True, exist_ok=True)
            sh(self.tmp, "git", "clone", "-q", "--bare", str(work), str(mirror))
        self.headers_tag_sha = sh(
            src / "headers", "git", "rev-parse", "v1.4.369^{commit}"
        )

        self.zip = zip_bytes(
            [
                ("bin/slangc", "#!/bin/sh\n", 0o100755),
                ("lib/libslang.so.1", "so", 0o100644),
                ("lib/libslang.so", "libslang.so.1", 0o120777),
            ]
        )
        sha = hashlib.sha256(self.zip).hexdigest()
        (self.cache / "blobs").mkdir()
        (self.cache / "blobs" / sha).write_bytes(self.zip)
        self.allow = copy.deepcopy(khrdeps.load_allowlist())
        # The native script names the artifact for the host it runs on (linux x86_64 in a job).
        host = platform.system().lower()
        self.slang_url = SLANG_URL.format(
            release="2026.1.0", system=SLANG_MAP.get(host, host), arch="x86_64"
        )
        self.allow["archives"] = {self.slang_url: sha}

        self.vvl = self.tmp / "vvl"
        (self.vvl / "scripts").mkdir(parents=True)
        shutil.copy(
            HERE / "fixtures" / "native_update_deps.py",
            self.vvl / "scripts" / "update_deps.py",
        )
        self.known_good(
            [
                {
                    "name": "Vulkan-Headers",
                    "url": "https://github.com/KhronosGroup/Vulkan-Headers.git",
                    "sub_dir": "Vulkan-Headers",
                    "commit": "v1.4.369",
                },
                {
                    "name": "SPIRV-Headers",
                    "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                    "sub_dir": "SPIRV-Headers",
                    "commit": self.spirv_sha,
                },
                {
                    "name": "slang",
                    "url": SLANG_URL,
                    "sub_dir": "slang",
                    "build_dir": "slang/download",
                    "install_dir": "slang/install",
                    "release": "2026.1.0",
                    "url_format_map": SLANG_MAP,
                    "optional": ["tests"],
                },
            ]
        )
        self.ext = self.tmp / "external"

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def known_good(self, repos: list[dict]) -> None:
        (self.vvl / "scripts" / "known_good.json").write_text(
            json.dumps({"repos": repos})
        )

    def run_adapter(
        self, *native: str, providers: dict[str, Path] | None = None
    ) -> int:
        return vod.run(
            self.vvl,
            ["--dir", str(self.ext), *native],
            providers,
            self.allow,
            self.cache,
        )

    def test_pinned_baseline_materializes_exact_commits_offline(self) -> None:
        self.assertEqual(self.run_adapter(), 0)
        h = self.ext / "Vulkan-Headers"
        self.assertEqual(sh(h, "git", "rev-parse", "HEAD"), self.headers_tag_sha)
        self.assertEqual((h / "include" / "vulkan.h").read_text(), "v1\n")
        self.assertEqual(sh(h, "git", "rev-parse", "--is-shallow-repository"), "true")
        self.assertEqual(
            sh(self.ext / "SPIRV-Headers", "git", "rev-parse", "HEAD"), self.spirv_sha
        )
        rec = json.loads((self.ext / vod.RECORD).read_text())
        roles = {d["name"]: d["role"] for d in rec["dependencies"]}
        self.assertEqual(
            roles,
            {
                "Vulkan-Headers": "pinned-baseline",
                "SPIRV-Headers": "pinned-baseline",
                "slang": "pinned-artifact",
            },
        )
        self.assertIn("VULKAN_HEADERS_DIR", (self.ext / "helper.cmake").read_text())

    def test_release_artifact_extracts_from_verified_blob(self) -> None:
        self.assertEqual(self.run_adapter(), 0)
        inst = self.ext / "slang" / "install"
        self.assertTrue(os.access(inst / "bin" / "slangc", os.X_OK))
        self.assertTrue((inst / "lib" / "libslang.so").is_symlink())
        self.assertEqual((inst / ".release").read_text(), Path(self.slang_url).name)

    def test_release_artifact_without_artifact_url_method(self) -> None:
        # vulkan-sdk-1.4.363.1 builds the URL inline in DownloadAndExtractArtifact.
        script = self.vvl / "scripts" / "update_deps.py"
        text = script.read_text()
        self.assertIn("def ArtifactUrl(self):", text)
        text = text.replace("def ArtifactUrl(self):", "def _inline_url(self):")
        script.write_text(text.replace("self.ArtifactUrl()", "self._inline_url()"))
        self.assertEqual(self.run_adapter(), 0)
        inst = self.ext / "slang" / "install"
        self.assertTrue(os.access(inst / "bin" / "slangc", os.X_OK))
        rec = {
            d["name"]: d
            for d in json.loads((self.ext / vod.RECORD).read_text())["dependencies"]
        }
        self.assertEqual(rec["slang"]["url"], self.slang_url)

    def test_optional_tests_skip_artifact(self) -> None:
        self.assertEqual(self.run_adapter("--optional", "tests"), 0)
        self.assertFalse((self.ext / "slang").exists())

    def test_rerun_rebuilds_snapshot_even_when_index_hides_edits(self) -> None:
        self.run_adapter()
        h = self.ext / "Vulkan-Headers"
        sh(h, "git", "update-index", "--assume-unchanged", "include/vulkan.h")
        (h / "include" / "vulkan.h").write_text("hidden edit\n")
        (h / ".git" / "planted").write_text("x")
        self.assertEqual(sh(h, "git", "status", "--porcelain"), "")
        self.run_adapter()
        self.assertEqual((h / "include" / "vulkan.h").read_text(), "v1\n")
        self.assertFalse((h / ".git" / "planted").exists())

    def test_relative_dir_survives_native_chdir(self) -> None:
        cwd = os.getcwd()
        os.chdir(self.tmp)
        try:
            code = vod.run(
                self.vvl, ["--dir", "external"], None, self.allow, self.cache
            )
        finally:
            os.chdir(cwd)
        self.assertEqual(code, 0)
        self.assertTrue((self.tmp / "external" / vod.RECORD).is_file())
        self.assertFalse((self.tmp / "external" / "external").exists())

    def test_last_dir_wins_like_native_argparse(self) -> None:
        other = self.tmp / "other"
        args = ["--dir", str(other), "--dir", str(self.ext)]
        self.assertEqual(vod.run(self.vvl, args, None, self.allow, self.cache), 0)
        self.assertTrue((self.ext / vod.RECORD).is_file())
        self.assertFalse(other.exists())

    def test_record_and_download_never_write_through_links(self) -> None:
        victim = self.tmp / "victim"
        victim.write_text("keep")
        self.ext.mkdir()
        (self.ext / vod.RECORD).symlink_to(victim)
        dl = self.ext / "slang" / "download"
        dl.mkdir(parents=True)
        hard = self.tmp / "victim-hard"
        hard.write_text("keep")
        os.link(hard, dl / Path(self.slang_url).name)
        self.assertEqual(self.run_adapter(), 0)
        self.assertEqual(victim.read_text(), "keep")
        self.assertEqual(hard.read_text(), "keep")
        self.assertFalse((self.ext / vod.RECORD).is_symlink())
        rec = json.loads((self.ext / vod.RECORD).read_text())
        self.assertEqual(rec["provenance"], "agent-reported")

    def test_fsmonitor_hook_in_provider_is_not_run(self) -> None:
        job = self.tmp / "job-headers"
        make_repo(job, {"include/vulkan.h": "job change\n"})
        marker = self.tmp / "fsmonitor-ran"
        hook = self.tmp / "hook.sh"
        hook.write_text(f"#!/bin/sh\ntouch {marker}\n")
        hook.chmod(0o755)
        sh(job, "git", "config", "core.fsmonitor", str(hook))
        self.assertEqual(self.run_adapter(providers={"Vulkan-Headers": job}), 0)
        self.assertFalse(marker.exists())

    def test_no_bytecode_written_into_job_repository(self) -> None:
        saved = sys.dont_write_bytecode
        try:
            self.run_adapter()
        finally:
            sys.dont_write_bytecode = saved
        self.assertFalse((self.vvl / "scripts" / "__pycache__").exists())

    def test_foreign_owned_mirror_is_trusted_explicitly(self) -> None:
        # The orchestrator owns the read-only mirrors; the job may run as another
        # uid. Git's ownership test switch makes every repository look foreign.
        real = khrdeps.clean_git_env

        def foreign() -> dict[str, str]:
            return {**real(), "GIT_TEST_ASSUME_DIFFERENT_OWNER": "1"}

        with mock.patch.object(khrdeps, "clean_git_env", foreign):
            self.assertEqual(self.run_adapter(), 0)

    def test_missing_pin_fails_closed(self) -> None:
        shutil.rmtree(khrdeps.mirror_path(self.cache, "KhronosGroup/SPIRV-Headers"))
        with self.assertRaisesRegex(vod.OfflineError, "not in the shared cache"):
            self.run_adapter()

    def test_missing_pin_writes_a_request_before_native_runs(self) -> None:
        shutil.rmtree(khrdeps.mirror_path(self.cache, "KhronosGroup/SPIRV-Headers"))
        with self.assertRaisesRegex(vod.OfflineError, "send it to khr-deps"):
            self.run_adapter()
        req = json.loads((self.ext / "pin-request.json").read_text())
        self.assertEqual(
            req["pins"],
            [
                {
                    "kind": "git",
                    "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                    "ref": self.spirv_sha,
                }
            ],
        )
        self.assertFalse((self.ext / "Vulkan-Headers").exists(), "native never ran")

    def test_optional_entries_are_not_requested_when_skipped(self) -> None:
        sha = self.allow["archives"][self.slang_url]
        # pins name the artifact for the linux job host; on another test host the
        # native fixture asks for its own. Review both so the preflight sees it.
        linux = SLANG_URL.format(release="2026.1.0", system="linux", arch="x86_64")
        self.allow["archives"][linux] = sha
        (self.cache / "blobs" / sha).unlink()
        self.assertEqual(self.run_adapter("--optional", "tests"), 0)
        self.assertFalse((self.ext / "pin-request.json").exists())
        with self.assertRaisesRegex(vod.OfflineError, "not in the shared cache: slang"):
            self.run_adapter()

    def test_unreviewed_repository_is_refused(self) -> None:
        self.known_good(
            [
                {
                    "name": "evil",
                    "url": "https://github.com/evil/repo.git",
                    "sub_dir": "evil",
                    "commit": self.spirv_sha,
                }
            ]
        )
        with self.assertRaisesRegex(vod.OfflineError, "unreviewed source"):
            self.run_adapter()

    def test_branch_ref_is_refused(self) -> None:
        self.known_good(
            [
                {
                    "name": "SPIRV-Headers",
                    "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                    "sub_dir": "SPIRV-Headers",
                    "commit": "main",
                }
            ]
        )
        with self.assertRaisesRegex(vod.OfflineError, "exact SHA or version tag"):
            self.run_adapter()

    def test_sub_dir_escaping_root_is_refused(self) -> None:
        self.known_good(
            [
                {
                    "name": "SPIRV-Headers",
                    "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                    "sub_dir": "../escape",
                    "commit": self.spirv_sha,
                }
            ]
        )
        with self.assertRaisesRegex(vod.OfflineError, "escapes the --dir root"):
            self.run_adapter()
        self.assertFalse((self.tmp / "escape").exists())

    def test_unreviewed_artifact_is_refused(self) -> None:
        self.allow["archives"] = {}
        with self.assertRaisesRegex(
            vod.OfflineError, "not a reviewed, pinned download"
        ):
            self.run_adapter()

    def test_unsafe_archive_members_are_refused(self) -> None:
        for entries, msg in (
            ([("../evil", "x", 0o100644)], "unsafe release archive member"),
            ([("/abs", "x", 0o100644)], "unsafe release archive member"),
            ([("lib/l", "../../../etc", 0o120777)], "unsafe archive symlink target"),
            ([("lib/l", "/etc", 0o120777)], "unsafe archive symlink target"),
            (
                [("a", ".", 0o120777), (".release", "a/a/a/../../../victim", 0o120777)],
                "unsafe archive symlink target",
            ),
            (
                [("lib", "/tmp", 0o120777), ("lib/x", "x", 0o100644)],
                "unsafe archive symlink target|through a symlink",
            ),
        ):
            data = zip_bytes(entries)
            sha = hashlib.sha256(data).hexdigest()
            (self.cache / "blobs" / sha).write_bytes(data)
            self.allow["archives"] = {self.slang_url: sha}
            with self.subTest(msg=msg), self.assertRaisesRegex(vod.OfflineError, msg):
                self.run_adapter()

    def test_through_symlink_member_is_refused(self) -> None:
        data = zip_bytes([("lib", "sub", 0o120777), ("lib/x", "x", 0o100644)])
        with (
            zipfile.ZipFile(io.BytesIO(data)) as z,
            self.assertRaisesRegex(vod.OfflineError, "through a symlink"),
        ):
            vod._check_members(z)

    def test_tampered_blob_is_refused(self) -> None:
        sha = self.allow["archives"][self.slang_url]
        (self.cache / "blobs" / sha).write_bytes(b"not the reviewed bytes")
        with self.assertRaisesRegex(
            vod.OfflineError, "artifact is not in the shared cache"
        ):
            self.run_adapter()

    def test_native_network_paths_are_denied(self) -> None:
        script = self.vvl / "scripts" / "update_deps.py"
        script.write_text(
            script.read_text().replace(
                "    sys.exit(0)\n\n\nif",
                "    urllib.request.urlopen('https://example.com')\n\n\nif",
            )
        )
        with self.assertRaisesRegex(vod.OfflineError, "offline"):
            self.run_adapter()

    def test_integration_provider_uses_clean_job_head(self) -> None:
        job = self.tmp / "job-headers"
        head = make_repo(job, {"include/vulkan.h": "job change\n"})
        self.assertEqual(self.run_adapter(providers={"Vulkan-Headers": job}), 0)
        h = self.ext / "Vulkan-Headers"
        self.assertEqual(sh(h, "git", "rev-parse", "HEAD"), head)
        rec = {
            d["name"]: d
            for d in json.loads((self.ext / vod.RECORD).read_text())["dependencies"]
        }
        self.assertEqual(rec["Vulkan-Headers"]["role"], "integration")
        self.assertEqual(rec["SPIRV-Headers"]["role"], "pinned-baseline")

    def test_provider_inside_dir_is_refused_before_anything_is_deleted(self) -> None:
        job = self.ext / "Vulkan-Headers"
        head = make_repo(job, {"include/vulkan.h": "job change\n"})
        with self.assertRaisesRegex(vod.OfflineError, "overlaps --dir"):
            self.run_adapter(providers={"Vulkan-Headers": job})
        self.assertEqual(sh(job, "git", "rev-parse", "HEAD"), head)
        self.assertEqual((job / "include" / "vulkan.h").read_text(), "job change\n")

    def test_dir_inside_provider_is_refused(self) -> None:
        job = self.tmp / "job-headers"
        make_repo(job, {"include/vulkan.h": "job change\n"})
        args = ["--dir", str(job / "external")]
        with self.assertRaisesRegex(vod.OfflineError, "overlaps --dir"):
            vod.run(self.vvl, args, {"Vulkan-Headers": job}, self.allow, self.cache)
        self.assertFalse((job / "external").exists())

    def test_repository_itself_may_be_a_provider_with_a_separate_dir(self) -> None:
        sh(self.vvl, "git", "init", "-q", "-b", "main")
        (self.vvl / "include").mkdir()
        (self.vvl / "include" / "vulkan.h").write_text("monorepo\n")
        sh(self.vvl, "git", "add", "-A")
        sh(self.vvl, "git", "commit", "-q", "-m", "c")
        head = sh(self.vvl, "git", "rev-parse", "HEAD")
        self.assertEqual(self.run_adapter(providers={"Vulkan-Headers": self.vvl}), 0)
        self.assertEqual(
            sh(self.ext / "Vulkan-Headers", "git", "rev-parse", "HEAD"), head
        )
        self.assertEqual(sh(self.vvl, "git", "rev-parse", "HEAD"), head)

    def test_dir_containing_repository_is_refused(self) -> None:
        with self.assertRaisesRegex(vod.OfflineError, "contains the repository"):
            vod.run(self.vvl, ["--dir", str(self.tmp)], None, self.allow, self.cache)
        self.assertTrue((self.vvl / "scripts" / "update_deps.py").is_file())

    def test_artifact_copy_is_streamed(self) -> None:
        real = Path.read_bytes
        blobs = (self.cache / "blobs").resolve()

        def guarded(path: Path) -> bytes:
            if Path(path).resolve().parent == blobs:
                raise AssertionError("artifact read whole into memory")
            return real(path)

        with mock.patch.object(Path, "read_bytes", guarded):
            self.assertEqual(self.run_adapter(), 0)

    def test_integration_provider_must_be_committed(self) -> None:
        job = self.tmp / "job-headers"
        make_repo(job, {"include/vulkan.h": "job change\n"})
        (job / "include" / "vulkan.h").write_text("uncommitted\n")
        with self.assertRaisesRegex(vod.OfflineError, "commit Vulkan-Headers edits"):
            self.run_adapter(providers={"Vulkan-Headers": job})

    def test_unknown_provider_name_is_an_error(self) -> None:
        job = self.tmp / "job-x"
        make_repo(job, {"a": "b"})
        with self.assertRaisesRegex(vod.OfflineError, "names no dependency"):
            self.run_adapter(providers={"Vulkan-Hedaers": job})

    def test_other_job_targets_are_refused_before_native_runs(self) -> None:
        android = "CMAKE_TOOLCHAIN_FILE=/ndk/build/cmake/android.toolchain.cmake"
        for extra in (
            ["--arch", "arm64"],
            ["--ar", "ARM64"],
            ["--cmake_var", android],
            [f"--cmake_var={android}"],
        ):
            with (
                self.subTest(extra=extra),
                self.assertRaisesRegex(vod.OfflineError, "linux x86_64 job target"),
            ):
                self.run_adapter(*extra)
        self.assertFalse(self.ext.exists())

    def test_default_arch_is_accepted(self) -> None:
        self.assertEqual(self.run_adapter("--arch", "64"), 0)

    def test_cli_accepts_native_options_without_separator(self) -> None:
        with (
            mock.patch.dict(os.environ, {"KHR_DEPS_ROOT": str(self.cache)}),
            mock.patch.object(vod, "run", return_value=0) as run,
        ):
            self.assertEqual(
                vod.main(
                    [
                        str(self.vvl),
                        "--dir",
                        "x",
                        "--no-build",
                        "--provider",
                        f"A={self.tmp}",
                    ]
                ),
                0,
            )
        self.assertEqual(run.call_args.args[1], ["--dir", "x", "--no-build"])
        self.assertEqual(run.call_args.args[2], {"A": self.tmp})

    def test_cli_requires_native_dir(self) -> None:
        with self.assertRaises(SystemExit):
            vod.main([str(self.vvl)])


class KnownGoodReleasePins(unittest.TestCase):
    def test_release_entries_become_blob_pins(self) -> None:
        allow = copy.deepcopy(khrdeps.load_allowlist())
        url = SLANG_URL.format(release="2026.14.1", system="linux", arch="x86_64")
        self.assertIn(url, allow["archives"])
        raw = json.dumps(
            {
                "repos": [
                    {
                        "name": "slang",
                        "url": SLANG_URL,
                        "release": "2026.14.1",
                        "url_format_map": SLANG_MAP,
                        "build_platforms": ["linux", "windows"],
                    },
                    {
                        "name": "win-only",
                        "url": SLANG_URL,
                        "release": "1",
                        "build_platforms": ["windows"],
                    },
                    {
                        "name": "arm-only",
                        "url": SLANG_URL,
                        "release": "1",
                        "build_architectures": ["arm64"],
                    },
                    {
                        "name": "new-slang",
                        "url": SLANG_URL,
                        "release": "2099.1",
                        "url_format_map": SLANG_MAP,
                    },
                ]
            }
        ).encode()
        got = {p["name"]: p for p in pins.parse_known_good(raw, allow)}
        self.assertEqual(got["slang"]["kind"], "blob")
        self.assertEqual(got["slang"]["sha256"], allow["archives"][url])
        self.assertNotIn("win-only", got)
        self.assertNotIn("arm-only", got)
        self.assertEqual(got["new-slang"]["kind"], "unavailable")
        self.assertNotIn("2099", json.dumps(got["new-slang"]))

    def test_ci_only_entries_follow_the_job_environment(self) -> None:
        allow = khrdeps.load_allowlist()
        raw = json.dumps(
            {
                "repos": [
                    {
                        "name": "SPIRV-Headers",
                        "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                        "commit": "a" * 40,
                        "ci_only": ["GITHUB_ACTIONS", "CI_BUILD"],
                    },
                ]
            }
        ).encode()
        names = lambda env: [p["name"] for p in pins.parse_known_good(raw, allow, env)]
        self.assertEqual(names({}), [])
        self.assertEqual(names({"GITHUB_ACTIONS": "1"}), [])
        self.assertEqual(names({"CI_BUILD": "TRUE"}), ["SPIRV-Headers"])

    def test_git_entries_excluded_on_linux_are_skipped(self) -> None:
        allow = khrdeps.load_allowlist()
        raw = json.dumps(
            {
                "repos": [
                    {
                        "name": "mimalloc",
                        "url": "https://github.com/microsoft/mimalloc.git",
                        "commit": "v3.5.3",
                        "build_platforms": ["windows"],
                    },
                    {
                        "name": "SPIRV-Headers",
                        "url": "https://github.com/KhronosGroup/SPIRV-Headers.git",
                        "commit": "a" * 40,
                        "build_platforms": ["linux", "windows"],
                    },
                ]
            }
        ).encode()
        names = [p["name"] for p in pins.parse_known_good(raw, allow)]
        self.assertEqual(names, ["SPIRV-Headers"])


if __name__ == "__main__":
    unittest.main()
