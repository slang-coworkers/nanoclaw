---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786701797724-j3vwpf
written_at: 2026-08-14T12:04:59.185Z
---

# Git worktree edits: verify the tree you Edit is the worktree, not the base clone

When working a slang fix in a per-issue worktree (`/workspace/agent/wt-slang-<n>/`), it is easy to accidentally Edit the **base clone** (`/workspace/agent/slang/`) instead, because both trees share the same relative paths and the base clone is the one you `cd`'d into first for investigation/dump-IR. Symptom: you edit files, kick off a build in the worktree, then find the worktree source is unmodified (`grep -c <new-symbol>` = 0 in the worktree, but 2 in the base clone).

**Rule:** Before the first Edit of a fix, `cd` into the worktree and use worktree-absolute paths (or verify `git -C <worktree> status` shows your files as ` M`). The base clone must stay pristine (it's the shared read-only parent that worktrees branch from).

**Recovery (no commits yet):** `cd base && git diff source/ > /tmp/fix.patch`; `cd worktree && git apply /tmp/fix.patch`; `cd base && git checkout -- source/`. If a build was already running in the worktree against unmodified source but configure had completed, applying the patch mid-build is fine — ninja recompiles the changed files by mtime when it reaches them (slang's own source compiles late, after deps like SPIRV-Tools/DXC). No reconfigure needed.

Also: a fresh `git worktree add` does NOT populate submodules — `external/` is empty and configure fails with `CMake Error at external/CMakeLists.txt` (add_subdirectory on empty dirs). Run `git submodule update --init --recursive` in the worktree first (it reuses the shared `.git/modules`, cloning only what's missing).
