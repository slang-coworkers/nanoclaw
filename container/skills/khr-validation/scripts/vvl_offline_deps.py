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
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import offline_git
from offline_git import RECORD, OfflineError, snapshot
from offline_git import check_zip_members as _check_members
from offline_git import copy_new as _copy_new
from offline_git import deps_modules as _deps_modules
from offline_git import git as _git
from offline_git import git_env as _git_env
from offline_git import overlaps as _overlaps
from offline_git import replace as _replace
from offline_git import trust_for_children as _trust_for_children
from offline_git import write_new as _write_new


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


def _check_target(native_args: list[str]) -> None:
    """Prepared pins cover the linux x86_64 job target only (see khr-deps ``pins``).

    Native argparse accepts abbreviations, so this parser does too.
    """
    target = argparse.ArgumentParser(add_help=False, allow_abbrev=True)
    target.add_argument("--arch", type=str.lower)
    target.add_argument("--cmake_var", action="append", default=[])
    try:
        options, _ = target.parse_known_args(native_args)
    except SystemExit:
        raise OfflineError("could not read --arch/--cmake_var") from None
    if options.arch not in (None, "64"):
        raise OfflineError(
            f"--arch {options.arch}: prepared pins cover the linux x86_64 job target only"
        )
    if any("android.toolchain.cmake" in v for v in options.cmake_var):
        raise OfflineError(
            "Android toolchain: prepared pins cover the linux x86_64 job target only"
        )


def _preflight(khrdeps, repo, root, native_args, providers, allow, cache, job) -> None:
    """Every pin native will acquire must be cached; else write pin-request.json.

    Mirrors native selection in ``main``: the same known_good.json
    (``--known_good_dir``); the platform/arch/ci_only skips (khr-deps ``pins``);
    ``api``; ``--skip-existing-install``; ``--optional``; and release artifacts only
    when building. Unreviewed entries are left to fail in native ``Checkout``.
    """
    offline_git.deps_modules()
    import pins

    opts = argparse.ArgumentParser(add_help=False, allow_abbrev=True)
    opts.add_argument("--known_good_dir")
    opts.add_argument(
        "--optional", type=lambda a: set(a.lower().split(",")), default=set()
    )
    opts.add_argument("--no-build", dest="do_build", action="store_false", default=True)
    opts.add_argument("--skip-existing-install", action="store_true")
    opts.add_argument("--api", default="vulkan")
    try:
        o, _ = opts.parse_known_args(native_args)
    except SystemExit:
        raise OfflineError("could not read the native selection options") from None
    kg_dir = (
        Path(os.path.abspath(o.known_good_dir))
        if o.known_good_dir
        else repo / "scripts"
    )
    kg = kg_dir / "known_good.json"
    if not kg.is_file():
        return  # native reports its own error
    try:
        repos = json.loads(kg.read_bytes()).get("repos", [])
        selected = []
        for r in repos:
            if r.get("api") is not None and r["api"] != o.api:
                continue
            install = r.get("install_dir")
            if o.skip_existing_install and install and (root / install).is_dir():
                continue
            if set(r.get("optional", [])) & o.optional:
                continue
            if r.get("release") is not None and not o.do_build:
                continue
            selected.append(r)
        entries = pins.parse_known_good(json.dumps({"repos": selected}).encode(), allow)
    except (ValueError, AttributeError, TypeError, khrdeps.PinError):
        return
    missing = []
    for e in entries:
        if e["kind"] == "unavailable" or (
            e["kind"] == "git" and e["name"] in providers
        ):
            continue
        if not khrdeps.pin_present(cache, e) and not (
            e["kind"] == "git" and _resolves(khrdeps, cache, e)
        ):
            missing.append(e)
    req = offline_git.write_pin_request(root, job, missing)
    if req:
        names = ", ".join(e["name"] for e in missing)
        raise OfflineError(
            f"not in the shared cache: {names}; wrote {req}: send it to khr-deps, then rerun"
        )


def _resolves(khrdeps, cache, pin) -> bool:
    try:
        offline_git.resolve_pin(khrdeps, cache, pin, pin.get("name", ""))
    except OfflineError:
        return False
    return True


def run(
    repo: Path,
    native_args: list[str],
    providers: dict[str, Path] | None = None,
    allow: dict[str, Any] | None = None,
    cache_root: Path | None = None,
    *,
    job: str,
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
    _check_target(native_args)
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

    _preflight(khrdeps, repo, root, native_args, providers, allow, cache, job)

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
                sha = offline_git.provider_head(khrdeps, source, item.name)
                role, pin_ref = "integration", None
                used.add(item.name)
            else:
                try:
                    pin = khrdeps.git_pin(item.url, item.commit, allow)
                except khrdeps.PinError as exc:
                    raise OfflineError(f"{item.name}: {exc}") from None
                source, sha = offline_git.resolve_pin(khrdeps, cache, pin, item.name)
                role, pin_ref = "pinned-baseline", pin["ref"]
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
    ap.add_argument(
        "--job", type=Path, required=True, help="job root; names the pin request"
    )
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
        return run(args.repo, native_args, providers, job=args.job.name)
    except OfflineError as exc:
        print(f"vvl_offline_deps: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
