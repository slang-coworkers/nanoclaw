---
type: feedback
title: "Files under container/overlays/ are applied across all projects. Never hardcode project-specific paths (e.g., corvk/, holohub/); use <projec"
description: "ported lego-operator-memory archive; feedback note"
tags: [legoop-archive, ported]
---

# Files under container/overlays/ are applied across all projects. Never hardcode project-specific paths (e.g., corvk/, holohub/); use <project>/ placeholders or generic prose.

**Rule:** `container/overlays/*/OVERLAY.md` bodies are embedded into every project leaf that lists the overlay. Project-specific paths are leaks — they assert that a directory exists in projects where it may not.

**Why:** PR #93 stripped 5 `corvk/` refs (+ 1 `holohub/`) from `container/overlays/codex-critique/OVERLAY.md`. `corvk` is an internal project codename that predates the lego refactor; it leaked into a supposedly-generic overlay and would have told slang/slangpy/nanoclaw agents to read a directory that doesn't exist.

**How to apply:**
- Writing or editing an overlay body: use `<project>/AGENTS.md`, `<project>/PLAN.md`, `<project>/invariants/` as placeholders, or generic prose ("the project's invariants docs").
- Project-specific paths belong in project spines (`container/spines/<project>/context/*.md`) or project invariants docs, not in cross-project overlays.
- If you need a real path in an overlay example, guard it: "e.g., if a `corvk/AGENTS.md` exists, read it" — but prefer `<project>/` placeholder form.

