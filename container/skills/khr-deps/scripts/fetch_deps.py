"""Fetch reviewed, pinned public dependencies into the shared khr dependency cache.

    python3 fetch_deps.py --request <pin-request.json> [--root DIR]

Runs in the orchestrator, the only khr agent with public GitHub/npm GET egress
and the only one that can write ``/workspace/shared``. The request comes from a
khr job as a list of pins (URL plus SHA, tag or hash, nothing else).

The request is untrusted. Every entry is rebuilt from the reviewed allowlist, and
anything that doesn't validate is refused, never fetched:

- git: a reviewed GitHub repo at an exact SHA or vX.Y tag, fetched shallow by
  ref into a bare mirror and verified with ``git cat-file -e <ref>^{commit}``;
- npm: a registry.npmjs.org tarball, verified against its sha512 integrity;
- blob: a reviewed archive or file URL, verified against its pinned sha256.

Downloads are GET-only with no credentials. Redirects are limited to the
reviewed hosts, and the size limits come from the allowlist. Files are written
to a temp name and renamed only after verifying, so a partial or tampered
download never becomes a cache entry. Output: one JSON line per pin, then a
summary.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from khrdeps import (
    PinError,
    blob_pin,
    clean_git_env,
    deps_root,
    file_digest,
    git_pin,
    load_allowlist,
    mirror_path,
    npm_pin,
    pin_present,
    request_key,
)


def revalidate(entry: dict[str, Any], allow: dict[str, Any]) -> dict[str, str]:
    kind = entry.get("kind")
    if kind == "git":
        return git_pin(str(entry.get("url", "")), str(entry.get("ref", "")), allow)
    if kind == "npm":
        import base64

        return npm_pin(
            str(entry.get("url", "")),
            "sha512-"
            + base64.b64encode(bytes.fromhex(str(entry.get("sha512", "")))).decode(),
            allow,
        )
    if kind == "blob":
        pin = blob_pin(str(entry.get("url", "")), allow)
        if entry.get("sha256") and entry["sha256"] != pin["sha256"]:
            raise PinError("requested sha256 differs from the reviewed pin")
        return pin
    raise PinError("unknown pin kind")


class _Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self, hosts: set[str]):
        self.hosts = hosts

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urllib.parse.urlsplit(newurl)
        if (
            u.scheme != "https"
            or u.username
            or u.password
            or u.hostname not in self.hosts
        ):
            raise PinError("redirect to an unreviewed host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(
    url: str,
    dest: Path,
    algorithm: str,
    expected_hex: str,
    allow: dict[str, Any],
    opener=None,
) -> None:
    limit = int(allow["limits"]["downloadBytes"])
    opener = opener or urllib.request.build_opener(
        urllib.request.ProxyHandler(), _Redirects(set(allow["redirectHosts"]))
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=dest.parent, prefix=".part-")
    total, started = 0, time.monotonic()
    try:
        with (
            os.fdopen(fd, "wb") as out,
            opener.open(
                urllib.request.Request(
                    url, method="GET", headers={"User-Agent": "khr-deps/1"}
                ),
                timeout=60,
            ) as resp,
        ):
            while chunk := resp.read(1 << 20):
                total += len(chunk)
                if total > limit or time.monotonic() - started > 600:
                    raise PinError("download exceeded size or time limits")
                out.write(chunk)
        if file_digest(Path(tmp), algorithm) != expected_hex:
            raise PinError(f"{algorithm} mismatch")
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def fetch_git(root: Path, pin: dict[str, str], git_base: str) -> None:
    mirror = mirror_path(root, pin["repo"])
    env = clean_git_env()
    if not (mirror / "HEAD").exists():
        mirror.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "init", "-q", "--bare", str(mirror)], check=True, env=env
        )
        subprocess.run(
            [
                "git",
                "-C",
                str(mirror),
                "remote",
                "add",
                "origin",
                f"{git_base}/{pin['repo']}.git",
            ],
            check=True,
            env=env,
        )
        subprocess.run(
            [
                "git",
                "-C",
                str(mirror),
                "config",
                "remote.origin.pushurl",
                "no-push://disabled",
            ],
            check=True,
            env=env,
        )
    ref = pin["ref"]
    refspec = (
        f"{ref}:refs/khr/{ref}"
        if len(ref) in (40, 64) and all(c in "0123456789abcdef" for c in ref)
        else f"refs/tags/{ref}:refs/tags/{ref}"
    )
    r = subprocess.run(
        [
            "git",
            "-C",
            str(mirror),
            "fetch",
            "-q",
            "--no-tags",
            "--depth",
            "1",
            "origin",
            refspec,
        ],
        capture_output=True,
        text=True,
        env=env,
        check=False,
        timeout=900,
    )
    if r.returncode != 0:
        msg = (
            r.stderr.strip().splitlines()[-1]
            if r.stderr.strip()
            else f"exit {r.returncode}"
        )
        raise PinError(
            "unpublished-revision"
            if "not our ref" in msg or "couldn't find remote ref" in msg
            else f"git fetch failed: {msg[:160]}"
        )


def run(
    request: dict[str, Any],
    root: Path,
    allow: dict[str, Any],
    git_base: str = "https://github.com",
    opener=None,
) -> list[dict[str, Any]]:
    results = []
    for entry in request.get("pins", [])[
        : 4 * int(allow["limits"]["pinsPerRepository"])
    ]:
        try:
            pin = revalidate(entry, allow)
        except (PinError, ValueError) as exc:
            results.append(
                {"status": "refused", "reason": str(exc), "kind": entry.get("kind")}
            )
            continue
        key = request_key(pin)
        try:
            if pin_present(root, pin):
                results.append({"key": key, "status": "present"})
                continue
            if pin["kind"] == "git":
                fetch_git(root, pin, git_base)
            elif pin["kind"] == "npm":
                download(
                    pin["url"],
                    root / "npm" / f"{pin['sha512']}.tgz",
                    "sha512",
                    pin["sha512"],
                    allow,
                    opener,
                )
            else:
                download(
                    pin["url"],
                    root / "blobs" / pin["sha256"],
                    "sha256",
                    pin["sha256"],
                    allow,
                    opener,
                )
            ok = pin_present(root, pin)
            results.append(
                {
                    "key": key,
                    "status": "fetched" if ok else "failed",
                    **({} if ok else {"reason": "not verifiable after fetch"}),
                }
            )
        except (PinError, OSError, subprocess.SubprocessError, ValueError) as exc:
            results.append({"key": key, "status": "failed", "reason": str(exc)[:200]})
    index = root / "index.json"
    known = json.loads(index.read_text()) if index.exists() else {}
    known.update(
        {
            r["key"]: {
                "status": r["status"],
                "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            for r in results
            if "key" in r
        }
    )
    tmp = index.with_suffix(".tmp")
    tmp.write_text(json.dumps(known, indent=1, sort_keys=True) + "\n")
    os.replace(tmp, index)
    return results


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--request", required=True)
    ap.add_argument("--root", default=None)
    args = ap.parse_args(argv)
    root = Path(args.root) if args.root else deps_root()
    root.mkdir(parents=True, exist_ok=True)
    request = json.loads(Path(args.request).read_text(encoding="utf-8"))
    results = run(request, root, load_allowlist())
    for r in results:
        print(json.dumps(r, sort_keys=True))
    counts = {
        s: sum(1 for r in results if r["status"] == s)
        for s in ("present", "fetched", "failed", "refused")
    }
    print("KHR_DEPS_FETCH=" + json.dumps(counts, sort_keys=True))
    return 0 if counts["failed"] == 0 and counts["refused"] == 0 else 1


if __name__ == "__main__":
    shutil.which("git") or sys.exit("git is required")
    sys.exit(main())
