"""Run one setup or validation command and record objective evidence for a khr job.

    python3 run_check.py --job <JOB_ROOT> --kind setup|validation --name <stable-name> \\
        --repository <WORKTREE> [--resource build] [--profile ID] \\
        [--test-framework gtest|ctest --expect-test NAME ...] [--timeout SECONDS] -- <command...>

Each run gets a ``checkId`` and its own log, and appends one record to
``<JOB_ROOT>/.khr-validation/checks.jsonl``. It prints ``KHR_CHECK_RESULT={...}``.
The finish step treats these records as authoritative.

Classification:

- exit 0 is ``passed``; a non-zero exit is ``failed``, unless the output shows a
  setup or tool or network problem, which is ``infrastructure_error``;
- the time limit gives ``timeout``;
- gtest/ctest: zero tests is ``not_run``; all skipped is ``skipped``; an expected
  test that did not pass is ``failed``.

``--resource build`` takes the shared build lease, one heavy build at a time,
and sets ``KHR_BUILD_JOBS`` and ``CMAKE_BUILD_PARALLEL_LEVEL``. Time spent
waiting for the lease does not count against the command's timeout.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

INFRA_PATTERNS = [
    r"ModuleNotFoundError",
    r"ImportError",
    r"command not found",
    r"No such file or directory: '[^']*(python|node|npm|cmake|ninja)",
    r"Could not resolve host",
    r"Temporary failure in name resolution",
    r"Network is unreachable",
    r"Connection refused",
    r"npm ERR! code E(NOTCACHED|AI_AGAIN|CONNREFUSED)",
    r"Could NOT find",
]
DEFAULT_BUILD_JOBS = int(os.environ.get("KHR_BUILD_JOBS_DEFAULT", "6"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def classify(code: int | None, output: str, timed_out: bool) -> tuple[str, str | None]:
    if timed_out:
        return "timeout", "timeout"
    if code == 0:
        return "passed", None
    if any(re.search(p, output) for p in INFRA_PATTERNS):
        return "infrastructure_error", "setup"
    return "failed", "validation"


def test_counts(framework: str | None, output: str) -> dict[str, int] | None:
    if framework == "gtest":
        ran = re.search(
            r"\[=+\] (\d+) tests? from \d+ test (?:suites?|cases?) ran", output
        )
        passed = re.search(r"\[  PASSED  \] (\d+) tests?", output)
        skipped = re.search(r"\[  SKIPPED \] (\d+) tests?", output)
        return {
            "run": int(ran.group(1)) if ran else 0,
            "passed": int(passed.group(1)) if passed else 0,
            "skipped": int(skipped.group(1)) if skipped else 0,
        }
    if framework == "ctest":
        m = re.search(r"(\d+)% tests passed, (\d+) tests failed out of (\d+)", output)
        skipped = len(re.findall(r"\*\*\*Skipped|Not Run", output))
        if not m:
            return {"run": 0, "passed": 0, "skipped": skipped}
        total, failed = int(m.group(3)), int(m.group(2))
        return {"run": total, "passed": total - failed - skipped, "skipped": skipped}
    return None


def apply_test_rules(
    result: str, counts: dict[str, int] | None, expected: list[str], output: str
) -> tuple[str, str | None]:
    if counts is None:
        return result, None
    if counts["run"] == 0:
        return "not_run", "no-tests"
    if counts["skipped"] >= counts["run"]:
        return "skipped", "all-skipped"
    for name in expected:
        if not re.search(
            rf"\[\s+OK \]\s+{re.escape(name)}\b|{re.escape(name)}\s+\.+\s+Passed",
            output,
        ):
            return "failed", "expected-test-not-passed"
    return result, None


class BuildLease:
    def __init__(self, path: Path):
        self.path = path
        self.fh = None

    def __enter__(self) -> float:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.fh = self.path.open("a+")
        start = time.monotonic()
        fcntl.flock(self.fh, fcntl.LOCK_EX)
        return time.monotonic() - start

    def __exit__(self, *exc: object) -> None:
        if self.fh:
            fcntl.flock(self.fh, fcntl.LOCK_UN)
            self.fh.close()


def run(args: argparse.Namespace) -> dict:
    job = Path(args.job).resolve()
    repo = Path(args.repository).resolve()
    if not repo.is_dir() or job not in repo.parents:
        raise SystemExit("--repository must be a worktree inside the job")
    evidence = job / ".khr-validation"
    (evidence / "outputs").mkdir(parents=True, exist_ok=True)
    check_id = uuid.uuid4().hex[:16]
    log_path = evidence / "outputs" / f"{check_id}.log"
    env = dict(os.environ)
    waited = 0.0
    lease = None
    if args.resource == "build":
        env["KHR_BUILD_JOBS"] = env["CMAKE_BUILD_PARALLEL_LEVEL"] = str(
            DEFAULT_BUILD_JOBS
        )
        lease = BuildLease(
            Path(
                os.environ.get(
                    "KHR_BUILD_LEASE", str(job.parent.parent / ".khr-build.lock")
                )
            )
        )
    started = _now()
    t0 = time.monotonic()
    timed_out, code = False, None
    try:
        if lease:
            waited = lease.__enter__()
        with log_path.open("w", encoding="utf-8") as log:
            try:
                proc = subprocess.run(
                    args.command,
                    cwd=repo,
                    env=env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    timeout=args.timeout,
                    check=False,
                )
                code = proc.returncode
            except subprocess.TimeoutExpired:
                timed_out = True
            except FileNotFoundError as exc:
                log.write(f"command not found: {exc}\n")
                code = 127
    finally:
        if lease:
            lease.__exit__(None, None, None)
    output = log_path.read_text(encoding="utf-8", errors="replace")
    result, kind = classify(code, output, timed_out)
    counts = test_counts(args.test_framework, output)
    if result in {"passed", "failed"}:
        result, test_kind = apply_test_rules(result, counts, args.expect_test, output)
        kind = test_kind or kind
    record = {
        "schema": 1,
        "checkId": check_id,
        "kind": args.kind,
        "name": args.name,
        "repository": str(repo),
        "command": args.command,
        "resource": args.resource,
        "profile": args.profile,
        "startedAt": started,
        "durationSeconds": round(time.monotonic() - t0 - waited, 2),
        "leaseWaitSeconds": round(waited, 2),
        "exitCode": code,
        "result": result,
        "failureKind": kind,
        "testCounts": counts,
        "log": str(log_path),
    }
    with (evidence / "checks.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, sort_keys=True) + "\n")
    return record


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--" not in argv:
        print("usage: run_check.py [options] -- <command...>")
        return 2
    split = argv.index("--")
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True)
    ap.add_argument("--kind", required=True, choices=["setup", "validation"])
    ap.add_argument("--name", required=True)
    ap.add_argument("--repository", required=True)
    ap.add_argument("--resource", choices=["build"])
    ap.add_argument("--profile")
    ap.add_argument("--test-framework", choices=["gtest", "ctest"])
    ap.add_argument("--expect-test", action="append", default=[])
    ap.add_argument("--timeout", type=int, default=3600)
    args = ap.parse_args(argv[:split])
    args.command = argv[split + 1 :]
    if not args.command:
        print("no command given after --")
        return 2
    if re.search(r"-(final|fixed|retry\d*|attempt\d*)$", args.name):
        print(
            "--name must be stable across retries (no final/fixed/retry/attempt suffix)"
        )
        return 2
    record = run(args)
    print(
        "KHR_CHECK_RESULT="
        + json.dumps(
            {
                k: record[k]
                for k in ("checkId", "name", "result", "exitCode", "failureKind")
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
