"""Offline git snapshots and safe file helpers shared by the khr dependency adapters.

Standard library only. Everything here assumes no network: git runs with the file
protocol only, no hooks, no fsmonitor, and explicit ``safe.directory`` trust for
the exact paths involved. Writes create files afresh and never follow an
existing link.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

RECORD = "khr-offline-deps.json"
HEX = re.compile(r"[0-9a-f]{40}|[0-9a-f]{64}")


class OfflineError(RuntimeError):
    """A dependency that cannot be prepared without the network or a review."""


def deps_modules():
    """The shared pin model lives in the khr-deps skill next to this one (read-only mount)."""
    deps_scripts = Path(__file__).resolve().parents[2] / "khr-deps" / "scripts"
    if str(deps_scripts) not in sys.path:
        sys.path.insert(0, str(deps_scripts))
    import khrdeps

    return khrdeps


def git_env(khrdeps, trusted: list[Path]) -> dict[str, str]:
    env = khrdeps.clean_git_env()
    for k in ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"):
        env.pop(k, None)
    env["GIT_ALLOW_PROTOCOL"] = "file"
    # A missing object must fail, never trigger a partial-clone lazy fetch: that
    # runs the repository's configured upload-pack command.
    env["GIT_NO_LAZY_FETCH"] = "1"
    pairs = [("core.hooksPath", "/dev/null"), ("core.fsmonitor", "false")]
    for path in trusted:
        pairs += [("safe.directory", str(path)), ("safe.directory", str(path / ".git"))]
    env["GIT_CONFIG_COUNT"] = str(len(pairs))
    for i, (k, v) in enumerate(pairs):
        env[f"GIT_CONFIG_KEY_{i}"] = k
        env[f"GIT_CONFIG_VALUE_{i}"] = v
    return env


def git(env: dict[str, str], *args: str) -> str:
    r = subprocess.run(
        ["git", *args], capture_output=True, text=True, env=env, check=False
    )
    if r.returncode != 0:
        raise OfflineError(f"git {args[0]} failed: {r.stderr.strip()[-300:]}")
    return r.stdout.strip()


def trust_for_children(path: Path) -> None:
    """Child CMake/version probes run git in the snapshot; trust that exact path only."""
    n = int(os.environ.get("GIT_CONFIG_COUNT", "0") or "0")
    os.environ[f"GIT_CONFIG_KEY_{n}"] = "safe.directory"
    os.environ[f"GIT_CONFIG_VALUE_{n}"] = str(path)
    os.environ["GIT_CONFIG_COUNT"] = str(n + 1)


def snapshot(khrdeps, source: Path, target: Path, sha: str) -> None:
    """A depth-1 checkout of ``sha`` from a local repository, no hooks, no network."""
    env = git_env(khrdeps, [source.resolve(), target])
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
    git(env, "init", "-q", str(target))
    git(
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
    git(env, "-C", str(target), "checkout", "-q", "--detach", sha)


def replace(target: Path) -> None:
    """Remove whatever sits at ``target`` without following it."""
    if target.is_symlink() or target.is_file():
        target.unlink()
    elif target.exists():
        shutil.rmtree(target)


def write_new(path: Path, data: bytes) -> None:
    """Create ``path`` afresh: never truncate an existing inode (symlink or hard link)."""
    path.unlink(missing_ok=True)
    with path.open("xb") as fh:
        fh.write(data)


def copy_new(source: Path, path: Path) -> None:
    """``_write_new`` for a file, streamed (release artifacts can be large)."""
    path.unlink(missing_ok=True)
    with source.open("rb") as src, path.open("xb") as dst:
        shutil.copyfileobj(src, dst, length=1 << 20)


def overlaps(a: Path, b: Path) -> bool:
    return a == b or a.is_relative_to(b) or b.is_relative_to(a)


def check_zip_members(archive: zipfile.ZipFile) -> None:
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


def resolve_pin(khrdeps, cache: Path, pin: dict, name: str) -> tuple[Path, str]:
    """The cached bare mirror for a reviewed git pin and the commit it resolves to."""
    source = khrdeps.mirror_path(cache, pin["repo"])
    ref = pin["ref"]
    target_ref = ref if HEX.fullmatch(ref) else f"refs/tags/{ref}"
    try:
        sha = git(
            git_env(khrdeps, [source]),
            "--git-dir",
            str(source),
            "rev-parse",
            "--verify",
            f"{target_ref}^{{commit}}",
        )
    except OfflineError:
        raise OfflineError(
            f"{name}@{ref} is not in the shared cache; request it via khr-deps"
        ) from None
    if HEX.fullmatch(ref) and sha != ref:
        raise OfflineError(f"{name}: mirror resolved {ref} to {sha}")
    return source, sha


PIN_REQUEST = "pin-request.json"


def request_fields(pin: dict) -> dict:
    """The fields a fetch request carries: URL plus ref or hash, nothing else."""
    return {k: pin[k] for k in ("kind", "url", "ref", "sha512", "sha256") if k in pin}


def write_pin_request(work: Path, job: str, missing: list[dict]) -> Path | None:
    """``<work>/pin-request.json`` in prepare's format, or remove a stale one."""
    req = work / PIN_REQUEST
    if not missing:
        req.unlink(missing_ok=True)
        return None
    work.mkdir(parents=True, exist_ok=True)
    body = {"job": job, "pins": [request_fields(p) for p in missing]}
    write_new(req, (json.dumps(body, indent=2) + "\n").encode())
    return req


def provider_head(khrdeps, source: Path, name: str) -> str:
    """HEAD of a clean, committed job repository used in integration mode.

    ``git status`` runs any clean/process filter the repository configures
    (hooksPath and fsmonitor don't cover filters), so a provider with one is
    refused before status runs.
    """
    env = git_env(khrdeps, [source])
    env["GIT_OPTIONAL_LOCKS"] = "0"
    r = subprocess.run(
        [
            "git",
            "-C",
            str(source),
            "config",
            "--get-regexp",
            r"^filter\..*\.(clean|process|smudge)$",
        ],
        capture_output=True,
        env=env,
        check=False,
    )
    if r.returncode != 1:  # 1 = no such configuration; anything else fails closed
        raise OfflineError(f"{name}: provider git filters are unsupported")
    if git(
        env,
        "-C",
        str(source),
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--ignore-submodules=all",
    ):
        raise OfflineError(f"commit {name} edits before integration")
    return git(env, "-C", str(source), "rev-parse", "--verify", "HEAD^{commit}")
