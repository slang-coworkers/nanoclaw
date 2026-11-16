#!/usr/bin/env python3
"""worktree-gc-discover.py — the facts worktree-gc.py classifies.

worktree-gc-run.sh runs this inside a tier's container and pipes the JSON it
prints into worktree-gc.py. It reports facts only: what each per-task checkout
is, when the agent last used it, whether something holds it, and what depends
on it. Every decision and every threshold lives in worktree-gc.py.

It discovers four sets under the group directory (`/workspace/agent` in a
container, `--agent` in tests):

  checkouts  every git worktree registered with a base clone
             (`<agent>/{slang,slangpy,slang-rhi}`), whatever its name, plus
             every top-level `wt-*` directory, the naming convention for
             per-task checkouts, whatever its git shape:
               worktree  a linked worktree whose administrative directory
                         exists (owner = the repository that registered it)
               clone     a standalone clone: `.git` is a directory
               orphan    a `.git` file whose administrative directory is gone,
                         so git no longer knows the tree
               plain     no `.git` at all
  runs       every entry of `<agent>/runs/`, where review runners and the
             agent keep run output
  trash      what the executor already moved into `.worktree-gc/trash/` and
             still has to delete

Before it lists anything it repairs worktrees that were moved by hand. Consider
an agent that runs `git worktree add wt-tmp-13546` and then
`mv wt-tmp-13546 wt-13546-verify`: the administrative directory still points
at the old path, so the next `git worktree prune` deletes it and leaves the
tree orphaned. `git worktree repair <new path>` rewrites that pointer first.

Run: python3 worktree-gc-discover.py --agent /workspace/agent
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time

BASES = ("slang", "slangpy", "slang-rhi")
BASE_REPOS = {"slang": "shader-slang/slang", "slangpy": "shader-slang/slangpy", "slang-rhi": "shader-slang/slang-rhi"}

# A primary tree is a tier's fix checkout (wt-slang-<n>, wt-slangpy-<n>,
# wt-slang-rhi-<n>, wt-<repo>-pr-<n>, wt-<n>); every other name is scratch.
PRIMARY_NAME = re.compile(r"^wt-(slang|slangpy|slang-rhi)-(pr-)?[0-9]+$|^wt-[0-9]+$")
NUMBER_IN_NAME = re.compile(r"(?:^|[^0-9])([0-9]{4,})")
GITHUB_SLUG = re.compile(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?$")

# The boot refresh in container/agent-runner/src/refresh-clones.ts runs exactly
# `git pull --ff-only --quiet` in every clone it finds, and git records that
# command line as the reflog message. Those entries are maintenance, not use.
BOOT_REFRESH_REFLOG = "pull --ff-only --quiet"

DAY_S = 86400.0
ACTIVE_WORK_FRESH_S = DAY_S
RUN_ENTRY_SCAN_DEPTH = 2
RUN_ENTRY_SCAN_LIMIT = 500


def git(args: list[str], cwd: str, timeout: float = 20) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True, timeout=timeout, check=False)


def mtime(path: str) -> float:
    try:
        return os.lstat(path).st_mtime
    except OSError:
        return 0.0


def real(path: str) -> str:
    return os.path.realpath(path)


def read_gitfile(checkout: str) -> str | None:
    """Return the absolute `gitdir:` target of `<checkout>/.git` when it is a
    file, else None."""
    try:
        with open(os.path.join(checkout, ".git")) as f:
            for line in f:
                if line.startswith("gitdir:"):
                    target = line[len("gitdir:"):].strip()
                    return os.path.normpath(os.path.join(checkout, target))
    except OSError:
        pass
    return None


def owner_of_admin_dir(admin: str) -> str | None:
    """Return the repository working directory that owns the linked-worktree
    administrative directory `admin` (`<repo>/.git/worktrees/<id>`), or None
    when `admin` has some other shape."""
    parts = admin.rstrip("/").split("/")
    if len(parts) >= 3 and parts[-2] == "worktrees" and parts[-3] == ".git":
        return "/".join(parts[:-3]) or "/"
    return None


def admin_target(admin: str) -> str:
    """The `.git` file path an administrative directory records for its tree."""
    try:
        with open(os.path.join(admin, "gitdir")) as f:
            return os.path.normpath(os.path.join(admin, f.read().strip()))
    except OSError:
        return ""


def repair_moved_worktrees(agent: str) -> list[str]:
    """Run `git worktree repair` for every top-level directory whose `.git`
    file names an existing administrative directory that records a path which
    no longer exists, so the prune that follows cannot orphan a renamed
    worktree. A recorded path that still exists means this directory is a copy
    of another worktree; repairing would steal that worktree's record, so the
    copy is left for discovery to report as an orphan."""
    repaired = []
    for name in sorted(os.listdir(agent)):
        path = os.path.join(agent, name)
        if not os.path.isdir(path) or os.path.islink(path):
            continue
        admin = read_gitfile(path)
        if not admin or not os.path.isdir(admin):
            continue
        owner = owner_of_admin_dir(admin)
        recorded = admin_target(admin)
        if not owner or not recorded or os.path.exists(recorded):
            continue
        if git(["worktree", "repair", path], owner).returncode == 0:
            repaired.append(name)
    return repaired


def registered_worktrees(base_dir: str) -> list[dict]:
    """Parse `git worktree list --porcelain` of one base, main tree excluded."""
    out = git(["worktree", "list", "--porcelain"], base_dir).stdout
    trees, cur = [], {}
    for line in out.splitlines() + [""]:
        if not line:
            if cur.get("path") and real(cur["path"]) != real(base_dir):
                trees.append(cur)
            cur = {}
        elif line.startswith("worktree "):
            cur["path"] = line[len("worktree "):]
        elif line.startswith("branch "):
            cur["branch"] = line[len("branch "):].removeprefix("refs/heads/")
        elif line.startswith("locked"):
            cur["locked"] = True
    return trees


def processes_holding(agent: str) -> set[str]:
    """Return the names of top-level entries of `agent` (and of `agent/runs`,
    as `runs/<entry>`) that a visible process uses as its working directory or
    holds open. Only this container's processes are visible; sessions in other
    containers are covered by the idle thresholds instead."""
    held: set[str] = set()
    prefix = real(agent) + "/"
    runs_prefix = prefix + "runs/"
    me = os.getpid()
    try:
        pids = [p for p in os.listdir("/proc") if p.isdigit() and int(p) != me]
    except OSError:
        return held
    for pid in pids:
        links = [f"/proc/{pid}/cwd"]
        try:
            links += [f"/proc/{pid}/fd/{fd}" for fd in os.listdir(f"/proc/{pid}/fd")]
        except OSError:
            pass
        for link in links:
            try:
                target = os.readlink(link)
            except OSError:
                continue
            if target.startswith(runs_prefix):
                held.add("runs/" + target[len(runs_prefix):].split("/", 1)[0])
            elif target.startswith(prefix):
                held.add(target[len(prefix):].split("/", 1)[0])
    return held


def build_markers(path: str) -> float:
    """Newest `.ninja_log` / `CMakeCache.txt` of any top-level `build*` dir."""
    newest = 0.0
    try:
        entries = [e for e in os.listdir(path) if e.startswith("build")]
    except OSError:
        return newest
    for e in entries:
        for f in (".ninja_log", "CMakeCache.txt"):
            newest = max(newest, mtime(os.path.join(path, e, f)))
    return newest


def last_agent_reflog(git_dir: str) -> float:
    """Timestamp of the newest HEAD reflog entry not written by the boot refresh."""
    newest = 0.0
    try:
        with open(os.path.join(git_dir, "logs", "HEAD"), errors="replace") as f:
            for line in f:
                meta, _, message = line.rstrip("\n").partition("\t")
                if message.startswith(BOOT_REFRESH_REFLOG):
                    continue
                fields = meta.split()
                if len(fields) >= 2 and fields[-2].isdigit():
                    newest = max(newest, float(fields[-2]))
    except OSError:
        pass
    return newest


def last_use(shape: str, path: str, admin: str | None) -> float:
    """When the agent last used a checkout, by shape.

    A linked worktree is touched only by the agent, so its directory, `.git`
    file and per-worktree index/HEAD/reflog all count. A standalone clone is
    also fast-forwarded by the boot refresh, which rewrites its working files,
    index and FETCH_HEAD; so only signals the refresh never writes count there:
    HEAD reflog entries other than the refresh's own, the `.git/HEAD` file, and
    build logs. An orphan has nothing but its files."""
    marks = [build_markers(path)]
    if shape == "worktree":
        marks += [mtime(path), mtime(os.path.join(path, ".git"))]
        if admin:
            marks += [mtime(os.path.join(admin, f)) for f in ("index", "HEAD", os.path.join("logs", "HEAD"))]
    elif shape == "clone":
        git_dir = os.path.join(path, ".git")
        marks += [last_agent_reflog(git_dir), mtime(os.path.join(git_dir, "HEAD"))]
    else:
        marks += [mtime(path), mtime(os.path.join(path, ".git"))]
    return max(marks)


def repo_slug(repo_dir: str, agent: str) -> str:
    """GitHub `owner/name` a checkout belongs to: a base by location, else its
    origin URL when that names GitHub or a base clone; "" when unknown."""
    if os.path.dirname(real(repo_dir)) == real(agent) and os.path.basename(repo_dir) in BASES:
        return BASE_REPOS[os.path.basename(repo_dir)]
    url = git(["config", "--get", "remote.origin.url"], repo_dir).stdout.strip()
    m = GITHUB_SLUG.search(url)
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    if url and os.path.dirname(real(url)) == real(agent) and os.path.basename(url.rstrip("/")) in BASES:
        return BASE_REPOS[os.path.basename(url.rstrip("/"))]
    return ""


def alternates_of(git_dir: str) -> list[str]:
    try:
        with open(os.path.join(git_dir, "objects", "info", "alternates")) as f:
            return [real(os.path.join(git_dir, "objects", line.strip())) for line in f if line.strip()]
    except OSError:
        return []


def live_worktrees_of(clone: str) -> list[str]:
    """Paths of existing linked worktrees registered inside a standalone clone."""
    admin_root = os.path.join(clone, ".git", "worktrees")
    out = []
    try:
        ids = os.listdir(admin_root)
    except OSError:
        return out
    for wid in ids:
        try:
            with open(os.path.join(admin_root, wid, "gitdir")) as f:
                tree = os.path.dirname(f.read().strip())
        except OSError:
            continue
        if os.path.isdir(tree):
            out.append(tree)
    return out


def checkout_record(agent: str, path: str, shape: str, owner: str | None, admin: str | None,
                    branch: str, locked: bool, held: set[str], now: float) -> dict:
    name = os.path.basename(path)
    m = NUMBER_IN_NAME.search(name)
    base = os.path.basename(owner) if owner and os.path.dirname(real(owner)) == real(agent) else ""
    base = base if base in BASES else ""
    slug = name.removeprefix("wt-")
    active = os.path.join(agent, "active-work", slug)
    running_why = []
    if locked:
        running_why.append("worktree locked")
    if os.path.isdir(active) and now - mtime(active) < ACTIVE_WORK_FRESH_S:
        running_why.append("active-work sentinel")
    if name in held:
        running_why.append("process cwd or open file")
    repo_dir = path if shape == "clone" else owner
    return {
        "dir": name,
        "path": path,
        "shape": shape,
        "owner": owner or "",
        "owner_exists": bool(owner) and os.path.isdir(os.path.join(owner, ".git")),
        "base": base,
        "repo": repo_slug(repo_dir, agent) if repo_dir and os.path.isdir(repo_dir) else "",
        "number": m.group(1) if m else "",
        "kind": "primary" if PRIMARY_NAME.match(name) else "scratch",
        "idle_days": round((now - last_use(shape, path, admin)) / DAY_S, 2),
        "has_build": os.path.isdir(os.path.join(path, "build")),
        "running": bool(running_why),
        "running_why": running_why,
        "branch": branch,
        "dependents": [],
    }


def run_entry_last_use(path: str) -> float:
    """Newest mtime of a `runs/` entry and its descendants down to
    RUN_ENTRY_SCAN_DEPTH levels, bounded to RUN_ENTRY_SCAN_LIMIT entries."""
    newest, seen, frontier = mtime(path), 0, [(path, 0)]
    while frontier and seen < RUN_ENTRY_SCAN_LIMIT:
        d, depth = frontier.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    seen += 1
                    try:
                        newest = max(newest, e.stat(follow_symlinks=False).st_mtime)
                        if depth + 1 < RUN_ENTRY_SCAN_DEPTH and e.is_dir(follow_symlinks=False):
                            frontier.append((e.path, depth + 1))
                    except OSError:
                        pass
                    if seen >= RUN_ENTRY_SCAN_LIMIT:
                        break
        except OSError:
            pass
    return newest


def discover(agent: str, state_dir: str, now: float) -> dict:
    agent = os.path.abspath(agent)
    repaired = repair_moved_worktrees(agent)
    held = processes_holding(agent)

    checkouts: dict[str, dict] = {}
    for base in BASES:
        base_dir = os.path.join(agent, base)
        if not os.path.isdir(os.path.join(base_dir, ".git")):
            continue
        git(["worktree", "prune"], base_dir)
        for t in registered_worktrees(base_dir):
            p = os.path.normpath(t["path"])
            if not p.startswith(agent + "/") or not os.path.isdir(p):
                continue
            checkouts[real(p)] = checkout_record(
                agent, p, "worktree", base_dir, read_gitfile(p), t.get("branch", ""),
                bool(t.get("locked")), held, now)

    for name in sorted(os.listdir(agent)):
        p = os.path.join(agent, name)
        if not name.startswith("wt-") or os.path.islink(p) or not os.path.isdir(p) or real(p) in checkouts:
            continue
        git_path = os.path.join(p, ".git")
        if os.path.isdir(git_path):
            branch = git(["symbolic-ref", "-q", "--short", "HEAD"], p).stdout.strip()
            checkouts[real(p)] = checkout_record(agent, p, "clone", p, None, branch, False, held, now)
            continue
        admin = read_gitfile(p)
        owner = owner_of_admin_dir(admin) if admin else None
        if admin and owner and os.path.isdir(admin) and real(admin_target(admin)) == real(os.path.join(p, ".git")):
            branch = git(["symbolic-ref", "-q", "--short", "HEAD"], p).stdout.strip()
            locked = os.path.exists(os.path.join(admin, "locked"))
            checkouts[real(p)] = checkout_record(agent, p, "worktree", owner, admin, branch, locked, held, now)
        elif admin:
            checkouts[real(p)] = checkout_record(agent, p, "orphan", owner, None, "", False, held, now)
        else:
            checkouts[real(p)] = checkout_record(agent, p, "plain", None, None, "", False, held, now)

    runs_dir = os.path.join(agent, "runs")
    runs: dict[str, dict] = {}
    try:
        run_names = sorted(os.listdir(runs_dir))
    except OSError:
        run_names = []
    for name in run_names:
        p = os.path.join(runs_dir, name)
        runs[real(p)] = {
            "name": name,
            "path": p,
            "idle_days": round((now - run_entry_last_use(p)) / DAY_S, 2),
            "running": f"runs/{name}" in held,
            "dependents": [],
        }

    # A checkout or run entry that another checkout borrows objects from
    # (`git clone --shared` writes objects/info/alternates) or that owns a live
    # linked worktree cannot go first: removing it corrupts the dependent.
    by_path = {**checkouts, **runs}

    def holder_of(target: str) -> dict | None:
        for root, rec in by_path.items():
            if target == root or target.startswith(root + "/"):
                return rec
        return None

    for rec in list(checkouts.values()):
        if rec["shape"] != "clone":
            continue
        for alt in alternates_of(os.path.join(rec["path"], ".git")):
            holder = holder_of(alt)
            if holder is not None and holder is not rec:
                holder["dependents"].append(rec["dir"])
        rec["dependents"].extend(os.path.basename(t) for t in live_worktrees_of(rec["path"]))

    trash_dir = os.path.join(state_dir, "trash")
    try:
        trash = sorted(os.listdir(trash_dir))
    except OSError:
        trash = []

    return {
        "agent": agent,
        "repaired": repaired,
        "worktrees": list(checkouts.values()),
        "runs": list(runs.values()),
        "trash": trash,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--agent", default="/workspace/agent")
    ap.add_argument("--state-dir", default=None)
    args = ap.parse_args()
    state_dir = args.state_dir or os.path.join(args.agent, ".worktree-gc")
    json.dump(discover(args.agent, state_dir, time.time()), sys.stdout)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
