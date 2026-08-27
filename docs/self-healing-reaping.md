# Self-Healing Worktree Reaping — Visual Guide

How `/ephemeral` stays clean without a human, and what happens in the worst case.

---

## 1. The problem in one picture

```
  /ephemeral  (/dev/vdb, 251 G)  ── the WORKTREE volume (NOT host /)
  ┌──────────────────────────────────────────────────────────────┐
  │ docker images ~23G │ slang base clones ~30G │  wt-* worktrees │
  │                    │ (1 per fixer group)    │  6–13 G EACH    │
  └──────────────────────────────────────────────────────────────┘
                                                  ▲
        each slang-fixer issue → one wt-slang-<n> = a full CMake build/ tree
        (build/ is ~all of it; .git is 4 KB)

  LEAK: the fixer deletes its own worktree on a CLOSED/MERGED webhook —
        but ONLY while its container is alive. When the PR goes terminal
        AFTER the fixer went idle, the self-clean never fires →
        a multi-GB tree is stranded with no one to delete it.
```

`df -h /workspace` always looks healthy (that's the small `/dev/vda1`). The volume that fills
is `/workspace/agent` = `/ephemeral` = `/dev/vdb`. Watching the wrong disk is why it used to
fill silently.

---

## 2. Who can do what (the capability split that shapes the design)

```
                    see wt-*   gh PR    git dirty/    delete /
                    (RO mount) state    unpushed      push wip
  ┌───────────────┬──────────┬────────┬─────────────┬──────────┐
  │ supervisor    │   ✅     │  ✅    │   ❌ (*)     │   ❌ (RO)│  → DECIDES
  │ (main/orch)   │          │        │ wrong ns     │          │
  ├───────────────┼──────────┼────────┼─────────────┼──────────┤
  │ owning fixer  │  ✅ own  │  ✅    │   ✅         │   ✅ RW  │  → EXECUTES
  │ (in its ns)   │          │        │              │          │
  └───────────────┴──────────┴────────┴─────────────┴──────────┘
  (*) from the supervisor's RO mount, `git worktree list` calls almost everything
      "prunable" — a WRONG-NAMESPACE artifact (admin records the container path
      /workspace/agent/wt-*). NEVER reap on prunable. gh PR state is the only truth.
```

The supervisor **cannot** safely delete (read-only mount + can't read git state).
Only the **owning fixer** can — so the supervisor dispatches; the fixer executes.

---

## 3. The reaping loop (runs every supervise tick — cron `0 */12 * * *`)

```
            ┌──────────────────────── SUPERVISOR (orchestrator) ───────────────────────┐
            │                                                                            │
   tick ──▶ │ 1. df /workspace/extra/ephemeral   ── real volume, every tick             │
            │       └─ surface "worktree-vol: N GB free" on the board                    │
            │                                                                            │
            │ 2. DISCOVER from DISK, not the chain list:                                 │
            │       du -sh .../prod-groups/*/wt-*        (orphans outlive sessions)      │
            │                                                                            │
            │ 3. CLASSIFY each wt-<slug> by gh PR state:                                 │
            │       ┌─ MERGED / CLOSED ─────────────▶ REAP                               │
            │       ├─ OPEN  or running session ────▶ KEEP                               │
            │       └─ NO-PR ───────────────────────▶ wake-to-confirm (never blind rm)   │
            │                                                                            │
            │ 4. for each REAP: dispatch ONE a2a to the OWNING session ───────────┐      │
            └────────────────────────────────────────────────────────────────────┼──────┘
                                                                                  │
                            (stopped session? the inbound WAKES a fresh container)│
                                                                                  ▼
            ┌──────────────────────────── OWNING FIXER (its own namespace) ─────────────┐
            │ 5. cd /workspace/agent/wt-<slug>                                           │
            │                                                                            │
            │    dirty or ahead-of-upstream?                                             │
            │       ├─ YES ─▶ git add -A && commit "wip(reap)…"                          │
            │       │         git push origin HEAD:wip/reap/<branch>   ← LOSSLESS save   │
            │       └─ NO ──▶ (nothing to save)                                          │
            │                                                                            │
            │ 6. git worktree remove --force wt-<slug>                                   │
            │    rm -rf active-work/<slug>                ← disk reclaimed (6–13 G)       │
            │                                                                            │
            │ 7. reply "gc done <freed>G"  ───────────────────────────────────────┐     │
            └─────────────────────────────────────────────────────────────────────┼─────┘
                                                                                   │
            supervisor records gcRequestedAt; next tick re-checks the disk. ◀──────┘
```

**Resume any time** (even months later): `git worktree add wt-<slug> wip/reap/<branch>`.
Nothing is ever lost — the `wip/reap/*` branch lives on `origin` forever and never collides
with live `fix/issue-*` branches or the reaper's own `gh --head` lookups.

---

## 4. Self-healing: the worst-case paths and how each recovers

```
  CASE A — stopped container
  ──────────────────────────
  dispatch → host sweep sees a due inbound + no running container
           → wakeContainer() respawns it with the SAME workspace mounted
           → it reaps its own worktree.            ✅ no human needed

  CASE B — rotated SDK transcript (the "No conversation found" / Perfhound error)
  ──────────────────────────────────────────────────────────────────────────────
  A fixer idle >14 days (or >12 MB transcript) has its SDK .jsonl rotated away.
  On wake it may error "No conversation found with session ID …" on turn 1.
           → runner matches STALE_SESSION_RE, CLEARS the continuation
           → host RE-DELIVERS the GC message
           → turn 2 runs FRESH-CONTEXT and reaps.   ✅ one-turn delay, self-heals
  Why it still works: the GC dispatch carries the FULL recipe (cd wt-<slug>;
  save-then-remove). It needs ZERO memory of the original work.

  What rotation does to MEMORY (separate concern, NOT a reap problem):
    archiveTranscriptFile() tries to write a readable markdown DIGEST to
    /workspace/agent/conversations/<date>-<slug>.md before deleting the .jsonl
    — for an agent to RE-READ later, NOT a reloadable SDK session. Rotation is
    one-way: the SDK conversation cannot be --resume'd afterward; turn 2 is
    genuinely blank-context. If the archive step fails (no summary index, parse
    error — observed for Perfhound, which had NO conversations/ dir), it falls
    back to renaming the raw file aside as `<path>.rotated-<ts>` (recoverable by
    hand, not auto-loaded). So: substantive multi-day work CAN lose working
    memory on rotation; the REAPER cannot, because it carries its own recipe.

  CASE C — fixer ignores / can't act (twice)
  ──────────────────────────────────────────
  worktree still on disk after 2 CLEAN dispatches, no "gc done"
           → escalate to operator with du/df + the wt-* list
           → human does a host-side `git worktree remove`.   ✅ bounded fallback

  CASE D — dirty worktree on a MERGED PR (would lose work)
  ───────────────────────────────────────────────────────
  9 untracked files observed in a merged-PR worktree.
           → save-then-remove pushes wip/reap/<branch> BEFORE removing.
           → `remove --force` destroys nothing recoverable.   ✅ lossless

  CASE E — supervisor itself is down / cron missed
  ────────────────────────────────────────────────
  the volume keeps filling, but the LIVE fixers' own webhook-driven
  self-clean still runs; and the NEXT tick's <10 G disk-pressure trigger
  fires an immediate reap pass (doesn't wait for the 12 h cadence). ✅ catches up
```

---

## 5. Will we ever run out of space?

**Short answer: not under normal load — there are three independent backstops, any one of
which keeps it bounded. The only real risk is a burst of concurrent builds outrunning the
12 h cadence, which the `<10 G` per-tick trigger is designed to absorb.**

### The capacity math (current prod numbers)

```
  volume                       251 G
  fixed overhead:
    docker images               ~23 G
    base clones (1 per group)   ~30 G   (shared, NOT per-issue — git fetch only)
                               ─────
    headroom for worktrees     ~198 G

  per active build:            6–13 G   (call it ~8 G avg)
  ⇒ steady-state capacity:     ~24 concurrent live builds before pressure
  observed concurrent fixers:  3–7
```

So at the **observed** load (3–7 builds) the volume sits at ~30–60 % worktree usage —
comfortably inside headroom. The leak was never "too many *live* builds"; it was **dead
orphans never reaped**, which the loop above now removes.

### Three backstops, in order of speed

```
  ① per-tick disk-pressure trigger  (<10 G free)  → reaps NOW, every tick  ── fastest
  ② 12 h supervise cron             (routine)     → reaps terminal orphans  ── steady
  ③ operator escalation             (2 missed)    → human host-side rm      ── bounded
```

### When COULD it still run out?

```
  ✗ >24 builds genuinely live AT ONCE, all OPEN PRs (nothing to reap) — would need
    a real burst; the <10 G trigger escalates to a human before ENOSPC.
  ✗ supervisor cron disabled AND every fixer dead AND no webhooks — all three
    reapers off at once. Escalation (③) is the floor.
  ✗ docker images bloat (stale per-group images) — separate from worktrees;
    handled by `docker image prune`, not this loop.
```

**Net:** with the reaper live, disk is **self-bounding** — orphans are removed within 12 h
(or immediately under pressure), live builds are capped by real headroom (~24), and the
human escalation is the hard floor. The historical 100 %-full events were the *pre-reaper*
state (orphans accumulating with no executor); that root cause is now closed.

---

## 6. One-line invariants (the load-bearing rules)

- Reap signal = **gh PR state (MERGED/CLOSED)**, never git-prunable (wrong-namespace lie).
- Supervisor **decides**; the **owning fixer executes** (RO mount + never-cross-delete).
- A **stopped** session is reachable — the GC inbound **wakes** it; dead ≠ unreachable.
- **Save-then-remove**: push `wip/reap/<branch>` before `remove --force`. Nothing is lost.
- A transient **"No conversation found"** on wake is **self-healing**, not a reap failure.
- Watch `/workspace/agent` (= `/ephemeral`, `/dev/vdb`), never `/workspace` (`/dev/vda1`).

See `container/skills/supervise-issues/SKILL.md` §8 for the executable procedure.
```
```
