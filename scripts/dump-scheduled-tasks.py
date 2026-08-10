#!/usr/bin/env python3
"""dump-scheduled-tasks — export live scheduled-task DEFINITIONS to a git-trackable file.

Scheduled tasks live only in per-session `inbound.db` rows. Nothing else in the repo
records them, and there is no export/import path. That means an agent's standing
instructions — the ones that decide what a recurring job optimizes for — are a single
SQLite row with no backup and no review trail. Restore an older DB, or recreate a task,
and the current behaviour silently reverts with nothing in git to notice.

Concretely: the learnings-wiki fold's objective was rewritten on 2026-08-04 to stop the
wiki growing without bound. That rewrite exists only in `inbound.db`. Losing it would
undo the fix while every source file still looked correct.

This dumps definitions only. Volatile runtime fields (row_id, process_after, tries,
completed_runs, failed_runs, recent_log, status) are excluded ON PURPOSE so the output
changes when a task's DEFINITION changes and stays byte-identical otherwise — that makes
`git diff` a drift alarm rather than daily noise.

  python3 scripts/dump-scheduled-tasks.py [--repo <path>] [--out <file>] [--md <file>]

ALL-OR-NOTHING. The snapshot is only useful as a drift alarm if a shorter file means
"a task was deleted" and nothing else. A transient `ncl` or SQLite failure on ONE task
must therefore never produce a smaller snapshot: if any listed series cannot be read,
this exits non-zero and leaves the previous snapshot untouched. Partial output would
land in git as an intentional deletion — the exact silent revert this guards against.

A SUCCESSFUL EMPTY READ IS A REAL STATE. Deleting every scheduled task is a thing an
operator can legitimately do, and when they do, the snapshot has to say so. This used to
exit 2 on an empty list — the same code as "the host is down" — so the committed snapshot
went on claiming the deleted tasks still existed, which is the stale-authority problem
the tool exists to prevent, pointed the other way. An empty result now writes
`{complete: true, listed_count: 0, task_count: 0, tasks: []}`; only a FAILED list exits 2.
Going from a non-empty snapshot to an empty one prints a loud warning, because it is
worth a human glance — but a warning, not a lie about the exit code.

PUBLICATION IS ALL-OR-NOTHING, AND SAYS SO HONESTLY. Writes are staged to sibling temp
files, re-parsed and fsynced, and only then renamed into place. The renames themselves
are sequential — POSIX has no multi-file rename — so the JSON could land and the Markdown
not, leaving the pair inconsistent while the error path claimed "Nothing was replaced".
Two mechanisms, because they cover different failures:

  - ROLLBACK JOURNAL. Every existing target is hard-linked aside before the first rename.
    If any rename fails, the originals are put back and the message names exactly what
    was replaced and what was restored. Covers errors.
  - SHARED `snapshot_id`. The JSON carries a content hash of itself and the Markdown
    embeds the same id, so a torn pair is DETECTABLE by anyone reading them —
    `--check` does exactly that, and exits non-zero. Covers a crash or SIGKILL between
    the two renames, where no in-process rollback can run at all.

A versioned output DIRECTORY swapped atomically would avoid the sequencing entirely, and
was rejected: `docs/scheduled-tasks.<slug>.json` is a committed path that
`scripts/kb-doctor.py` globs and `container/skills/learnings-wiki/SKILL.md` cites by
name, and moving it would break both consumers and the `git diff` drift alarm that is the
whole point of the artifact.

Restore is deliberately manual: read the JSON, then `ncl tasks update --id <series>
--prompt "<prompt>"` (or `ncl tasks create` if the series is gone). Auto-apply is not
provided — silently rewriting live agent instructions is exactly the failure mode this
guards against.

Exit codes:
  0  complete snapshot written (or --check found the published pair consistent)
  1  one or more listed tasks could not be read — nothing written
  2  could not list tasks at all (host down? bin/ncl missing?) — nothing written
  3  staged output failed validation or could not be committed — previous snapshot restored
  4  --check found the published pair torn or inconsistent
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile

# Runtime state, not definition. Excluded so the dump is stable across runs.
VOLATILE = {"row_id", "process_after", "tries", "completed_runs", "failed_runs",
            "recent_log", "status", "created_at", "origin_session_id", "id", "ok"}


def ncl(repo, *args):
    """Run `bin/ncl <args>`. Returns (ok, parsed). `ok` is False when the CLI itself
    failed — callers must not confuse that with a successful empty result."""
    try:
        r = subprocess.run([os.path.join(repo, "bin", "ncl"), *args],
                           cwd=repo, capture_output=True, text=True, check=False)
    except OSError as e:
        return False, str(e)
    if r.returncode != 0:
        return False, (r.stderr or r.stdout or "").strip()
    try:
        return True, json.loads(r.stdout)
    except json.JSONDecodeError:
        return True, r.stdout


def series_ids(repo):
    """`ncl tasks list` has no stable --json contract across versions; parse the table.
    Returns (ok, ids) so a failed list is distinguishable from an empty one."""
    ok, out = ncl(repo, "tasks", "list")
    if not ok:
        return False, out
    if isinstance(out, dict):
        rows = out.get("data") or []
        return True, [r.get("series_id") for r in rows if r.get("series_id")]
    ids = []
    for line in (out or "").splitlines()[1:]:
        tok = line.split()
        if tok and (tok[0].startswith("task-") or "-" in tok[0]):
            ids.append(tok[0])
    return True, ids


def snapshot_id(payload):
    """Content hash of the snapshot, excluding the hash field itself.

    Deterministic and timestamp-free, so a run that changes nothing produces the same
    id and `git diff` stays a drift alarm. Both artifacts carry it, which is what makes
    a torn publish — JSON replaced, Markdown not — detectable after the fact by a
    reader, including after a crash that ran no rollback."""
    body = {k: v for k, v in payload.items() if k != "snapshot_id"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


SNAPSHOT_ID_RE = r"^Snapshot id: `([0-9a-f]{64})`"


def read_published_id(md_path):
    """The snapshot id embedded in a rendered Markdown mirror, or None."""
    import re

    try:
        with open(md_path) as f:
            for line in f:
                m = re.match(SNAPSHOT_ID_RE, line)
                if m:
                    return m.group(1)
    except OSError:
        return None
    return None


def check_published(out, md):
    """Verify the published pair agrees with itself. Returns (ok, problems)."""
    problems = []
    try:
        with open(out) as f:
            payload = json.load(f)
    except (OSError, ValueError) as e:
        return False, [f"{out}: unreadable or not JSON ({e})"]

    stored = payload.get("snapshot_id")
    recomputed = snapshot_id(payload)
    if not stored:
        problems.append(f"{out}: no snapshot_id (written by a version before this check existed)")
    elif stored != recomputed:
        problems.append(f"{out}: snapshot_id {stored[:12]}… does not match its own contents ({recomputed[:12]}…)")

    if md:
        published = read_published_id(md)
        if published is None:
            problems.append(f"{md}: no snapshot id line — cannot be matched against the JSON")
        elif stored and published != stored:
            problems.append(
                f"TORN PUBLISH: {out} is snapshot {stored[:12]}… but {md} is {published[:12]}… — "
                "the two were written by different runs, so one of them is stale"
            )
    return not problems, problems


def render_md(slug, tasks, sid):
    """Human-readable mirror of the JSON. Every emitted line is right-stripped: prompts
    routinely carry trailing spaces, and committing them makes the snapshot fail
    whitespace lint and produces diff noise unrelated to a definition change. The JSON
    stays byte-exact — it, not this, is the restore source."""
    L = [f"# Scheduled tasks — `{slug}`", "",
         "Generated by `scripts/dump-scheduled-tasks.py`. Definitions only — runtime",
         "state is excluded so a diff here means a task's instructions changed.", "",
         f"Snapshot id: `{sid}`",
         "",
         "That id must equal `snapshot_id` in the JSON beside this file. If it does not,",
         "the two were published by different runs and one of them is stale — run",
         "`scripts/dump-scheduled-tasks.py --check` to confirm, then re-dump.", "",
         f"{len(tasks)} task(s), complete — the generator exits non-zero rather than",
         "writing a partial snapshot, so a shorter file here means a task was deleted.", ""]
    for t in tasks:
        L += [f"## `{t.get('series_id')}`", "",
              f"- schedule: `{t.get('recurrence') or 'one-shot'}`",
              f"- agent group: `{t.get('agent_group_id')}`", ""]
        if t.get("script"):
            L += ["Pre-task gate:", "", "```bash", str(t["script"]).strip(), "```", ""]
        L += ["Prompt:", "", "```", str(t.get("prompt", "")).strip(), "```", ""]
    # Right-strip every line, then drop the trailing blank line the per-task
    # block structure leaves behind (each block ends with ""). `"\n".join(L)`
    # already terminates the last real line, so the extra "\n" this used to
    # append produced a blank line at EOF — which `git diff --check` reports as
    # an error, and which is how the committed snapshot landed flagged.
    lines = [line.rstrip() for line in "\n".join(L).splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    return "".join(line + "\n" for line in lines)


def stage(dest, text):
    """Write `text` to a sibling temp file and fsync it. The rename is deferred so a
    multi-file dump commits all-or-nothing. Returns the temp path."""
    d = os.path.dirname(dest) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=f".{os.path.basename(dest)}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
    except BaseException:
        os.unlink(tmp)
        raise
    return tmp


class CommitError(Exception):
    """A publication that did not complete, carrying what actually happened on disk.

    The point of the fields is that the operator-facing message can stop guessing.
    The previous error path printed "Nothing was replaced" unconditionally, which was
    false exactly when it mattered: after the JSON rename had already landed."""

    def __init__(self, cause, replaced, restored, orphaned):
        super().__init__(str(cause))
        self.cause, self.replaced, self.restored, self.orphaned = cause, replaced, restored, orphaned


def _fault(point):
    """Test-only fault injection, no-op unless DUMP_TASKS_FAULT is set.

    Publication failures cannot be provoked from outside the process — a read-only
    directory stops the staging long before any rename — so the only way to test the
    rollback and the torn-pair detector is to ask for the failure. Values:
    `stage:<n>`, `replace:<n>` (raise BEFORE the nth, 1-based) and `crash:<n>` (die
    HARD after the nth rename, so no rollback runs at all — the case `--check` exists
    for). Anything set here can only refuse to publish, never publish something wrong."""
    want = os.environ.get("DUMP_TASKS_FAULT")
    if not want or want != point:
        return
    if point.startswith("crash:"):
        os._exit(9)
    raise RuntimeError(f"injected fault at {point}")


def commit(staged):
    """Rename every staged temp onto its target, all-or-nothing.

    POSIX cannot rename two files as one operation, so atomicity here is achieved by
    UNDO rather than by a single syscall: each existing target is hard-linked aside
    first (same inode — no copy, no extra space), and any failure puts every original
    back. A hard crash between renames is the one thing this cannot cover, which is
    what the `snapshot_id` in the artifacts is for."""
    backups, replaced, restored, orphaned = [], [], [], []
    for _, dest in staged:
        bak = dest + ".rollback"
        try:
            os.unlink(bak)          # litter from an earlier hard kill
        except OSError:
            pass
        if os.path.exists(dest):
            os.link(dest, bak)
            backups.append((bak, dest))
        else:
            backups.append((None, dest))   # nothing to restore; undo means remove

    try:
        for i, (tmp, dest) in enumerate(staged, start=1):
            _fault(f"replace:{i}")
            os.replace(tmp, dest)
            replaced.append(dest)
            _fault(f"crash:{i}")
        for d in {os.path.dirname(dest) or "." for _, dest in staged}:
            fd = os.open(d, os.O_RDONLY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    except BaseException as e:
        for bak, dest in backups:
            # Only undo what was actually done. Restoring an untouched target is not
            # merely redundant: the backup is a hard link to the very same inode, and
            # `rename()` between two links to one file is a documented no-op that
            # leaves the source in place — so the "restore" would silently leave a
            # .rollback file behind in a committed directory.
            if dest not in replaced:
                continue
            try:
                if bak is not None:
                    os.replace(bak, dest)
                else:
                    os.unlink(dest)  # there was no previous file; undo means none
                restored.append(dest)
            except OSError:
                orphaned.append(dest)
        raise CommitError(e, replaced, restored, orphaned) from e
    finally:
        # Whatever happened above, no backup may survive into a committed directory.
        for bak, _ in backups:
            if bak is None:
                continue
            try:
                os.unlink(bak)
            except OSError:
                pass


def discard(staged):
    for tmp, _ in staged:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.path.expanduser("~/slang-coworkers-prod/nanoclaw"))
    ap.add_argument("--out", default=None, help="JSON output (default <repo>/docs/scheduled-tasks.<slug>.json)")
    ap.add_argument("--md", default=None, help="optional human-readable markdown output")
    ap.add_argument("--check", action="store_true",
                    help="verify the already-published pair agrees with itself; write nothing")
    args = ap.parse_args()

    slug = os.environ.get("INSTANCE_SLUG") or os.path.basename(os.path.dirname(args.repo)) or "instance"
    out = args.out or os.path.join(args.repo, "docs", f"scheduled-tasks.{slug}.json")

    if args.check:
        ok, problems = check_published(out, args.md)
        if ok:
            print(f"{out} and its Markdown mirror are the same snapshot")
            return 0
        for p in problems:
            print(f"ERROR: {p}", file=sys.stderr)
        return 4

    listed_ok, ids = series_ids(args.repo)
    if not listed_ok:
        print(f"ERROR: `ncl tasks list` failed: {ids}", file=sys.stderr)
        print("Refusing to touch the existing snapshot.", file=sys.stderr)
        return 2

    tasks, failed = [], []
    for sid in ids:
        ok, got = ncl(args.repo, "tasks", "get", "--id", sid, "--json")
        d = got.get("data") if (ok and isinstance(got, dict)) else None
        if not d:
            failed.append((sid, got if not ok else "no `data` in response"))
            continue
        tasks.append({k: v for k, v in sorted(d.items()) if k not in VOLATILE})

    # Fail closed. A snapshot missing a task it just listed is indistinguishable in git
    # from that task having been deleted, so a partial read must never be committed.
    if failed:
        print(f"ERROR: {len(failed)} of {len(ids)} listed task(s) could not be read:", file=sys.stderr)
        for sid, why in failed:
            print(f"  {sid}: {str(why).strip()[:200]}", file=sys.stderr)
        print("\nRefusing to write a partial snapshot — the previous one is still "
              "authoritative.\nRe-run once the host/DB is reachable.", file=sys.stderr)
        return 1

    # An empty result is a legitimate state, not a failure. Emptying the snapshot is
    # nevertheless worth a human glance, so say so — loudly, and without lying about
    # the exit code the way "return 2" did.
    if not tasks:
        previous = 0
        try:
            with open(out) as f:
                previous = int(json.load(f).get("task_count") or 0)
        except (OSError, ValueError, TypeError):
            previous = 0
        if previous:
            print(f"WARNING: `ncl tasks list` returned no tasks; the previous snapshot had {previous}.",
                  file=sys.stderr)
            print("Writing the empty snapshot — a deliberate deletion must be recorded, and a"
                  " host/DB failure would have failed the list instead of returning it empty."
                  " Check that this was intended.", file=sys.stderr)

    tasks.sort(key=lambda t: t.get("series_id", ""))
    # `listed_count` is deliberately part of the artifact: a reader can confirm the file
    # is whole without trusting the run that wrote it. No timestamp — the dump must stay
    # byte-identical when no definition changed, or `git diff` stops being a drift alarm.
    payload = {"instance": slug, "complete": True, "listed_count": len(ids),
               "task_count": len(tasks), "tasks": tasks}
    payload["snapshot_id"] = snapshot_id(payload)

    staged = []
    try:
        _fault("stage:1")
        staged.append((stage(out, json.dumps(payload, indent=2, sort_keys=True) + "\n"), out))
        if args.md:
            _fault("stage:2")
            staged.append((stage(args.md, render_md(slug, tasks, payload["snapshot_id"])), args.md))

        # Validate what actually landed on disk, not what we meant to write — a short
        # write or a full disk shows up here, before anything replaces the good copy.
        for tmp, dest in staged:
            with open(tmp) as fh:
                text = fh.read()
            if dest == out:
                reread = json.loads(text)
                if reread.get("task_count") != len(tasks) or len(reread.get("tasks", [])) != len(tasks):
                    raise ValueError(f"staged {dest} does not round-trip {len(tasks)} tasks")
            elif not text.strip():
                raise ValueError(f"staged {dest} is empty")

        commit(staged)
    except CommitError as e:
        discard(staged)
        print(f"ERROR: could not publish the snapshot atomically: {e.cause}", file=sys.stderr)
        # Say what is actually on disk. The previous message was a flat "Nothing was
        # replaced", which was false in precisely the case that mattered — a failure
        # after the first rename had already landed.
        if not e.replaced:
            print("Nothing was replaced; the previous snapshot is untouched.", file=sys.stderr)
        else:
            print(f"Replaced before failing: {', '.join(e.replaced)}", file=sys.stderr)
            print(f"Rolled back: {', '.join(e.restored) or 'none'}", file=sys.stderr)
        if e.orphaned:
            print(f"COULD NOT ROLL BACK: {', '.join(e.orphaned)} — these are now INCONSISTENT with "
                  "the rest of the snapshot. Re-run this script, or restore from git.", file=sys.stderr)
        return 3
    except Exception as e:  # noqa: BLE001 — last-resort rollback. Any escape here
        # leaves a half-replaced snapshot on disk, which is the torn-publish failure
        # this script was written to make impossible. Breadth is the guarantee.
        discard(staged)
        print(f"ERROR: could not stage the snapshot: {e}", file=sys.stderr)
        print("Nothing was replaced; the previous snapshot is untouched.", file=sys.stderr)
        return 3

    print(f"wrote {out}  ({len(tasks)} tasks, complete)")
    if args.md:
        print(f"wrote {args.md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
