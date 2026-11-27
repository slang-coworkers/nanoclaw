"""Install the khr validation toolchain overlay offline into the job's dependency root.

    python3 setup_toolchain.py --job <JOB_ROOT> [--wheels DIR] [--requirements FILE]

Run it through the check wrapper as a setup step:

    python3 /app/skills/khr-validation/scripts/run_check.py --job <JOB_ROOT> --kind setup \\
        --name toolchain --repository <any job worktree> -- \\
        python3 /app/skills/khr-validation/scripts/setup_toolchain.py --job <JOB_ROOT>

It creates ``$KHR_DEPENDENCY_ROOT/toolchain``, a venv with ``--system-site-packages``
so the image's compiled modules (lxml, ...) stay visible. It installs the
hash-pinned ``requirements-toolchain.txt`` only from the wheel cache (a read-only extra mount if present, else the group's ``khr-deps/wheels``; ``--require-hashes`` makes a tampered wheel fail)
(``--no-index --only-binary=:all: --require-hashes``), so it never touches the
network. If the venv already matches the pinned set, it is reused.

It writes ``toolchain.env`` (``export PATH=...``) and ``toolchain.json`` (tool
versions, recorded as evidence). Exit codes: 0 ready, 3 cache missing
(infrastructure_error), 4 install failed (infrastructure_error).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import venv
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_REQUIREMENTS = HERE.parent / "requirements-toolchain.txt"
WHEEL_CANDIDATES = (
    "/workspace/extra/khr-deps/wheels",
    "/workspace/agent/khr-deps/wheels",
)
DEFAULT_WHEELS = os.environ.get("KHR_WHEEL_CACHE") or next(
    (p for p in WHEEL_CANDIDATES if Path(p).is_dir()), WHEEL_CANDIDATES[-1]
)


def dependency_root(job: Path) -> Path:
    return Path(os.environ.get("KHR_DEPENDENCY_ROOT") or job / ".khr-dependencies")


def requirements_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tool_versions(bin_dir: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    py = bin_dir / "python3"
    probes = {
        "clang-format": [str(bin_dir / "clang-format"), "--version"],
        "pyparsing": [str(py), "-c", "import pyparsing; print(pyparsing.__version__)"],
        "beautifulsoup4": [str(py), "-c", "import bs4; print(bs4.__version__)"],
    }
    for name, cmd in probes.items():
        try:
            r = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30, check=False
            )
            out[name] = (
                (r.stdout or r.stderr).strip().splitlines()[0]
                if (r.stdout or r.stderr).strip()
                else f"exit {r.returncode}"
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            out[name] = f"unavailable: {exc.__class__.__name__}"
    return out


def setup(job: Path, wheels: Path, requirements: Path, pip_runner=None) -> dict:
    if not wheels.is_dir() or not any(wheels.glob("*.whl")):
        raise SystemExit(3)
    root = dependency_root(job)
    env_dir = root / "toolchain"
    stamp = env_dir / ".requirements.sha256"
    digest = requirements_digest(requirements)
    reused = env_dir.is_dir() and stamp.exists() and stamp.read_text().strip() == digest
    if not reused:
        root.mkdir(parents=True, exist_ok=True)
        venv.EnvBuilder(system_site_packages=True, clear=True, with_pip=True).create(
            env_dir
        )
        cmd = [
            str(env_dir / "bin" / "python3"),
            "-m",
            "pip",
            "install",
            "--no-index",
            "--only-binary=:all:",
            "--require-hashes",
            "--find-links",
            str(wheels),
            "--disable-pip-version-check",
            "-r",
            str(requirements),
        ]
        result = (pip_runner or _run)(cmd)
        if result != 0:
            raise SystemExit(4)
        stamp.write_text(digest + "\n")
    bin_dir = env_dir / "bin"
    (root / "toolchain.env").write_text(f'export PATH="{bin_dir}:$PATH"\n')
    record = {
        "venv": str(env_dir),
        "reused": reused,
        "requirementsSha256": digest,
        "versions": tool_versions(bin_dir),
    }
    (root / "toolchain.json").write_text(
        json.dumps(record, indent=2, sort_keys=True) + "\n"
    )
    return record


def _run(cmd: list[str]) -> int:
    return subprocess.run(cmd, check=False).returncode


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--job", required=True)
    ap.add_argument("--wheels", default=DEFAULT_WHEELS)
    ap.add_argument("--requirements", default=str(DEFAULT_REQUIREMENTS))
    args = ap.parse_args(argv)
    try:
        record = setup(
            Path(args.job).resolve(), Path(args.wheels), Path(args.requirements)
        )
    except SystemExit as exc:
        code = int(exc.code or 1)
        reason = {
            3: f"wheel cache missing or empty at {args.wheels}",
            4: "offline pip install failed",
        }.get(code, "failed")
        print(f"KHR_TOOLCHAIN=infrastructure_error: {reason}")
        return code
    print("KHR_TOOLCHAIN=ready " + json.dumps(record["versions"], sort_keys=True))
    print(f"source {dependency_root(Path(args.job).resolve()) / 'toolchain.env'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
