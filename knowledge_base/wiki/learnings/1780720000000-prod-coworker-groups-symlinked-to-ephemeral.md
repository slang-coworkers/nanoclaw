---
title: "Prod's 6 slang/slangpy coworker group dirs are symlinked to /ephemeral"
type: learning
topic: slang-compiler
source: learnings/1780720000000-prod-coworker-groups-symlinked-to-ephemeral.md
---

# Prod's 6 slang/slangpy coworker group dirs are symlinked to /ephemeral

**Date:** 2026-06-06
**Source:** operator directive (disk pressure on `/`)

## What

On prod (`/home/ubuntu/slang-coworkers-prod/nanoclaw`), these 6 coworker workspaces are **symlinks** into `/ephemeral/prod-groups/<name>` (the 251G `/dev/vdb`), not real dirs on the 124G OS disk (`/dev/vda1`):

- `groups/slang-fixer` (the big one — 7.9G, grows per fix), `groups/slang-triager`, `groups/slang-reviewer`
- `groups/slangpy-fixer`, `groups/slangpy-triager`, `groups/slangpy-reviewer`

Set up 2026-06-06 because slang work fills `/` (fixer clones + build trees per session). Reclaimed ~8G immediately; ongoing growth now lands on `/ephemeral`.

## Must stay REAL (do NOT symlink)

- **`groups/main/`** — has a git-**tracked** file (`CLAUDE.md`); symlinking a tracked dir breaks git (phantom `D` deletions, blocks `git checkout`). `groups/templates/` likewise if present.
- Only the **untracked, gitignored** coworker dirs are safe to symlink.

## Why it's safe / survives respawn

`initGroupFilesystem` (`src/group-init.ts`) gates dir creation on `fs.existsSync(groupDir)`, which **follows symlinks** → a symlink to an existing `/ephemeral/prod-groups/<g>` reads as present, so it is NOT re-created as a real dir on wake. Container bind-mounts resolve the symlink at spawn. Verified end-to-end: slang-reviewer respawned, symlink intact, mount resolved to `/ephemeral`.

## Gotchas

- **Move only while the group's containers are STOPPED.** Moving a dir under a live bind-mount corrupts the session. (During this move a respawn raced and left a few freshly-written files in the source — recovered by `rsync source/ dest/` before swapping. If `mv` fails "Directory not empty", that's the race: rsync the remainder, then `rm -rf source && ln -s`.)
- This is the prod analog of lego's `groups/* → /ephemeral/lego-groups/*` setup.
- `/update-slang-coworkers-prod` operates on tracked files + DB; it doesn't touch these gitignored symlinks. If a future operator flattens one, re-run the stop→move→symlink for that group.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780720000000-prod-coworker-groups-symlinked-to-ephemeral.md`_
