"""Shared pin model for khr dependency preparation (standard library only).

Both sides import this: the khrbotnv prepare step (pin extraction and inventory)
and the orchestrator fetcher. Neither side trusts the other. The fetcher
re-validates every request against the allowlist, and prepare re-verifies every
cached object before marking a pin ready.

Cache layout under ``KHR_DEPS_ROOT`` (default ``/workspace/shared/khr-deps``):

    git/<owner>/<repo>.git     bare mirrors with the pinned commits fetched
    npm/<sha512-hex>.tgz       registry tarballs, named by their integrity
    blobs/<sha256>             archives and single files, named by their sha256
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ALLOWLIST_PATH = HERE.parent / "allowlist.json"
DEFAULT_ROOT = "/workspace/shared/khr-deps"
_GH_URL = re.compile(
    r"^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$"
)
_REF = re.compile(r"^(?:[0-9a-f]{40}|[0-9a-f]{64}|v[0-9]+(?:\.[0-9]+){1,3})$")
_SAFE_PATH = re.compile(r"^[A-Za-z0-9@_./%+-]+$")


class PinError(ValueError):
    """A pin that must not be fetched or used."""


def load_allowlist(path: Path | None = None) -> dict[str, Any]:
    data = json.loads((path or ALLOWLIST_PATH).read_text(encoding="utf-8"))
    if data.get("schema") != 1:
        raise PinError("unsupported allowlist schema")
    return data


def deps_root() -> Path:
    return Path(os.environ.get("KHR_DEPS_ROOT") or DEFAULT_ROOT)


def git_pin(url: str, ref: str, allow: dict[str, Any]) -> dict[str, str]:
    """Validate a git dependency: a reviewed GitHub repo at an exact SHA or version tag."""
    m = _GH_URL.match(url or "")
    if not m:
        raise PinError("not a GitHub repository URL")
    repo = f"{m.group(1)}/{m.group(2)}"
    if repo not in set(allow["github"]):
        raise PinError(f"unreviewed source {repo}")
    if not isinstance(ref, str) or not _REF.match(ref):
        raise PinError("git dependency needs an exact SHA or version tag")
    return {
        "kind": "git",
        "repo": repo,
        "url": f"https://github.com/{repo}.git",
        "ref": ref,
    }


def npm_pin(url: str, integrity: str, allow: dict[str, Any]) -> dict[str, str]:
    from urllib.parse import urlsplit

    u = urlsplit(url or "")
    if (
        u.scheme != "https"
        or u.netloc != allow["npmHost"]
        or u.query
        or u.fragment
        or not u.path.endswith(".tgz")
    ):
        raise PinError("npm dependency is not a registry tarball")
    if len(url) > 512 or ".." in u.path.split("/") or not _SAFE_PATH.match(u.path):
        raise PinError("unsafe npm tarball path")
    if not isinstance(integrity, str) or not integrity.startswith("sha512-"):
        raise PinError("npm dependency needs sha512 integrity")
    digest = base64.b64decode(integrity[7:], validate=True)
    if len(digest) != 64:
        raise PinError("invalid sha512 integrity")
    return {"kind": "npm", "url": url, "sha512": digest.hex()}


def blob_pin(url: str, allow: dict[str, Any]) -> dict[str, str]:
    pinned = {**allow.get("archives", {}), **allow.get("files", {})}
    if url not in pinned:
        raise PinError("archive or file is not a reviewed, pinned download")
    return {"kind": "blob", "url": url, "sha256": pinned[url]}


def file_digest(path: Path, algorithm: str) -> str:
    h = hashlib.new(algorithm)
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def clean_git_env() -> dict[str, str]:
    """No credentials, no user or system config, no prompts; https only."""
    env = {
        k: v
        for k, v in os.environ.items()
        if k.upper()
        in {
            "PATH",
            "HTTPS_PROXY",
            "HTTP_PROXY",
            "NO_PROXY",
            "SSL_CERT_FILE",
            "GIT_SSL_CAINFO",
        }
        or k in {"https_proxy", "http_proxy", "no_proxy"}
    }
    env.update(
        {
            "LANG": "C.UTF-8",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_ASKPASS": "/bin/false",
            "GIT_ALLOW_PROTOCOL": "https:file",
            # Missing objects fail instead of a partial-clone lazy fetch, which
            # would run a repository-configured upload-pack command.
            "GIT_NO_LAZY_FETCH": "1",
            "HOME": os.environ.get("HOME", "/tmp"),
        }
    )
    return env


def mirror_path(root: Path, repo: str) -> Path:
    owner, name = repo.split("/", 1)
    return root / "git" / owner / f"{name}.git"


def git_has(mirror: Path, ref: str) -> bool:
    if not (mirror / "HEAD").exists():
        return False
    target = (
        ref if re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", ref) else f"refs/tags/{ref}"
    )
    r = subprocess.run(
        ["git", "-C", str(mirror), "cat-file", "-e", f"{target}^{{commit}}"],
        capture_output=True,
        env=clean_git_env(),
        check=False,
    )
    return r.returncode == 0


def pin_present(root: Path, pin: dict[str, str]) -> bool:
    """Re-verify a cached pin from its bytes; never trust that a file exists."""
    if pin["kind"] == "git":
        return git_has(mirror_path(root, pin["repo"]), pin["ref"])
    if pin["kind"] == "npm":
        p = root / "npm" / f"{pin['sha512']}.tgz"
        return p.is_file() and file_digest(p, "sha512") == pin["sha512"]
    if pin["kind"] == "blob":
        p = root / "blobs" / pin["sha256"]
        return p.is_file() and file_digest(p, "sha256") == pin["sha256"]
    return False


def request_key(pin: dict[str, str]) -> str:
    return {
        "git": lambda p: f"git:{p['repo']}@{p['ref']}",
        "npm": lambda p: f"npm:{p['sha512']}",
        "blob": lambda p: f"blob:{p['sha256']}",
    }[pin["kind"]](pin)
