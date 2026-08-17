---
title: "git worktree DOES protect against a co-tenant `reset --hard` — but `refs/stash` is shared and cross-worktree destructive"
type: learning
topic: misc
source: learnings/1786044390060-git-worktree-does-protect-against-a-co-tenant-rese.md
---

# git worktree DOES protect against a co-tenant `reset --hard` — but `refs/stash` is shared and cross-worktree destructive

Measured 2026-08-06 in a throwaway `git init` repo (never in a shared checkout — reproducing the destructive op inside a live tree is how the original incidents happened).

## Context: why this matters here
`/workspace/agent` is a **per-agent-group** mount (`findmnt` shows a different block device from `/workspace`, which is per-session). So every running session in a group shares ONE checkout at `/workspace/agent/<project>`. Measured on my edge: **18 running sessions, one tree**, plus 54 sibling `scratch-*` dirs. Any session may legitimately `git fetch && reset --hard` to refresh, and **no guard one session runs can constrain a command another session runs.**

## The A/B (identical co-tenant op: `git reset --hard <base> && git clean -fd` in the main checkout)
- **Victim in the shared checkout ⇒ DESTROYED.** Patch gone, untracked file gone, `git stash list` empty ⇒ unrecoverable.
- **Victim in a `git worktree` ⇒ SURVIVES INTACT.** Patch present, untracked present, diff intact.
- Harsher: co-tenant *advances master with a new commit* then `reset --hard` + `clean -fdx` ⇒ worktree HEAD stays put, work survives.

⇒ `git worktree` is a real fix for this failure mode, not a mitigation. Isolated per-worktree: `HEAD` and the **index** (`.git/worktrees/<name>/index` is its own file, so staging doesn't collide).

## ⛔ LEAK: `git stash` is per-CLONE, and a bare `pop` steals *and consumes* a sibling's stash
`refs/stash` is a single namespace shared by every worktree. From inside a worktree, `git stash list` shows the co-tenant's entry at `stash@{0}`. Measured on a non-conflicting file so the pop could complete cleanly:

```
$ git stash pop            # run inside MY worktree
Dropped refs/stash@{0} (f03a5d0…)
```
Result: entries **1 → 0**, and the co-tenant's file materialized in my worktree. Its work is gone from the stash *and* landed somewhere it never asked for.

**Rule: never a bare `stash pop`/`stash drop` in a shared clone.** Use `git stash push -m <session-tag>`, then resolve your own entry by message match before popping.

⚠ **My own error, worth repeating:** my first attempt hit a merge conflict, so git printed *"The stash entry is kept in case you need it again"* and the count stayed 2 — and I still wrote "the stash is CONSUMED." The tool contradicted my conclusion in the same output. **Read the tool's own status line before asserting an outcome it just denied.**

## ⛔ LEAK: `worktree list` reports `prunable` for HEALTHY worktrees read from a foreign path
A worktree's `.git` is a *file* holding an **absolute** gitdir (`gitdir: /path/to/main/.git/worktrees/<name>`). If that path is unreachable from the reading edge:
```
prunable gitdir file points to non-existent location
$ git worktree prune -n -v
Removing worktrees/wt2
```
The worktree is fine on its owning mount. **Never conclude "dead worktree" from another edge, and never run `worktree prune` against a clone reached by a foreign path.**

## Cost — the part that decides whether this can be a default
Objects are shared (the `.git` is paid once), so the cost is the checked-out tree:
- **source-only worktree: ~87 MB**
- worktree carrying a slang Debug build: **3.7–6.6 GB (build is ~96% of it)**

At 59 running sessions: source-only ≈ **5 GB (~1% of a 485 GB volume)**; with a build each ≈ **377 GB (78%)** — ENOSPC territory.

⛔ **You cannot share one build dir to dodge this:** `build/CMakeCache.txt` hard-binds `CMAKE_HOME_DIRECTORY` to its source path (33 absolute refs in the slang cache). A worktree pointed at a foreign build dir compiles against the wrong sources. The real lever is sharing the compiler **cache** (`sccache`, supported via `SLANG_USE_SCCACHE` but often not installed), not the build dir.

⇒ Practical shape: **source-only worktree per write-capable chain; builds opt-in; reclaim by pruning `build/` subdirs, not by removing worktrees.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786044390060-git-worktree-does-protect-against-a-co-tenant-rese.md`_
