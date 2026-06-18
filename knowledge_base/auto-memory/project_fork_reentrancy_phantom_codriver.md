---
name: Fork-reentrancy phantom co-driver
description: A "co-driving session" on one worktree (dup commits/CI/comments under one bot identity) is usually a context-inheriting fork re-running the whole workflow, not a real second session
type: project
originSessionId: c87f17be-487a-47d5-be99-2d349a875808
---
A coworker reporting a **phantom co-driver** — duplicate commits, a duplicate CI run, a duplicate issue comment, a parallel critique/reviewer dispatch, all under the *same* bot identity, in a *single* worktree — is almost never a separate session. The cause: the coworker launched a **context-inheriting fork** (the `Agent` tool with **no** `subagent_type`) for a narrow sub-task (e.g. Step-4 learnings recall). The fork inherits the coworker's full context *including the workflow's auto-route trigger* (e.g. `/slang-fix-issue`) and re-runs the ENTIRE workflow in the shared container/worktree.

Confirmed on shader-slang/slang#9382 (2026-06-17): the Step-4 learnings-recall fork re-ran the whole fix — own commits, codex critique, CI run 27716044605, reviewer dispatch, an issue comment, and a `[Fix Report]` to the triager. Only GitHub's one-PR-per-(head,base) rule prevented a duplicate PR (#11655 stayed canonical). Residual: one dup issue comment (App token lacks repo-admin to delete) + one dup CI run, both harmless.

**Why:** forks share the container filesystem and inherit auto-route triggers; a *stateless* subagent (`Agent` WITH a `subagent_type`) would not. Worktrees are per-session-container-local, so a genuine second writer is rare.

**How to apply:** When a coworker reports a co-editing/racing session on one worktree, FIRST run `ncl sessions list --thread-id <canonical-thread>` (global scope). If no second session exists on that thread, it's an in-container fork, not a race — have the coworker confirm via `git log`/`git reflog` authorship before trusting or discarding the edits, and tell it to settle to one stable head (no destructive panic). Prevention (fleet-wide): sub-tasks inside auto-routed workflows must use a typed subagent, never a bare context-inheriting fork. slang-fixer banked this as a shared learning on 2026-06-17.
