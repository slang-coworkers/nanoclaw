---
type: project
title: "lego dev `groups/<name>/` dirs are symlinks to /ephemeral/lego-groups/<name>/ — except main/ and templates/ which carry git-tracked files"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# lego dev `groups/<name>/` dirs are symlinks to /ephemeral/lego-groups/<name>/ — except main/ and templates/ which carry git-tracked files

On the lego dev instance (`/home/ubuntu/haaggarwal/lego-nanoclaw/`), `groups/*` is mostly symlinks into `/ephemeral/lego-groups/`. Set up 2026-05-28 because `/` filled up (`slang-fixer/` alone was 25G).

**Why:** `/dev/vda1` (124G, the OS disk) hits 100% during slang work — the heavy groups generate huge amounts of data per session. `/ephemeral` is 251G on `/dev/vdb` and was already partially used by perfhound + neuralgraphics from May 21.

**How to apply:**
- Container bind-mounts resolve symlinks at mount time, so this is transparent to running containers.
- **Two groups must NOT be symlinked: `groups/main/` and `groups/templates/`** — they have git-tracked files (`groups/main/CLAUDE.md`, 4 files under `groups/templates/instructions/`). Git refuses to operate when a tracked dir becomes a symlink (shows phantom `D` deletions, blocks `git checkout`). If you see those phantom deletions during a `/update-nanoclaw-instance` run, restore those two as real dirs (`cp -a /ephemeral/lego-groups/{main,templates} groups/`, remove the symlinks first).
- Don't apply this pattern to prod (`/home/ubuntu/slang-coworkers-prod/nanoclaw`) — its groups dir is much smaller and `/ephemeral` is per-host.
- The `[[update-nanoclaw-instance skill]]` rebuild step (10b) just calls `ncl groups restart --rebuild` per group; it doesn't care about the symlink.
- See [[update-nanoclaw-merge-drift]] for the per-merge file-drop pattern that's orthogonal to this.

