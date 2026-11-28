from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
sys.path.insert(0, str(HERE.parents[1] / "khr-deps" / "scripts"))

import cts_offline_deps as cod
import khrdeps
import pins

ZLIB = "https://example.test/zlib-1.2.13.tar.gz"
PNG = "https://example.test/libpng-1.6.50.tar.gz"
RDOC = "https://example.test/renderdoc/renderdoc_app.h"

FETCH_SOURCES = """import os
# Executing this file is a test failure: the adapter must only parse it.
open(os.path.join(os.path.dirname(__file__), "EXECUTED"), "w").close()

def postExtractLibpng(path):
    pass

PACKAGES = [
    SourcePackage("{zlib}", "{zlib_sha}", "zlib"),
    SourcePackage("{png}", "{png_sha}", "libpng", postExtract = postExtractLibpng),
    SourceFile("{rdoc}", "renderdoc_app.h", "{rdoc_sha}", "renderdoc"),
    GitRepo("https://github.com/KhronosGroup/SPIRV-Headers.git", "git@github.com:KhronosGroup/SPIRV-Headers.git", "{spirv_sha}", "spirv-headers"),
    GitRepo("https://github.com/KhronosGroup/glslang.git", "git@github.com:KhronosGroup/glslang.git", "{glslang_sha}", "glslang", removeTags = ["main-tot", "master-tot"]),
    GitRepo("https://github.com/Igalia/video_generator.git", "git@github.com:Igalia/video_generator.git", "v0.1.1", "video_generator"),
    GitRepo("https://github.com/KhronosGroup/Vulkan-ValidationLayers.git", "git@github.com:KhronosGroup/Vulkan-ValidationLayers.git", "{vvl_sha}", "vulkan-validationlayers", postCheckout="python3 scripts/update_deps.py --dir external"),
]
"""


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


def tar_gz(entries: list[tuple[str, str | None, str | None]]) -> bytes:
    """(name, data or None for a dir, symlink target or None)."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, data, link in entries:
            info = tarfile.TarInfo(name)
            if link is not None:
                info.type, info.linkname = tarfile.SYMTYPE, link
                tar.addfile(info)
            elif data is None:
                info.type, info.mode = tarfile.DIRTYPE, 0o755
                tar.addfile(info)
            else:
                raw = data.encode()
                info.size, info.mode = len(raw), 0o644
                tar.addfile(info, io.BytesIO(raw))
    return buf.getvalue()


class CtsOfflineDeps(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="khr-cts-"))
        self.cache = self.tmp / "cache"
        (self.cache / "blobs").mkdir(parents=True)
        self.allow = copy.deepcopy(khrdeps.load_allowlist())
        self.allow["archives"], self.allow["files"] = {}, {}

        self.zlib = tar_gz(
            [("zlib-1.2.13/", None, None), ("zlib-1.2.13/zlib.h", "zlib\n", None)]
        )
        self.png = tar_gz(
            [
                ("libpng-1.6.50/", None, None),
                ("libpng-1.6.50/png.h", "png\n", None),
                ("libpng-1.6.50/scripts/pnglibconf.h.prebuilt", "prebuilt\n", None),
            ]
        )
        self.rdoc = b"// renderdoc\n"
        self.sha = {}
        for key, url, data, kind in (
            ("zlib", ZLIB, self.zlib, "archives"),
            ("png", PNG, self.png, "archives"),
            ("rdoc", RDOC, self.rdoc, "files"),
        ):
            self.sha[key] = self.blob(data)
            self.allow[kind][url] = self.sha[key]

        src = self.tmp / "src"
        self.spirv_sha = make_repo(src / "spirv", {"include/spirv.h": "spv\n"})
        self.glslang_sha = make_repo(src / "glslang", {"glslang.h": "g\n"})
        make_repo(src / "vg", {"vg.py": "v\n"})
        sh(src / "vg", "git", "tag", "v0.1.1")
        self.vg_sha = sh(src / "vg", "git", "rev-parse", "HEAD")
        for repo, work in (
            ("KhronosGroup/SPIRV-Headers", src / "spirv"),
            ("KhronosGroup/glslang", src / "glslang"),
            ("Igalia/video_generator", src / "vg"),
        ):
            self.mirror(repo, work)

        self.cts = self.tmp / "cts"
        self.write_cts()
        self.deps = self.tmp / "deps"

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def blob(self, data: bytes) -> str:
        sha = hashlib.sha256(data).hexdigest()
        (self.cache / "blobs" / sha).write_bytes(data)
        return sha

    def mirror(self, repo: str, work: Path) -> None:
        m = khrdeps.mirror_path(self.cache, repo)
        m.parent.mkdir(parents=True, exist_ok=True)
        sh(self.tmp, "git", "clone", "-q", "--bare", str(work), str(m))

    def write_cts(self, text: str | None = None) -> None:
        text = text or FETCH_SOURCES.format(
            zlib=ZLIB,
            zlib_sha=self.sha["zlib"],
            png=PNG,
            png_sha=self.sha["png"],
            rdoc=RDOC,
            rdoc_sha=self.sha["rdoc"],
            spirv_sha=self.spirv_sha,
            glslang_sha=self.glslang_sha,
            vvl_sha="b" * 40,
        )
        files = {
            "external/fetch_sources.py": text,
            "external/zlib/CMakeLists.txt": "# tracked\n",
            "external/glslang/CMakeLists.txt": "# tracked\n",
            ".gitignore": "external/*/src\nexternal/*/packages\n",
        }
        if self.cts.exists():
            for rel, body in files.items():
                (self.cts / rel).write_text(body)
            sh(self.cts, "git", "commit", "-qam", "update")
        else:
            make_repo(self.cts, files)

    def run_adapter(self, providers: dict[str, Path] | None = None) -> int:
        return cod.run(
            self.cts, self.deps, providers, self.allow, self.cache, job="job-1"
        )

    def test_native_layout_from_cache_without_executing_fetch_sources(self) -> None:
        self.assertEqual(self.run_adapter(), 0)
        ext = self.cts / "external"
        self.assertFalse((ext / "EXECUTED").exists())
        self.assertEqual((ext / "zlib/src/zlib.h").read_text(), "zlib\n")
        self.assertEqual(
            (ext / "zlib/packages/zlib-1.2.13.tar.gz").read_bytes(), self.zlib
        )
        self.assertEqual(
            (ext / "zlib/packages/extracted").read_text(), self.sha["zlib"]
        )
        self.assertEqual((ext / "libpng/src/pnglibconf.h").read_text(), "prebuilt\n")
        self.assertEqual(
            (ext / "renderdoc/src/renderdoc_app.h").read_bytes(), self.rdoc
        )
        self.assertEqual(
            sh(ext / "spirv-headers/src", "git", "rev-parse", "HEAD"), self.spirv_sha
        )
        self.assertEqual(
            sh(ext / "glslang/src", "git", "rev-parse", "HEAD"), self.glslang_sha
        )
        vg = ext / "video_generator/src"
        self.assertEqual(sh(vg, "git", "rev-parse", "v0.1.1^{commit}"), self.vg_sha)
        self.assertFalse((ext / "vulkan-validationlayers").exists())
        self.assertEqual((ext / "zlib/CMakeLists.txt").read_text(), "# tracked\n")
        rec = json.loads((self.deps / cod.RECORD).read_text())
        self.assertEqual(rec["provenance"], "agent-reported")
        roles = {d["name"]: d["role"] for d in rec["dependencies"]}
        self.assertEqual(
            roles,
            {
                "zlib": "pinned-archive",
                "libpng": "pinned-archive",
                "renderdoc": "pinned-file",
                "spirv-headers": "pinned-baseline",
                "glslang": "pinned-baseline",
                "video_generator": "pinned-baseline",
            },
        )
        self.assertEqual(sh(self.cts, "git", "status", "--porcelain"), "")

    def test_rerun_replaces_tampered_sources(self) -> None:
        self.run_adapter()
        (self.cts / "external/zlib/src/zlib.h").write_text("tampered\n")
        (self.cts / "external/glslang/src/glslang.h").write_text("tampered\n")
        self.run_adapter()
        self.assertEqual((self.cts / "external/zlib/src/zlib.h").read_text(), "zlib\n")
        self.assertEqual(
            (self.cts / "external/glslang/src/glslang.h").read_text(), "g\n"
        )

    def test_missing_pins_fail_closed_with_the_full_list_before_writing(self) -> None:
        shutil.rmtree(khrdeps.mirror_path(self.cache, "KhronosGroup/glslang"))
        (self.cache / "blobs" / self.sha["rdoc"]).unlink()
        with self.assertRaises(cod.OfflineError) as cm:
            self.run_adapter()
        msg = str(cm.exception)
        self.assertIn("glslang@", msg)
        self.assertIn("renderdoc", msg)
        self.assertFalse((self.cts / "external/zlib/src").exists())

    def test_missing_pins_write_a_request_for_khr_deps(self) -> None:
        shutil.rmtree(khrdeps.mirror_path(self.cache, "KhronosGroup/glslang"))
        rdoc = self.cache / "blobs" / self.sha["rdoc"]
        saved = rdoc.read_bytes()
        rdoc.unlink()
        with self.assertRaisesRegex(cod.OfflineError, "send it to khr-deps"):
            self.run_adapter()
        req = json.loads((self.deps / "pin-request.json").read_text())
        self.assertEqual(req["job"], "job-1")
        self.assertEqual(
            req["pins"],
            [
                {"kind": "blob", "url": RDOC, "sha256": self.sha["rdoc"]},
                {
                    "kind": "git",
                    "url": "https://github.com/KhronosGroup/glslang.git",
                    "ref": self.glslang_sha,
                },
            ],
        )
        rdoc.write_bytes(saved)
        self.mirror("KhronosGroup/glslang", self.tmp / "src" / "glslang")
        self.assertEqual(self.run_adapter(), 0)
        self.assertFalse(
            (self.deps / "pin-request.json").exists(), "stale request removed"
        )

    def test_unreviewed_or_changed_declarations_are_unavailable(self) -> None:
        text = (self.cts / "external/fetch_sources.py").read_text()
        for old, new, reason in (
            (
                'KhronosGroup/SPIRV-Headers.git", "git@',
                'evil/repo.git", "git@',
                "unreviewed",
            ),
            (self.sha["zlib"], "c" * 64, "checksum differs"),
            (
                '"libpng", postExtract = postExtractLibpng',
                '"libpng", postExtract = other',
                "metadata",
            ),
            (f'"{self.glslang_sha}"', '"main"', "exact SHA or version tag"),
        ):
            with self.subTest(reason=reason):
                self.write_cts(text.replace(old, new, 1))
                with self.assertRaisesRegex(cod.OfflineError, reason):
                    self.run_adapter()
                self.assertFalse((self.cts / "external/zlib/src").exists())

    def test_non_literal_package_is_unavailable(self) -> None:
        text = (self.cts / "external/fetch_sources.py").read_text()
        self.write_cts(text.replace('"zlib"),', 'os.environ["X"]),', 1))
        with self.assertRaisesRegex(cod.OfflineError, "literals"):
            self.run_adapter()

    def test_declaration_is_read_as_the_exact_committed_blob(self) -> None:
        # A replacement ref must not change what the adapter reads.
        real = sh(self.cts, "git", "rev-parse", "HEAD:external/fetch_sources.py")
        (self.tmp / "fake.py").write_text("PACKAGES = []\n")
        fake = sh(self.cts, "git", "hash-object", "-w", str(self.tmp / "fake.py"))
        sh(self.cts, "git", "replace", "-f", real, fake)
        self.assertEqual(self.run_adapter(), 0)
        self.assertTrue((self.cts / "external/zlib/src/zlib.h").is_file())

    def test_uncommitted_declaration_edit_is_refused(self) -> None:
        with (self.cts / "external/fetch_sources.py").open("a") as fh:
            fh.write("# local edit\n")
        with self.assertRaisesRegex(
            cod.OfflineError, "commit external/fetch_sources.py"
        ):
            self.run_adapter()

    def test_tracked_source_tree_is_never_replaced(self) -> None:
        (self.cts / "external/glslang/src").mkdir(parents=True)
        (self.cts / "external/glslang/src/kept.h").write_text("tracked\n")
        sh(self.cts, "git", "add", "-f", "external/glslang/src/kept.h")
        sh(self.cts, "git", "commit", "-qm", "track")
        with self.assertRaisesRegex(cod.OfflineError, "overlaps tracked"):
            self.run_adapter()
        self.assertEqual(
            (self.cts / "external/glslang/src/kept.h").read_text(), "tracked\n"
        )
        self.assertFalse((self.cts / "external/zlib/src").exists())

    def test_file_removed_from_index_but_in_head_is_still_protected(self) -> None:
        (self.cts / "external/glslang/src").mkdir(parents=True)
        (self.cts / "external/glslang/src/kept.h").write_text("tracked\n")
        sh(self.cts, "git", "add", "-f", "external/glslang/src/kept.h")
        sh(self.cts, "git", "commit", "-qm", "track")
        sh(self.cts, "git", "rm", "-q", "--cached", "external/glslang/src/kept.h")
        with self.assertRaisesRegex(cod.OfflineError, "overlaps tracked"):
            self.run_adapter()
        self.assertTrue((self.cts / "external/glslang/src/kept.h").exists())

    def test_tracked_gitlink_ancestor_is_protected(self) -> None:
        sub = self.tmp / "sub"
        sub_head = make_repo(sub, {"a": "b"})
        # a submodule at external/glslang replaces the tracked directory there
        sh(self.cts, "git", "rm", "-q", "external/glslang/CMakeLists.txt")
        sh(
            self.cts,
            "git",
            "update-index",
            "--add",
            "--cacheinfo",
            f"160000,{sub_head},external/glslang",
        )
        sh(self.cts, "git", "commit", "-qm", "gitlink")
        with self.assertRaisesRegex(
            cod.OfflineError, "overlaps tracked external/glslang"
        ):
            self.run_adapter()

    def test_provider_with_git_filter_is_refused_without_running_it(self) -> None:
        job = self.tmp / "job-glslang"
        make_repo(
            job, {"glslang.h": "job change\n", ".gitattributes": "*.h filter=x\n"}
        )
        marker = self.tmp / "filter-ran"
        sh(job, "git", "config", "filter.x.clean", f"sh -c 'touch {marker}; cat'")
        (job / "glslang.h").touch()
        with self.assertRaisesRegex(cod.OfflineError, "git filters are unsupported"):
            self.run_adapter({"glslang": job})
        self.assertFalse(marker.exists())

    def test_missing_object_never_runs_a_configured_upload_pack(self) -> None:
        (self.cts / "external/unused").mkdir()
        (self.cts / "external/unused/x.txt").write_text("x\n")
        sh(self.cts, "git", "add", "-A")
        sh(self.cts, "git", "commit", "-qm", "unused")
        tree = sh(self.cts, "git", "rev-parse", "HEAD:external/unused")
        (self.cts / ".git/objects" / tree[:2] / tree[2:]).unlink()
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
            sh(self.cts, "git", "config", key, value)
        with self.assertRaises(cod.OfflineError):
            self.run_adapter()
        self.assertFalse(marker.exists(), "lazy fetch ran the configured upload-pack")

    def test_provider_inside_dependency_root_is_refused(self) -> None:
        job = self.deps / ".extract-zlib"
        head = make_repo(job, {"glslang.h": "job\n"})
        with self.assertRaisesRegex(cod.OfflineError, "overlaps --dependency-root"):
            self.run_adapter({"glslang": job})
        self.assertEqual(sh(job, "git", "rev-parse", "HEAD"), head)

    def test_cli_requires_job(self) -> None:
        with self.assertRaises(SystemExit):
            cod.main(
                ["--repository", str(self.cts), "--dependency-root", str(self.deps)]
            )

    def test_symlinked_external_dir_is_refused(self) -> None:
        outside = self.tmp / "outside"
        outside.mkdir()
        (self.cts / "external/renderdoc").symlink_to(outside)
        with self.assertRaisesRegex(cod.OfflineError, "symlink"):
            self.run_adapter()
        self.assertEqual(list(outside.iterdir()), [])

    def test_unsafe_tar_members_are_refused(self) -> None:
        for entries, msg in (
            ([("zlib/", None, None), ("../evil", "x", None)], "unsafe archive member"),
            ([("zlib/", None, None), ("/abs", "x", None)], "unsafe archive member"),
            (
                [("zlib/", None, None), ("zlib/l", None, "../../x")],
                "unsafe archive symlink",
            ),
            (
                [("zlib/", None, None), ("zlib/l", None, "/etc")],
                "unsafe archive symlink",
            ),
            (
                [("zlib/", None, None), ("zlib/d", None, "."), ("zlib/d/x", "x", None)],
                "through a symlink",
            ),
            ([("a/", None, None), ("b/", None, None)], "single top-level"),
        ):
            data = tar_gz(entries)
            self.allow["archives"][ZLIB] = self.blob(data)
            text = (self.cts / "external/fetch_sources.py").read_text()
            self.write_cts(text.replace(self.sha["zlib"], self.allow["archives"][ZLIB]))
            self.sha["zlib"] = self.allow["archives"][ZLIB]
            with self.subTest(msg=msg), self.assertRaisesRegex(cod.OfflineError, msg):
                self.run_adapter()
            self.assertFalse((self.tmp / "evil").exists())

    def test_device_member_is_refused(self) -> None:
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            d = tarfile.TarInfo("zlib/")
            d.type = tarfile.DIRTYPE
            tar.addfile(d)
            dev = tarfile.TarInfo("zlib/null")
            dev.type = tarfile.CHRTYPE
            tar.addfile(dev)
        with (
            tarfile.open(fileobj=io.BytesIO(buf.getvalue())) as tar,
            self.assertRaisesRegex(cod.OfflineError, "unsupported archive member type"),
        ):
            cod._tar_members(tar)

    def test_integration_provider_uses_clean_job_head(self) -> None:
        job = self.tmp / "job-glslang"
        head = make_repo(job, {"glslang.h": "job change\n"})
        self.assertEqual(self.run_adapter({"glslang": job}), 0)
        self.assertEqual(
            sh(self.cts / "external/glslang/src", "git", "rev-parse", "HEAD"), head
        )
        rec = {
            d["name"]: d
            for d in json.loads((self.deps / cod.RECORD).read_text())["dependencies"]
        }
        self.assertEqual(rec["glslang"]["role"], "integration")

    def test_integration_provider_must_be_committed_and_a_git_dependency(self) -> None:
        job = self.tmp / "job-glslang"
        make_repo(job, {"glslang.h": "job change\n"})
        (job / "glslang.h").write_text("dirty\n")
        with self.assertRaisesRegex(cod.OfflineError, "commit glslang edits"):
            self.run_adapter({"glslang": job})
        with self.assertRaisesRegex(cod.OfflineError, "no CTS git dependency"):
            self.run_adapter({"zlib": job})

    def test_dependency_root_inside_repository_is_refused(self) -> None:
        with self.assertRaisesRegex(cod.OfflineError, "overlaps the repository"):
            cod.run(
                self.cts, self.cts / "deps", None, self.allow, self.cache, job="job-1"
            )


class CtsPins(unittest.TestCase):
    def test_vvl_is_skipped_and_extras_are_recorded(self) -> None:
        allow = copy.deepcopy(khrdeps.load_allowlist())
        allow["archives"][PNG] = "d" * 64
        raw = f"""
PACKAGES = [
    SourcePackage("{PNG}", "{"d" * 64}", "libpng", postExtract = postExtractLibpng),
    GitRepo("https://github.com/KhronosGroup/glslang.git", "ssh", "{"a" * 40}", "glslang", removeTags = ["main-tot", "master-tot"]),
    GitRepo("https://github.com/KhronosGroup/Vulkan-ValidationLayers.git", "ssh", "{"b" * 40}", "vulkan-validationlayers", postCheckout="x"),
]
""".encode()
        got = {p["subdir"]: p for p in pins.parse_cts(raw, allow)}
        self.assertEqual(set(got), {"libpng", "glslang"})
        self.assertEqual(got["libpng"]["postExtract"], "postExtractLibpng")
        self.assertEqual(got["glslang"]["removeTags"], "main-tot,master-tot")

    def test_unsafe_directory_and_duplicates_are_rejected(self) -> None:
        allow = khrdeps.load_allowlist()
        bad = (
            b'PACKAGES = [GitRepo("https://github.com/KhronosGroup/glslang.git", "s", "'
            + b"a" * 40
            + b'", "../x")]'
        )
        self.assertEqual(pins.parse_cts(bad, allow)[0]["kind"], "unavailable")
        dup = (
            b'PACKAGES = [GitRepo("https://github.com/KhronosGroup/glslang.git", "s", "'
            + b"a" * 40
            + b'", "g"), GitRepo("https://github.com/KhronosGroup/glslang.git", "s", "'
            + b"a" * 40
            + b'", "g")]'
        )
        with self.assertRaisesRegex(khrdeps.PinError, "duplicate"):
            pins.parse_cts(dup, allow)

    def test_read_at_ignores_replacement_refs(self) -> None:
        tmp = Path(tempfile.mkdtemp(prefix="khr-ctsr-"))
        try:
            make_repo(tmp / "r", {"external/fetch_sources.py": "PACKAGES = [1]\n"})
            real = sh(tmp / "r", "git", "rev-parse", "HEAD:external/fetch_sources.py")
            (tmp / "fake").write_text("PACKAGES = [2]\n")
            fake = sh(tmp / "r", "git", "hash-object", "-w", str(tmp / "fake"))
            sh(tmp / "r", "git", "replace", "-f", real, fake)
            rev = sh(tmp / "r", "git", "rev-parse", "HEAD")
            got = pins.read_at(tmp / "r", rev, "external/fetch_sources.py", 1 << 20)
            self.assertEqual(got, b"PACKAGES = [1]\n")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_rejected_url_is_not_echoed(self) -> None:
        allow = khrdeps.load_allowlist()
        raw = (
            b'PACKAGES = [SourceFile("https://user:secret@example.test/f.h", "f.h", "'
            + b"e" * 64
            + b'", "f")]'
        )
        got = pins.parse_cts(raw, allow)
        self.assertEqual(got[0]["kind"], "unavailable")
        self.assertNotIn("secret", json.dumps(got))

    def test_extract_dispatches_the_cts_profile(self) -> None:
        tmp = Path(tempfile.mkdtemp(prefix="khr-ctsx-"))
        try:
            make_repo(
                tmp / "r",
                {
                    "external/fetch_sources.py": 'PACKAGES = [GitRepo("https://github.com/KhronosGroup/glslang.git", "s", "'
                    + "a" * 40
                    + '", "glslang")]\n'
                },
            )
            rev = sh(tmp / "r", "git", "rev-parse", "HEAD")
            got = pins.extract(
                {"kind": "cts", "path": "external/fetch_sources.py"},
                tmp / "r",
                rev,
                khrdeps.load_allowlist(),
            )
            self.assertEqual(got["profile"], "cts")
            self.assertEqual([p["subdir"] for p in got["pins"]], ["glslang"])
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
