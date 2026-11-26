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


def git(repo: Path | str, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
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
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
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
