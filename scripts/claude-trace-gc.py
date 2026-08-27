#!/usr/bin/env python3
"""claude-trace-gc — bound the disk cost of claude-trace session dumps.

claude-trace writes one .jsonl (raw request/response log) and one .html (rendered
viewer, regenerated from the jsonl) per session into
groups/<folder>/.claude-trace/. Both grow with the session, and they get big:
measured on lego, 21 files totalled 218 MB and a SINGLE session was 165 MB
(94.7 MB html + 70.6 MB jsonl). Left alone this fills a disk.

Two passes, because age alone is not enough:

  1. AGE      — delete anything older than --days (default 7).
  2. LRU CAP  — if the total is STILL over --max-gb (default 5), delete
                least-recently-modified first until it fits.

The cap is the part that actually protects the disk. A week's retention says
nothing about volume: one runaway session can blow a 5 GB budget in a day, and
prod runs far more traffic than lego. Age keeps history tidy; the cap keeps the
disk safe.

NEVER deletes a file modified within --min-age-min (default 60) minutes. Those
belong to sessions claude-trace is still writing (containers run up to a 3h
ceiling), and pulling one mid-write would corrupt a live trace. This means a
burst of active sessions can legitimately hold the total above the cap — that is
reported, not silently ignored.

Nothing is deleted quietly. Every removal is logged with its size and age, and
the summary says explicitly when the cap forced deletions INSIDE the age window,
because that means traffic now exceeds the budget and the numbers need revisiting.

  python3 scripts/claude-trace-gc.py [--repo <path>] [--days 7] [--max-gb 5]
                                     [--min-age-min 60] [--dry-run]
"""
import argparse
import glob
import os
import sys
import time

# On prod the checkout (groups/ included) lives on / — 61 GB free — while the
# 427 GB /ephemeral/prod-groups tree is separate. 5 GB here is comfortably
# isolated from the partition holding worktrees and session data.
DEFAULT_MAX_GB = 5.0
DEFAULT_DAYS = 7
DEFAULT_MIN_AGE_MIN = 60


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.path.expanduser("~/slang-coworkers-prod/nanoclaw"))
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS)
    ap.add_argument("--max-gb", type=float, default=DEFAULT_MAX_GB)
    ap.add_argument("--min-age-min", type=int, default=DEFAULT_MIN_AGE_MIN,
                    help="never delete files touched this recently (live sessions)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    now = time.time()
    age_cut = now - a.days * 86400
    live_cut = now - a.min_age_min * 60
    cap = a.max_gb * 1024**3

    # NOTE: plain glob, no `**`. The trace dirs are exactly one level under
    # groups/<folder>/ and are DOT-prefixed — Python's glob will not descend into
    # dot-directories via `**`, so a recursive pattern silently finds nothing.
    pattern = os.path.join(a.repo, "groups", "*", ".claude-trace", "*")
    files = []
    for p in glob.glob(pattern):
        try:
            st = os.stat(p)
        except OSError:
            continue
        if os.path.isfile(p):
            files.append((p, st.st_size, st.st_mtime))

    if not files:
        print(f"no claude-trace files under {a.repo}/groups/*/.claude-trace/")
        return 0

    total0 = sum(f[1] for f in files)
    print(f"claude-trace-gc  {a.repo}")
    print(f"  found {len(files)} files, {human(total0)}"
          f"   policy: age>{a.days}d, cap {a.max_gb} GB, protect <{a.min_age_min}min\n")

    removed, freed, protected = [], 0, 0

    def drop(path, size, mtime, why):
        nonlocal freed
        age_d = (now - mtime) / 86400
        print(f"  {'WOULD RM' if a.dry_run else 'rm'}  {human(size):>9}  {age_d:5.1f}d  {why:<10} {path}")
        if not a.dry_run:
            try:
                os.remove(path)
            except OSError as e:
                print(f"      FAILED: {e}", file=sys.stderr)
                return
        removed.append(path)
        freed += size

    # ---- pass 1: age ---------------------------------------------------------
    survivors = []
    for p, size, mtime in files:
        if mtime > live_cut:
            protected += 1
            survivors.append((p, size, mtime))
        elif mtime < age_cut:
            drop(p, size, mtime, "age")
        else:
            survivors.append((p, size, mtime))

    # ---- pass 2: LRU cap -----------------------------------------------------
    remaining = total0 - freed
    capped_inside_window = 0
    if remaining > cap:
        print(f"\n  still {human(remaining)} > cap {a.max_gb} GB — evicting"
              f" least-recently-modified first\n")
        # Oldest mtime first == least recently used.
        for p, size, mtime in sorted(survivors, key=lambda f: f[2]):
            if remaining <= cap:
                break
            if mtime > live_cut:
                continue  # live session — never
            drop(p, size, mtime, "lru-cap")
            capped_inside_window += 1
            remaining -= size

    final = total0 - freed
    print(f"\n  removed {len(removed)} files, freed {human(freed)}")
    print(f"  now {human(final)}" + (f" (cap {a.max_gb} GB)" if final <= cap else
                                     f"  *** STILL OVER CAP {a.max_gb} GB ***"))
    if protected:
        print(f"  {protected} file(s) protected as live (<{a.min_age_min}min old)")
    if capped_inside_window:
        print(f"  NOTE: the cap deleted {capped_inside_window} file(s) NEWER than "
              f"{a.days}d. Trace volume now exceeds the budget — raise --max-gb or "
              f"lower --days deliberately rather than letting the cap silently "
              f"shorten retention.")
    if final > cap:
        print("  NOTE: still over cap because the remainder is live sessions; "
              "the next run will collect them.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
