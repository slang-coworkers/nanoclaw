"""Inject replay-corpus requests into a khr agent group through the CLI socket.

The CLI channel's operator-only socket (``data/cli.sock``, mode 0600) accepts a
routed line, ``{"text": ..., "to": {"channelType", "platformId", "threadId"}}``,
that goes through the normal router into a per-thread session. Nothing here
talks to GitLab.

For each accepted record, in corpus order:

1. Stage the job inputs under ``<groups-dir>/<folder>/jobs/<job>/``, which the
   agent sees as ``/workspace/agent/jobs/<job>/``:
   ``request.json``, ``reference-context.md`` (untrusted), and
   ``issue-discussions.json`` or ``mr-discussions.json`` (untrusted).
2. Send one routed line. The thread is the issue or MR, so its follow-ups share
   a session.

Dry by default: it prints what it would do. Pass ``--send`` to stage and send.
A job already staged is skipped unless ``--force`` is given.

    python3 -I khr/replay/inject.py --corpus <data>/khr-replay/corpus.jsonl \\
        --install-root ~/khr-coworkers/nanoclaw --folder khr-implement \\
        --channel-type dashboard --platform-id dashboard:khr-implement [--send]
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

Sender = Callable[[str, dict[str, Any]], None]


def job_id(rec: dict[str, Any]) -> str:
    return f"p{rec['project_id']}-{'i' if rec['kind'] == 'issue' else 'm'}{rec['iid']}-n{rec['note_id']}"


def thread_id(rec: dict[str, Any]) -> str:
    return f"khr:p{rec['project_id']}:{rec['kind']}:{rec['iid']}"


def message_text(rec: dict[str, Any], job: str) -> str:
    where = (
        f"issue #{rec['iid']}"
        if rec["kind"] == "issue"
        else f"merge request !{rec['iid']}"
    )
    model = f" Model: {rec['model']}." if rec.get("model") else ""
    return (
        f"/khr-implement job={job}\n\n"
        f"Replayed request (dry run: never publish) from @{rec['author']['username']} "
        f"on {rec['project_path']} {where}.{model}\n"
        f"The request is in /workspace/agent/jobs/{job}/request.json."
    )


def stage(job_root: Path, rec: dict[str, Any]) -> None:
    job_root.mkdir(parents=True, exist_ok=True)
    request = {
        "source_key": rec["source_key"],
        "project_path": rec["project_path"],
        "project_id": rec["project_id"],
        "kind": rec["kind"],
        "iid": rec["iid"],
        "discussion_id": rec["discussion_id"],
        "note_id": rec["note_id"],
        "note_created_at": rec["created_at"],
        "author": rec["author"],
        "body_sha256": rec["body_sha256"],
        "command": rec["command"],
        "model": rec.get("model"),
        "preceding_text": rec.get("preceding_text", ""),
        "mode": "replay-dry-run",
    }
    files = {
        "request.json": json.dumps(request, indent=2) + "\n",
        "reference-context.md": "<!-- untrusted reference material -->\n"
        + rec["reference_context"]
        + "\n",
        f"{'issue' if rec['kind'] == 'issue' else 'mr'}-discussions.json": json.dumps(
            {
                "provenance": "untrusted reference material, captured through the triggering note",
                "discussions": rec["snapshot"],
            },
            indent=2,
        )
        + "\n",
    }
    for name, content in files.items():
        path = job_root / name
        path.write_text(content, encoding="utf-8")
        path.chmod(0o640)
    (job_root / ".injected").write_text(
        datetime.now(timezone.utc).isoformat() + "\n", encoding="utf-8"
    )


def socket_sender(sock_path: str) -> Sender:
    def send(text: str, to: dict[str, Any]) -> None:
        line = json.dumps({"text": text, "to": to}) + "\n"
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
            s.connect(sock_path)
            s.sendall(line.encode("utf-8"))

    return send


def run(
    corpus: Path,
    groups_dir: Path,
    folder: str,
    channel_type: str,
    platform_id: str,
    send: Sender | None,
    only: set[str] | None = None,
    limit: int | None = None,
    force: bool = False,
    out=sys.stdout,
) -> list[str]:
    """Stage and send (or, with ``send=None``, only describe) accepted records. Returns the job ids handled."""
    handled: list[str] = []
    for line in corpus.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        if rec.get("status") != "accepted":
            continue
        job = job_id(rec)
        if only and job not in only:
            continue
        if limit is not None and len(handled) >= limit:
            break
        job_root = groups_dir / folder / "jobs" / job
        if (job_root / ".injected").exists() and not force:
            print(f"skip {job} (already staged)", file=out)
            continue
        to = {
            "channelType": channel_type,
            "platformId": platform_id,
            "threadId": thread_id(rec),
        }
        if send is None:
            print(f"would stage {job_root} and send to {to}", file=out)
        else:
            stage(job_root, rec)
            send(message_text(rec, job), to)
            print(f"sent {job} -> {to['threadId']}", file=out)
        handled.append(job)
    return handled


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--corpus", required=True)
    ap.add_argument(
        "--install-root",
        required=True,
        help="the khr nanoclaw checkout (holds groups/ and data/)",
    )
    ap.add_argument("--folder", default="khr-implement")
    ap.add_argument("--channel-type", required=True)
    ap.add_argument("--platform-id", required=True)
    ap.add_argument(
        "--only", action="append", default=[], help="job id to inject (repeatable)"
    )
    ap.add_argument("--limit", type=int)
    ap.add_argument("--force", action="store_true")
    ap.add_argument(
        "--send",
        action="store_true",
        help="actually stage and send; default is a dry listing",
    )
    args = ap.parse_args(argv)

    root = Path(args.install_root).expanduser().resolve()
    sock = root / "data" / "cli.sock"
    sender = None
    if args.send:
        if not sock.exists():
            ap.error(f"{sock} not found: is the khr install's host running?")
        if os.stat(sock).st_uid != os.getuid():
            ap.error(f"{sock} is not owned by this user")
        sender = socket_sender(str(sock))
    run(
        Path(args.corpus),
        root / "groups",
        args.folder,
        args.channel_type,
        args.platform_id,
        sender,
        set(args.only) or None,
        args.limit,
        args.force,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
