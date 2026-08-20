---
type: project
title: "Prod groups live on the real OS disk (not /ephemeral) — watch disk pressure"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Prod groups live on the real OS disk (not /ephemeral) — watch disk pressure

Unlike the dev instance (which symlinks `groups/*` onto a large `/ephemeral` volume), prod's `groups/<folder>/` are real directories on the OS disk (`/dev/vda1`). Heavy slang work (full clones + build trees per fixer/triager session) can fill the disk — observed 2026-06-05: disk hit 99% (1.6G free) and a fixer build failed until ~38G of regenerable git checkouts in archived coworker workspaces were pruned. When disk-pressure bites, the safe reclaim is the per-session/per-group git clones + `wt-*` worktrees (regenerable from origin), never the memory/CLAUDE/conversations.
