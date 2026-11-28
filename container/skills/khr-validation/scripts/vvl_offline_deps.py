#!/usr/bin/env python3
"""Run a repository's own ``scripts/update_deps.py`` offline, from the shared cache.

Validation layers and utility libraries resolve their dependencies with a native
``update_deps.py`` that clones from GitHub and downloads release artifacts. Jobs
have no network, so this adapter loads that native script and replaces only its
acquisition steps; everything else (build order, CMake options, ``helper.cmake``)
stays the repository's own code:

- ``GoodRepo.Checkout`` materializes each git dependency from the bare mirror in
  the shared dependency cache, at the exact pinned commit, as a depth-1 snapshot
  under ``--dir``. A pin that is not reviewed, or not in the cache, fails closed;
  ask for it with the khr-deps hand-off, never by downloading.
- ``GoodRepo.DownloadAndExtractArtifact`` uses only a reviewed, sha256-verified
  blob from the cache and rejects unsafe archive members before extraction.
- ``Clone``, ``Fetch`` and ``urllib`` downloads raise.

Integration mode: ``--provider NAME=PATH`` takes the dependency ``NAME`` from a
committed, clean job repository (for example a Vulkan-Headers change in the same
job) at its ``HEAD`` instead of the pin. Everything else stays pinned.

Usage::

    vvl_offline_deps.py REPO [--provider NAME=PATH ...] [--] --dir external \\
        --config debug --generator Ninja [--optional tests]

Options other than ``--provider`` go to the native script; ``--`` is optional.

Writes ``<dir>/khr-offline-deps.json`` recording which commit or artifact was
used for every dependency. Standard library only.

This is not a security boundary. The native script is the job repository's own
Python, which the job agent may edit, and it runs in this process, so it can do
anything the agent can. What keeps a job offline and the cache intact is outside
this script: the container's internal-only network with per-agent gateway
rules, and the read-only mount of the shared cache. The adapter makes an honest
run use exactly the reviewed pins and fail closed otherwise; its record is
``agent-reported`` provenance, not proof.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import platform
import re
import shlex
import shutil
import stat
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

RECORD = "khr-offline-deps.json"
_HEX = re.compile(r"[0-9a-f]{40}|[0-9a-f]{64}")


class OfflineError(RuntimeError):
    """A dependency that cannot be prepared without the network or a review."""


def _deps_modules():
    """The shared pin model lives in the khr-deps skill next to this one (read-only mount)."""
    deps_scripts = Path(__file__).resolve().parents[2] / "khr-deps" / "scripts"
    if str(deps_scripts) not in sys.path:
        sys.path.insert(0, str(deps_scripts))
    import khrdeps

    return khrdeps


def _git_env(khrdeps, trusted: list[Path]) -> dict[str, str]:
    env = khrdeps.clean_git_env()
    for k in ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"):
        env.pop(k, None)
    env["GIT_ALLOW_PROTOCOL"] = "file"
    pairs = [("core.hooksPath", "/dev/null"), ("core.fsmonitor", "false")]
    for path in trusted:
        pairs += [("safe.directory", str(path)), ("safe.directory", str(path / ".git"))]
    env["GIT_CONFIG_COUNT"] = str(len(pairs))
    for i, (k, v) in enumerate(pairs):
        env[f"GIT_CONFIG_KEY_{i}"] = k
        env[f"GIT_CONFIG_VALUE_{i}"] = v
    return env


def _git(env: dict[str, str], *args: str) -> str:
    r = subprocess.run(
        ["git", *args], capture_output=True, text=True, env=env, check=False
    )
    if r.returncode != 0:
        raise OfflineError(f"git {args[0]} failed: {r.stderr.strip()[-300:]}")
    return r.stdout.strip()


def _trust_for_children(path: Path) -> None:
    """Child CMake/version probes run git in the snapshot; trust that exact path only."""
    n = int(os.environ.get("GIT_CONFIG_COUNT", "0") or "0")
    os.environ[f"GIT_CONFIG_KEY_{n}"] = "safe.directory"
    os.environ[f"GIT_CONFIG_VALUE_{n}"] = str(path)
    os.environ["GIT_CONFIG_COUNT"] = str(n + 1)


def _confined(root: Path, path: str | os.PathLike[str]) -> Path:
    target = Path(os.path.abspath(path))
    if target == root or not target.is_relative_to(root):
        raise OfflineError(f"dependency path escapes the --dir root: {path}")
    for parent in [target, *target.parents]:
        if parent == root:
            break
        if parent.is_symlink():
            raise OfflineError(f"dependency path goes through a symlink: {parent}")
    return target


def snapshot(khrdeps, source: Path, target: Path, sha: str) -> None:
    """A depth-1 checkout of ``sha`` from a local repository, no hooks, no network."""
    env = _git_env(khrdeps, [source.resolve(), target])
    upload_pack = shlex.join(
        [
            "git",
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "uploadpack.allowAnySHA1InWant=true",
            "-c",
            f"safe.directory={source.resolve()}",
            "-c",
            f"safe.directory={source.resolve() / '.git'}",
            "upload-pack",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    _git(env, "init", "-q", str(target))
    _git(
        env,
        "-C",
        str(target),
        "fetch",
        "-q",
        "--depth=1",
        "--no-tags",
        f"--upload-pack={upload_pack}",
        str(source.resolve()),
        sha,
    )
    _git(env, "-C", str(target), "checkout", "-q", "--detach", sha)


def _replace(target: Path) -> None:
    """Remove whatever sits at ``target`` without following it."""
    if target.is_symlink() or target.is_file():
        target.unlink()
    elif target.exists():
        shutil.rmtree(target)


def _write_new(path: Path, data: bytes) -> None:
    """Create ``path`` afresh: never truncate an existing inode (symlink or hard link)."""
    path.unlink(missing_ok=True)
    with path.open("xb") as fh:
        fh.write(data)


def _copy_new(source: Path, path: Path) -> None:
    """``_write_new`` for a file, streamed (release artifacts can be large)."""
    path.unlink(missing_ok=True)
    with source.open("rb") as src, path.open("xb") as dst:
        shutil.copyfileobj(src, dst, length=1 << 20)


def artifact_url(item) -> str:
    """The URL native ``update_deps.py`` downloads for a release entry.

    Newer scripts have ``GoodRepo.ArtifactUrl``; older releases (for example
    vulkan-sdk-1.4.363.1) build the same URL inline in
    ``DownloadAndExtractArtifact``: host system and ``--arch``, each mapped through
    ``url_format_map``.
    """
    if callable(getattr(item, "ArtifactUrl", None)):
        return item.ArtifactUrl()
    fmt = getattr(item, "url_format_map", None) or {}
    system = platform.system().lower()
    arch = item._args.arch
    return item.url.format(
        release=item.release,
        system=fmt.get(system, system),
        arch=fmt.get(arch, arch),
    )


def _overlaps(a: Path, b: Path) -> bool:
    return a == b or a.is_relative_to(b) or b.is_relative_to(a)


def _check_members(archive: zipfile.ZipFile) -> None:
    """Reject members that could land or write outside the install directory."""
    links: set[PurePosixPath] = set()
    for info in archive.infolist():
        name = info.filename
        p = PurePosixPath(name)
        if not name or "\\" in name or p.is_absolute() or ".." in p.parts:
            raise OfflineError(f"unsafe release archive member: {name!r}")
        if any(parent in links for parent in p.parents):
            raise OfflineError(f"archive member written through a symlink: {name!r}")
        if stat.S_ISLNK(info.external_attr >> 16):
            dest = PurePosixPath(archive.read(info).decode("utf-8", "replace"))
            if dest.is_absolute() or "\\" in str(dest) or ".." in dest.parts:
                raise OfflineError(f"unsafe archive symlink target: {name!r}")
            links.add(p)


def run(
    repo: Path,
    native_args: list[str],
    providers: dict[str, Path] | None = None,
    allow: dict[str, Any] | None = None,
    cache_root: Path | None = None,
) -> int:
    sys.dont_write_bytecode = True  # no __pycache__ in the job repository
    khrdeps = _deps_modules()
    allow = allow or khrdeps.load_allowlist()
    cache = (cache_root or khrdeps.deps_root()).resolve()
    providers = providers or {}
    repo = repo.resolve()
    script = repo / "scripts" / "update_deps.py"
    if script.is_symlink() or not script.resolve().is_relative_to(repo):
        raise OfflineError("native update_deps.py escapes the repository")
    if not script.is_file():
        raise OfflineError(f"no native dependency script at {script}")

    # Resolve --dir once, before native code can change directory; native argparse
    # keeps the last --dir, and so does this.
    dir_parser = argparse.ArgumentParser(add_help=False, allow_abbrev=False)
    dir_parser.add_argument("--dir", required=True)
    try:
        options, remaining = dir_parser.parse_known_args(native_args)
    except SystemExit:
        raise OfflineError("pass the native --dir") from None
    root = Path(os.path.abspath(options.dir))
    native_args = [*remaining, "--dir", str(root)]
    # Snapshots are deleted and recreated under --dir, so no job repository may
    # live there: refuse before anything is removed. Compare real paths, so a
    # symlinked spelling of the same directory cannot slip past.
    real_root = root.resolve()
    if repo.is_relative_to(real_root):
        raise OfflineError("--dir contains the repository; use a separate directory")
    providers = {name: path.resolve() for name, path in providers.items()}
    for name, path in providers.items():
        if _overlaps(path, real_root):
            raise OfflineError(
                f"--provider {name} overlaps --dir; use a separate --dir"
            )

    record: list[dict[str, Any]] = []
    used: set[str] = set()

    def deny(*_a, **_k):
        raise OfflineError(
            "dependency acquisition is offline; request pins via khr-deps"
        )

    spec = importlib.util.spec_from_file_location("khr_native_update_deps", script)
    native = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = native
    saved = (urllib.request.urlretrieve, urllib.request.urlopen)
    urllib.request.urlretrieve = deny
    urllib.request.urlopen = deny
    try:
        spec.loader.exec_module(native)
        good = native.GoodRepo

        def checkout(item) -> None:
            target = _confined(root, item.repo_dir)
            if item.name in providers:
                source = providers[item.name]
                env = _git_env(khrdeps, [source])
                if _git(
                    env,
                    "-C",
                    str(source),
                    "status",
                    "--porcelain",
                    "--untracked-files=all",
                ):
                    raise OfflineError(f"commit {item.name} edits before integration")
                sha = _git(env, "-C", str(source), "rev-parse", "HEAD")
                role, pin_ref = "integration", None
                used.add(item.name)
            else:
                try:
                    pin = khrdeps.git_pin(item.url, item.commit, allow)
                except khrdeps.PinError as exc:
                    raise OfflineError(f"{item.name}: {exc}") from None
                source = khrdeps.mirror_path(cache, pin["repo"])
                ref = pin["ref"]
                target_ref = ref if _HEX.fullmatch(ref) else f"refs/tags/{ref}"
                try:
                    sha = _git(
                        _git_env(khrdeps, [source]),
                        "--git-dir",
                        str(source),
                        "rev-parse",
                        "--verify",
                        f"{target_ref}^{{commit}}",
                    )
                except OfflineError:
                    raise OfflineError(
                        f"{item.name}@{ref} is not in the shared cache; "
                        "request it via khr-deps"
                    ) from None
                if _HEX.fullmatch(ref) and sha != ref:
                    raise OfflineError(f"{item.name}: mirror resolved {ref} to {sha}")
                role, pin_ref = "pinned-baseline", ref
            # Always a fresh snapshot (as Eric's per-profile clones): a reused tree
            # can hide unpinned bytes behind index flags or ignored files.
            _replace(target)
            snapshot(khrdeps, source, target, sha)
            _git(
                _git_env(khrdeps, [target]),
                "-C",
                str(target),
                "config",
                "remote.origin.url",
                item.url,
            )
            _trust_for_children(target)
            record.append(
                {
                    "name": item.name,
                    "role": role,
                    "url": item.url,
                    "ref": pin_ref,
                    "sha": sha,
                    "path": str(target.relative_to(root)),
                }
            )
            print(f"Prepared {item.name} at {sha[:12]} ({role})", flush=True)

        original_artifact = getattr(good, "DownloadAndExtractArtifact", None)

        def artifact(item) -> bool:
            url = artifact_url(item)
            try:
                pin = khrdeps.blob_pin(url, allow)
            except khrdeps.PinError as exc:
                raise OfflineError(f"{item.name}: {exc}") from None
            if not khrdeps.pin_present(cache, pin):
                raise OfflineError(
                    f"{item.name} artifact is not in the shared cache; request it via khr-deps"
                )
            build_dir = _confined(root, item.build_dir)
            _confined(root, item.install_dir)
            download = build_dir / url.rsplit("/", 1)[-1]
            build_dir.mkdir(parents=True, exist_ok=True)
            _copy_new(cache / "blobs" / pin["sha256"], download)
            if khrdeps.file_digest(download, "sha256") != pin["sha256"]:
                raise OfflineError(f"{item.name} artifact changed while copying")
            if download.suffix == ".zip":
                with zipfile.ZipFile(download) as archive:
                    _check_members(archive)
            record.append(
                {
                    "name": item.name,
                    "role": "pinned-artifact",
                    "url": url,
                    "sha256": pin["sha256"],
                    "path": str(download.relative_to(root)),
                }
            )
            print(f"Prepared {item.name} artifact {pin['sha256'][:12]}", flush=True)
            # Native extraction finds the file in place and never downloads.
            return original_artifact(item) if original_artifact else True

        good.Checkout = checkout
        good.Clone = deny
        good.Fetch = deny
        if original_artifact is not None:
            good.DownloadAndExtractArtifact = artifact

        argv = sys.argv
        sys.argv = [str(script), *native_args]
        cwd = os.getcwd()
        code = 0
        try:
            native.main()
        except SystemExit as exc:
            code = (
                exc.code
                if isinstance(exc.code, int)
                else (0 if exc.code is None else 1)
            )
        finally:
            sys.argv = argv
            os.chdir(cwd)
        unknown = set(providers) - used
        if unknown:
            raise OfflineError(
                f"--provider names no dependency that was checked out: {sorted(unknown)}"
            )
        root.mkdir(parents=True, exist_ok=True)
        body = {
            "schema": 1,
            "provenance": "agent-reported",
            "repository": str(repo),
            "dependencies": record,
        }
        _write_new(root / RECORD, (json.dumps(body, indent=2) + "\n").encode())
        return code
    finally:
        urllib.request.urlretrieve, urllib.request.urlopen = saved
        sys.modules.pop(spec.name, None)


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    native_args: list[str] = []
    if "--" in argv:
        i = argv.index("--")
        argv, native_args = argv[:i], argv[i + 1 :]
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("repo", type=Path, help="checkout that owns scripts/update_deps.py")
    ap.add_argument("--provider", action="append", default=[], metavar="NAME=PATH")
    if native_args:
        args = ap.parse_args(argv)
    else:
        # Eric's call form: REPO followed directly by native options.
        args, native_args = ap.parse_known_args(argv)
    providers: dict[str, Path] = {}
    for value in args.provider:
        name, sep, path = value.partition("=")
        if not sep or not name or not path or name in providers:
            ap.error("--provider takes distinct NAME=PATH entries")
        providers[name] = Path(path)
    if "--dir" not in " ".join(native_args).replace("=", " ").split():
        ap.error("pass the native --dir, e.g. REPO --dir external --config debug")
    try:
        return run(args.repo, native_args, providers)
    except OfflineError as exc:
        print(f"vvl_offline_deps: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
