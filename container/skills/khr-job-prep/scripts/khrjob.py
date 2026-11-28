"""Shared helpers for the khr job scripts (standard library only)."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MAX_INSTRUCTIONS_BYTES = 1024 * 1024
STATUS_MAX = 64


class JobError(RuntimeError):
    """A deterministic, reportable job failure."""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# Command-scope config outranks repository-local config (same set as khr-deps).
HARDENED_CONFIG = (
    ("core.hooksPath", "/dev/null"),
    ("core.fsmonitor", "false"),
    ("credential.helper", ""),
)


def git_env() -> dict[str, str]:
    """Environment for every job git call: no prompts, no repository-chosen commands.

    - a missing object fails instead of a partial-clone lazy fetch (which runs a
      repository-configured upload-pack command);
    - replacement refs are ignored (they can turn a blob into a signed commit);
    - no hooks, fsmonitor, credential helpers or askpass; https and local only.
    """
    env = {
        **os.environ,
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_ASKPASS": "/bin/false",
        "GIT_ALLOW_PROTOCOL": "https:file",
        "GIT_NO_LAZY_FETCH": "1",
        "GIT_NO_REPLACE_OBJECTS": "1",
    }
    n = int(env.get("GIT_CONFIG_COUNT", "0") or "0")
    for key, value in HARDENED_CONFIG:
        env[f"GIT_CONFIG_KEY_{n}"] = key
        env[f"GIT_CONFIG_VALUE_{n}"] = value
        n += 1
    env["GIT_CONFIG_COUNT"] = str(n)
    return env


def _config(repo: Path | str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(repo), "config", *args],
        capture_output=True,
        text=True,
        env=git_env(),
        check=False,
    )


def reject_filters(repo: Path | str) -> None:
    """Refuse a repository whose own config sets git filters (checkout and status run them).

    Only repository-controlled config counts: ``--local``, plus ``--worktree`` when
    ``extensions.worktreeConfig`` enables a per-worktree file (git refuses
    ``--worktree`` on a linked worktree otherwise). Includes are followed
    explicitly, since git turns them off when a scope is named. An install-level
    filter in the image's global config, such as git-lfs, is trusted.
    """
    pattern = r"^filter\..*\.(clean|process|smudge)$"
    scopes = ["--local"]
    ext = _config(repo, "--local", "--includes", "--bool", "extensions.worktreeConfig")
    if ext.returncode == 0 and ext.stdout.strip() == "true":
        scopes.append("--worktree")
    elif ext.returncode not in (0, 1):
        raise JobError(f"{repo}: could not read git config")
    for scope in scopes:
        r = _config(repo, scope, "--includes", "--get-regexp", pattern)
        if r.returncode != 1:  # 1 = no such configuration; anything else fails closed
            raise JobError(f"{repo}: git filters are not supported in job repositories")


def git(repo: Path | str, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        env=git_env(),
        check=False,
    )
    if check and result.returncode != 0:
        raise JobError(
            f"git {' '.join(args[:3])} failed: {result.stderr.strip()[:300]}"
        )
    return result.stdout.strip()


def git_bytes(repo: Path | str, *args: str) -> bytes:
    """Raw git output (no stripping), for blob contents whose bytes are hashed."""
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        env=git_env(),
        check=False,
    )
    if result.returncode != 0:
        raise JobError(
            f"git {' '.join(args[:3])} failed: {result.stderr.decode(errors='replace').strip()[:300]}"
        )
    return result.stdout


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise JobError(f"missing {path.name}") from exc
    except json.JSONDecodeError as exc:
        raise JobError(f"{path.name} is not valid JSON: {exc}") from exc


def write_json(path: Path, data: Any, mode: int = 0o640) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.chmod(mode)
    tmp.replace(path)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def journal_path(job_root: Path) -> Path:
    """The group-level journal of would-be publications (local only, never pushed)."""
    return job_root.parent.parent / "khr-journal.jsonl"


def read_journal(job_root: Path) -> list[dict[str, Any]]:
    path = journal_path(job_root)
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def append_journal(job_root: Path, entry: dict[str, Any]) -> None:
    with journal_path(job_root).open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, sort_keys=True) + "\n")


def change_set_key(request: dict[str, Any]) -> str:
    return f"p{request['project_id']}:{request['kind']}:{request['iid']}"
