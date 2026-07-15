---
name: feedback_gc_resolve_slice_worktree_head_not_issue
description: "Worktree GC false-REAPs slice worktrees — resolve HEAD→PR, not issue#→fix/issue-<num> branch"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fffae428-9bad-49a0-b2f6-8691d1e9b711
---

Supervisor worktree GC must resolve a slice worktree's **real HEAD commit → its PR**, NOT `issue#` → the `fix/issue-<num>` branch convention.

**Why:** slice worktrees carry suffixed branches (`fix/issue-11917-asafe-c`, `-matrix`, `-p2`) that map to *different* open PRs than the plain `fix/issue-<num>` branch. The plain branch usually resolves to an already-MERGED older slice, so the GC classifier flags the live worktree REAP — destroying unmerged slice work + any foreign stashes it holds. This false-positive has fired **two ticks running**: tick 85 `wt-slang-11917-matrix` (real PR #11987, not merged #11920) and tick 86 `wt-slang-11917-c` (real branch `fix/issue-11917-asafe-c` HEAD 34f450bea1 = PR #12088 OPEN/APPROVED, not merged #11920). Both held stashes from other branches (`adopt/issue-10788`, `fix/issue-11532`).

**How to apply:** for any worktree whose dir name has a suffix beyond the bare number (`-c`, `-matrix`, `-p2`, `-rebase`, `-slices`), treat the issue#→branch resolution as unreliable. Always dispatch a **gated confirm-reap to the owning fixer** (never blind `git worktree remove` — the gitdir lives in their container, invisible from the read-only mount). The fixer self-reaps on the slice PR's `pr_merged` webhook. See [[project_11917_pass_gating_epic]].
