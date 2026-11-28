#!/usr/bin/env python3
"""Prepare VK-GL-CTS ``external/`` sources offline, from the shared cache.

Port of khrbotnv's ``cts_offline_deps.py``. CTS declares its sources in
``external/fetch_sources.py`` (``PACKAGES``), and its build expects them where that
script leaves them. This adapter never executes the script: it reads ``PACKAGES``
from the committed file as a syntax tree (khr-deps ``pins.parse_cts``) and
reproduces the native layout from verified cache objects:

- ``GitRepo``: ``external/<dir>/src`` is a fresh depth-1 snapshot of the pinned
  commit from the cache's bare mirror (a tag pin also gets its local tag, so a
  later native run finds the revision offline).
- ``SourcePackage``: ``external/<dir>/packages/<file>`` plus native's
  ``extracted`` checksum marker, and the archive's single top-level directory
  extracted into ``external/<dir>/src``. Only regular files, directories and
  links that stay inside are extracted. libpng's declared ``postExtract`` (copy
  ``scripts/pnglibconf.h.prebuilt`` to ``pnglibconf.h``) is reproduced.
- ``SourceFile``: ``external/<dir>/src/<file>``.

Vulkan-ValidationLayers is skipped, as native skips it without ``--include-vvl``.
Integration mode: ``--provider <dir>=PATH`` takes that directory from a clean,
committed job repository's ``HEAD`` instead of the pin.

Every reviewed pin is checked before anything is written, so a missing pin fails
with the complete list to request via khr-deps. Paths git tracks are never
deleted. Writes ``<dependency-root>/khr-offline-deps.json`` (agent-reported
provenance). Standard library only.

The CTS build and tests are still the job's own code: the container network and
the read-only cache mount keep a job offline, not this script.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import offline_git
from offline_git import RECORD, OfflineError

DECLARATION = "external/fetch_sources.py"


def _pins_module():
    offline_git.deps_modules()
    import pins

    return pins


def _declaration(khrdeps, repo: Path) -> bytes:
    """``fetch_sources.py`` at the committed ``HEAD``; uncommitted edits are refused."""
    env = offline_git.git_env(khrdeps, [repo])
    r = subprocess.run(
        ["git", "-C", str(repo), "cat-file", "blob", f"HEAD:{DECLARATION}"],
        capture_output=True,
        env=env,
        check=False,
    )
    if r.returncode != 0:
        raise OfflineError(f"no committed {DECLARATION} in {repo}")
    work = repo / DECLARATION
    if work.is_symlink() or not work.is_file() or work.read_bytes() != r.stdout:
        raise OfflineError(f"commit {DECLARATION} edits first")
    return r.stdout


def _target(repo: Path, subdir: str, leaf: str) -> Path:
    """``external/<subdir>/<leaf>`` inside the repository, with no symlinked part."""
    path = repo / "external" / subdir / leaf
    for part in (repo / "external", repo / "external" / subdir, path):
        if part.is_symlink():
            raise OfflineError(f"{part.relative_to(repo)} is a symlink")
    if not path.resolve().is_relative_to(repo):
        raise OfflineError(f"{path} escapes the repository")
    return path


def _tracked(khrdeps, repo: Path) -> list[Path]:
    """Everything under ``external/`` that the index or ``HEAD`` tracks (incl. gitlinks)."""
    env = offline_git.git_env(khrdeps, [repo])
    out: set[str] = set()
    for args in (
        ("ls-files", "-z", "--", "external"),
        ("ls-tree", "-r", "-z", "--name-only", "HEAD", "--", "external"),
    ):
        listing = offline_git.git(env, "-C", str(repo), *args)
        out.update(x for x in listing.split("\0") if x)
    return [repo / x for x in sorted(out)]


def _untracked(tracked: list[Path], repo: Path, path: Path) -> None:
    for t in tracked:
        if offline_git.overlaps(t, path):
            raise OfflineError(
                f"{path.relative_to(repo)} overlaps tracked {t.relative_to(repo)}; "
                "refusing to replace it"
            )


def _tar_members(archive: tarfile.TarFile) -> list[tarfile.TarInfo]:
    """Regular files, directories and in-tree links only; never write through a link."""
    links: set[PurePosixPath] = set()
    names: set[PurePosixPath] = set()
    out = []
    for m in archive.getmembers():
        p = PurePosixPath(m.name)
        if not m.name or "\\" in m.name or p.is_absolute() or ".." in p.parts:
            raise OfflineError(f"unsafe archive member: {m.name!r}")
        if any(parent in links for parent in p.parents):
            raise OfflineError(f"archive member written through a symlink: {m.name!r}")
        if m.issym():
            dest = PurePosixPath(m.linkname)
            if dest.is_absolute() or "\\" in m.linkname or ".." in dest.parts:
                raise OfflineError(f"unsafe archive symlink target: {m.name!r}")
            links.add(p)
        elif m.islnk():
            if PurePosixPath(m.linkname) not in names:
                raise OfflineError(
                    f"archive hard link to an unknown member: {m.name!r}"
                )
        elif not (m.isreg() or m.isdir()):
            raise OfflineError(f"unsupported archive member type: {m.name!r}")
        # No setuid/setgid/sticky bits, and nothing group- or world-writable.
        m.mode &= ~(
            stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX | stat.S_IWGRP | stat.S_IWOTH
        )
        names.add(p)
        out.append(m)
    return out


def _extract(blob: Path, filename: str, tmp: Path) -> Path:
    """Extract into ``tmp`` and return its single top-level directory (as native)."""
    offline_git.replace(tmp)
    tmp.mkdir(parents=True)
    if filename.endswith(".zip"):
        with zipfile.ZipFile(blob) as archive:
            offline_git.check_zip_members(archive)
            archive.extractall(tmp)
    else:
        with tarfile.open(blob) as archive:
            members = _tar_members(archive)
            kwargs = {"filter": "data"} if hasattr(tarfile, "data_filter") else {}
            archive.extractall(tmp, members=members, **kwargs)
    entries = list(tmp.iterdir())
    if len(entries) != 1 or entries[0].is_symlink() or not entries[0].is_dir():
        raise OfflineError(f"{filename} doesn't contain a single top-level directory")
    return entries[0]


def run(
    repo: Path,
    dependency_root: Path,
    providers: dict[str, Path] | None = None,
    allow: dict[str, Any] | None = None,
    cache_root: Path | None = None,
    *,
    job: str,
) -> int:
    sys.dont_write_bytecode = True
    khrdeps = offline_git.deps_modules()
    pins = _pins_module()
    allow = allow or khrdeps.load_allowlist()
    cache = (cache_root or khrdeps.deps_root()).resolve()
    repo = repo.resolve()
    work = Path(os.path.abspath(dependency_root))
    if offline_git.overlaps(work.resolve(), repo):
        raise OfflineError(
            "--dependency-root overlaps the repository; use a separate directory"
        )
    providers = {k: v.resolve() for k, v in (providers or {}).items()}
    for name, path in providers.items():
        if path.is_relative_to(repo / "external"):
            raise OfflineError(
                f"--provider {name} is inside external/; use a separate checkout"
            )
        if offline_git.overlaps(path, work.resolve()):
            raise OfflineError(
                f"--provider {name} overlaps --dependency-root; use a separate dependency root"
            )

    entries = pins.parse_cts(_declaration(khrdeps, repo), allow)
    unknown = set(providers) - {e["subdir"] for e in entries if e["kind"] == "git"}
    if unknown:
        raise OfflineError(f"--provider names no CTS git dependency: {sorted(unknown)}")

    # Preflight: every pin must be reviewed and cached before anything is replaced.
    problems, plan, missing = [], [], []
    for e in entries:
        sub = e["subdir"]
        if e["kind"] == "unavailable":
            problems.append(f"{sub}: {e['reason']}")
            continue
        if sub in providers:
            plan.append(
                (
                    e,
                    providers[sub],
                    offline_git.provider_head(khrdeps, providers[sub], sub),
                )
            )
            continue
        if e["kind"] == "git":
            try:
                source, sha = offline_git.resolve_pin(khrdeps, cache, e, sub)
            except OfflineError as exc:
                problems.append(str(exc))
                missing.append(e)
                continue
            plan.append((e, source, sha))
        elif khrdeps.pin_present(cache, e):
            plan.append((e, cache / "blobs" / e["sha256"], e["sha256"]))
        else:
            problems.append(
                f"{sub} ({e['url']}) is not in the shared cache; request it via khr-deps"
            )
            missing.append(e)
    req = offline_git.write_pin_request(work, job, missing)
    if problems:
        hint = f"\n  wrote {req}: send it to khr-deps, then rerun" if req else ""
        raise OfflineError(
            "cannot prepare CTS sources offline:\n  " + "\n  ".join(problems) + hint
        )

    tracked = _tracked(khrdeps, repo)
    for e, _, _ in plan:
        _untracked(tracked, repo, _target(repo, e["subdir"], "src"))
        if e.get("ctsKind") == "archive":
            _untracked(tracked, repo, _target(repo, e["subdir"], "packages"))

    work.mkdir(parents=True, exist_ok=True)
    record: list[dict[str, Any]] = []
    for e, source, ident in plan:
        sub = e["subdir"]
        dest = _target(repo, sub, "src")
        if e["kind"] == "git":
            offline_git.replace(dest)
            offline_git.snapshot(khrdeps, source, dest, ident)
            env = offline_git.git_env(khrdeps, [dest])
            offline_git.git(
                env, "-C", str(dest), "config", "remote.origin.url", e["url"]
            )
            ref = None if sub in providers else e["ref"]
            if ref and not offline_git.HEX.fullmatch(ref):
                offline_git.git(env, "-C", str(dest), "tag", ref, ident)
            role = "integration" if sub in providers else "pinned-baseline"
            record.append(
                {
                    "name": sub,
                    "role": role,
                    "url": e["url"],
                    "ref": ref,
                    "sha": ident,
                    "path": str(dest.relative_to(repo)),
                }
            )
        elif e["ctsKind"] == "archive":
            filename = e["url"].rsplit("/", 1)[-1]
            packages = _target(repo, sub, "packages")
            offline_git.replace(packages)
            packages.mkdir(parents=True)
            offline_git.copy_new(source, packages / filename)
            if khrdeps.file_digest(packages / filename, "sha256") != ident:
                raise OfflineError(f"{sub} archive changed while copying")
            top = _extract(packages / filename, filename, work / f".extract-{sub}")
            offline_git.replace(dest)
            shutil.move(str(top), str(dest))
            offline_git.replace(work / f".extract-{sub}")
            if e.get("postExtract") == "postExtractLibpng":
                offline_git.copy_new(
                    dest / "scripts" / "pnglibconf.h.prebuilt", dest / "pnglibconf.h"
                )
            offline_git.write_new(packages / "extracted", ident.encode())
            record.append(
                {
                    "name": sub,
                    "role": "pinned-archive",
                    "url": e["url"],
                    "sha256": ident,
                    "path": str(dest.relative_to(repo)),
                }
            )
        else:
            offline_git.replace(dest)
            dest.mkdir(parents=True)
            offline_git.copy_new(source, dest / e["filename"])
            if khrdeps.file_digest(dest / e["filename"], "sha256") != ident:
                raise OfflineError(f"{sub} file changed while copying")
            record.append(
                {
                    "name": sub,
                    "role": "pinned-file",
                    "url": e["url"],
                    "sha256": ident,
                    "path": str((dest / e["filename"]).relative_to(repo)),
                }
            )
        print(f"Prepared {sub} ({record[-1]['role']})", flush=True)

    body = {
        "schema": 1,
        "provenance": "agent-reported",
        "repository": str(repo),
        "declaration": DECLARATION,
        "dependencies": record,
    }
    offline_git.write_new(work / RECORD, (json.dumps(body, indent=2) + "\n").encode())
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "--job", type=Path, required=True, help="job root; names the pin request"
    )
    ap.add_argument("--repository", type=Path, required=True)
    ap.add_argument("--dependency-root", type=Path, required=True)
    ap.add_argument("--provider", action="append", default=[], metavar="DIR=PATH")
    args = ap.parse_args(argv)
    providers: dict[str, Path] = {}
    for value in args.provider:
        name, sep, path = value.partition("=")
        if not sep or not name or not path or name in providers:
            ap.error("--provider takes distinct DIR=PATH entries")
        providers[name] = Path(path)
    try:
        return run(args.repository, args.dependency_root, providers, job=args.job.name)
    except OfflineError as exc:
        print(f"cts_offline_deps: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
