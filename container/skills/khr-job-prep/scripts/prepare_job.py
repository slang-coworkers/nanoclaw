"""Prepare a khr job: pin bases, create worktrees, write targets.json and trusted-instructions.json.

    python3 prepare_job.py --job /workspace/agent/jobs/<job> [--manifest PATH]

Inputs: ``request.json`` in the job root (written by the replay injector or the
host), and the install's repository manifest (default
``/workspace/agent/khr-manifest.json``, install-local, never committed)::

    {"schema": 1, "gitlabUrl": "https://<host>",
     "identity": {"name": "<commit name>", "email": "<commit email>"},
     "cacheRoot": "/workspace/agent/khr-cache",
     "repositories": [{"name": "vulkan-docs", "projectPath": "<group>/<project>",
                       "targetBranch": "newer-of-main-master"}],
     "jobRepositories": {"<project id>": ["vulkan-docs", "..."]}}

Rules (parity with the source harness):

- Target branch: an explicit branch name, or ``newer-of-main-master``: of the
  existing ``main``/``master`` the descendant wins, else the newer committer
  date, ties go to ``main``.
- Base: replay jobs pin the target as it was when the request was posted (the
  last first-parent commit before the note's timestamp); live jobs pin its tip.
- Issue follow-ups continue the issue's change set: each repository already in
  it starts from the head the previous job left.
- An MR request continues only an MR this install would have created (recorded
  in the local journal). Any other MR fails explicitly rather than silently
  falling back to the target branch.
- Pushing is disabled in every cache repository. Worktrees share the commit identity
  from the manifest.
- Trusted instructions are read from the pinned base objects, never the work tree.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from khrjob import (
    MAX_INSTRUCTIONS_BYTES,
    JobError,
    change_set_key,
    git,
    git_bytes,
    now_iso,
    read_journal,
    read_json,
    sha256,
    write_json,
)
from khrjob import git_env as khrjob_git_env

DEFAULT_MANIFEST = "/workspace/agent/khr-manifest.json"
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _clone_url(manifest: dict[str, Any], repo: dict[str, Any]) -> str:
    if repo.get("cloneUrl"):
        return str(repo["cloneUrl"])
    return f"{manifest['gitlabUrl'].rstrip('/')}/{repo['projectPath']}.git"


def ensure_cache(manifest: dict[str, Any], repo: dict[str, Any]) -> Path:
    cache = Path(manifest.get("cacheRoot", "/workspace/agent/khr-cache")) / repo["name"]
    if not (cache / "HEAD").exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        git(
            cache.parent,
            "clone",
            "--bare",
            "--quiet",
            _clone_url(manifest, repo),
            str(cache),
        )
    git(cache, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*")
    git(cache, "fetch", "--quiet", "--prune", "origin")
    # Pushing is impossible from here: unsupported push scheme, nothing pushed by default.
    git(cache, "config", "remote.origin.pushurl", "no-push://disabled")
    git(cache, "config", "push.default", "nothing")
    ident = manifest["identity"]
    git(cache, "config", "user.name", ident["name"])
    git(cache, "config", "user.email", ident["email"])
    return cache


def select_target_branch(cache: Path, policy: str) -> str:
    if policy != "newer-of-main-master":
        if not git(
            cache,
            "rev-parse",
            "--verify",
            "--quiet",
            f"refs/remotes/origin/{policy}",
            check=False,
        ):
            raise JobError(f"target branch {policy} does not exist")
        return policy
    present = [
        b
        for b in ("main", "master")
        if git(
            cache,
            "rev-parse",
            "--verify",
            "--quiet",
            f"refs/remotes/origin/{b}",
            check=False,
        )
    ]
    if not present:
        raise JobError("neither main nor master exists")
    if len(present) == 1:
        return present[0]
    main, master = (f"refs/remotes/origin/{b}" for b in ("main", "master"))
    if _is_ancestor(cache, master, main):
        return "main"
    if _is_ancestor(cache, main, master):
        return "master"
    t_main = int(git(cache, "log", "-1", "--format=%ct", main))
    t_master = int(git(cache, "log", "-1", "--format=%ct", master))
    return "master" if t_master > t_main else "main"


def _is_ancestor(repo: Path, a: str, b: str) -> bool:
    return (
        subprocess.run(
            ["git", "-C", str(repo), "merge-base", "--is-ancestor", a, b],
            env=khrjob_git_env(),
            check=False,
        ).returncode
        == 0
    )


def pin_base(cache: Path, branch: str, request: dict[str, Any]) -> str:
    ref = f"refs/remotes/origin/{branch}"
    if request.get("mode") == "replay-dry-run" and request.get("note_created_at"):
        sha = git(
            cache,
            "rev-list",
            "-1",
            "--first-parent",
            f"--before={request['note_created_at']}",
            ref,
        )
        if not sha:
            raise JobError(
                f"{branch} has no commit before {request['note_created_at']}"
            )
        return sha
    return git(cache, "rev-parse", ref)


def trusted_instructions(
    cache: Path, base: str, repo_name: str, worktree: Path
) -> list[dict[str, Any]]:
    entries, total = [], 0
    listing = git(cache, "ls-tree", "-r", "-z", base)
    for item in listing.split("\0"):
        if not item:
            continue
        meta, path = item.split("\t", 1)
        if Path(path).name not in {"AGENTS.md", "AGENTS.override.md"}:
            continue
        mode, kind, blob = meta.split()
        if kind != "blob" or mode not in {"100644", "100755"}:
            raise JobError(f"trusted instruction {path} is not a regular file")
        content = git_bytes(cache, "cat-file", "blob", blob)
        total += len(content)
        if total > MAX_INSTRUCTIONS_BYTES:
            raise JobError("trusted instructions exceed 1 MiB")
        entries.append(
            {
                "repository": repo_name,
                "worktree": str(worktree),
                "targetCommit": base,
                "path": path,
                "sha256": sha256(content),
                "instructions": content.decode("utf-8"),
            }
        )
    return entries


def prior_heads(job_root: Path, request: dict[str, Any]) -> dict[str, str]:
    """Heads left by earlier jobs of the same change set, per repository name."""
    key = change_set_key(request)
    if request["kind"] == "mr":
        owned = [
            e
            for e in read_journal(job_root)
            if e.get("wouldBeMr")
            == {"projectId": request["project_id"], "iid": request["iid"]}
        ]
        if not owned:
            raise JobError(
                f"MR !{request['iid']} is not a Draft MR this install owns; MR follow-ups continue only owned MRs"
            )
        key = owned[-1]["changeSet"]
    heads: dict[str, str] = {}
    for entry in read_journal(job_root):
        if entry.get("changeSet") == key:
            heads.update(
                {name: r["head"] for name, r in entry.get("repositories", {}).items()}
            )
    return heads


def prepare(job_root: Path, manifest_path: Path) -> dict[str, Any]:
    request = read_json(job_root / "request.json")
    manifest = read_json(manifest_path)
    if manifest.get("schema") != 1:
        raise JobError("unsupported manifest schema")
    if (job_root / "targets.json").exists():
        raise JobError("job already prepared (targets.json exists)")
    in_scope = manifest.get("jobRepositories", {}).get(str(request["project_id"]))
    repos = [
        r for r in manifest["repositories"] if in_scope is None or r["name"] in in_scope
    ]
    if not repos:
        raise JobError(
            f"no repositories configured for project {request['project_id']}"
        )
    previous = prior_heads(job_root, request)
    job = job_root.name
    targets, instructions = [], []
    (job_root / "repos").mkdir(exist_ok=True)
    for repo in repos:
        cache = ensure_cache(manifest, repo)
        branch = select_target_branch(
            cache, repo.get("targetBranch", "newer-of-main-master")
        )
        continued = repo["name"] in previous
        base = previous[repo["name"]] if continued else pin_base(cache, branch, request)
        worktree = job_root / "repos" / repo["name"]
        topic = f"khr/{_SAFE.sub('-', job)}/{_SAFE.sub('-', repo['name'])}"
        git(cache, "worktree", "add", "--quiet", "-b", topic, str(worktree), base)
        targets.append(
            {
                "name": repo["name"],
                "projectPath": repo["projectPath"],
                "path": str(worktree),
                "targetBranch": branch,
                "base": base,
                "topicBranch": topic,
                "continuesChangeSet": continued,
            }
        )
        instructions.extend(trusted_instructions(cache, base, repo["name"], worktree))
    write_json(
        job_root / "targets.json",
        {
            "job": job,
            "preparedAt": now_iso(),
            "identity": manifest["identity"],
            "repositories": targets,
        },
        0o444,
    )
    write_json(
        job_root / "trusted-instructions.json",
        {
            "provenance": "pinned target revision (never the topic branch)",
            "repositories": instructions,
        },
        0o444,
    )
    for name in (
        "request.json",
        "reference-context.md",
        "issue-discussions.json",
        "mr-discussions.json",
    ):
        if (job_root / name).exists():
            (job_root / name).chmod(0o444)
    inv = inventory(job_root, manifest)
    return {
        "job": job,
        "repositories": [t["name"] for t in targets],
        "dependencies": inv["summary"],
    }


def _deps_modules():
    """The shared pin model lives in the khr-deps skill next to this one (read-only mount)."""
    deps_scripts = Path(__file__).resolve().parents[2] / "khr-deps" / "scripts"
    if str(deps_scripts) not in sys.path:
        sys.path.insert(0, str(deps_scripts))
    import khrdeps
    import pins

    return khrdeps, pins


def inventory(job_root: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    """Write dependency-inventory.json (and pin-request.json when pins are missing).

    Pins come from each repository's declaration at its pinned base. Each reviewed
    pin is re-verified against the shared cache from its bytes; ``ready`` means
    every reviewed pin is present, never that anything was configured, built or
    tested.
    """
    khrdeps, pins = _deps_modules()
    allow = khrdeps.load_allowlist()
    root = khrdeps.deps_root()
    targets = read_json(job_root / "targets.json")["repositories"]
    by_name = {r["name"]: r for r in manifest["repositories"]}
    cache_root = Path(manifest.get("cacheRoot", "/workspace/agent/khr-cache"))
    repos_out, missing, seen = [], [], set()
    for t in targets:
        profile = by_name.get(t["name"], {}).get("dependencies")
        try:
            got = pins.extract(profile, cache_root / t["name"], t["base"], allow)
        except (khrdeps.PinError, ValueError) as exc:
            repos_out.append(
                {
                    "name": t["name"],
                    "status": "infrastructure_error",
                    "reason": str(exc),
                }
            )
            continue
        entries = []
        for p in got["pins"]:
            if p["kind"] == "unavailable":
                entries.append(p)
                continue
            present = khrdeps.pin_present(root, p)
            entries.append({**p, "present": present})
            key = khrdeps.request_key(p)
            if not present and key not in seen:
                seen.add(key)
                missing.append(
                    {
                        k: p[k]
                        for k in ("kind", "url", "ref", "sha512", "sha256")
                        if k in p
                    }
                )
        reviewed = [e for e in entries if e["kind"] != "unavailable"]
        if got["profile"] == "toolchain-only":
            status = "toolchain-only"
        elif any(not e["present"] for e in reviewed):
            status = "missing"
        else:
            status = "ready"
        repos_out.append(
            {
                "name": t["name"],
                "profile": got["profile"],
                "declaration": got.get("declaration"),
                "declarationSha256": got.get("declarationSha256"),
                "status": status,
                "unavailable": sum(1 for e in entries if e["kind"] == "unavailable"),
                "pins": entries,
            }
        )
    summary = {
        s: sum(1 for r in repos_out if r["status"] == s)
        for s in ("ready", "missing", "toolchain-only", "infrastructure_error")
    }
    write_json(
        job_root / "dependency-inventory.json",
        {
            "generatedAt": now_iso(),
            "cacheRoot": str(root),
            "summary": summary,
            "repositories": repos_out,
        },
        0o444 if not missing else 0o644,
    )
    req = job_root / "pin-request.json"
    if missing:
        write_json(req, {"job": job_root.name, "pins": missing})
    elif req.exists():
        req.unlink()
    return {"summary": summary, "missing": len(missing)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--job", required=True)
    ap.add_argument("--manifest", default=DEFAULT_MANIFEST)
    ap.add_argument(
        "--inventory-only",
        action="store_true",
        help="recompute dependency-inventory.json after the cache changed",
    )
    args = ap.parse_args(argv)
    try:
        if args.inventory_only:
            job = Path(args.job).resolve()
            if (job / "dependency-inventory.json").exists():
                (job / "dependency-inventory.json").chmod(0o644)
            result = inventory(job, read_json(Path(args.manifest)))
        else:
            result = prepare(Path(args.job).resolve(), Path(args.manifest))
    except JobError as exc:
        print(f"KHR_PREPARE_FAILED: {exc}")
        return 2
    print(f"KHR_PREPARED: {result}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
