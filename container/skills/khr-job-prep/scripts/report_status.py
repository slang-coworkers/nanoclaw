"""Record the agent's current high-level phase for a khr job (local only).

    python3 report_status.py --job /workspace/agent/jobs/<job> "Writing spec language"

One line, at most 64 characters (longer text is cut with an ellipsis). It never
contacts GitLab; whoever displays status reads ``agent-status.json``.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from khrjob import STATUS_MAX, now_iso, write_json


def clip(text: str) -> str:
    line = " ".join(text.split())
    return line if len(line) <= STATUS_MAX else line[: STATUS_MAX - 1] + "…"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True)
    ap.add_argument("status")
    args = ap.parse_args(argv)
    job = Path(args.job)
    if not job.is_dir():
        print(f"no such job {job}")
        return 2
    write_json(
        job / "agent-status.json", {"status": clip(args.status), "updatedAt": now_iso()}
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
