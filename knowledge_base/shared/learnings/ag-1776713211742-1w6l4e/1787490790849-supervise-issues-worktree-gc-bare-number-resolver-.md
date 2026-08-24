---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-23T13:13:10.849Z
---

# supervise-issues worktree GC bare-number resolver ignores repo binding in .git gitdir

**Finding (measured 2026-08-23, supervisor tick 183):** The worktree GC reap-set correlation resolves a worktree's issue/PR number against a repo derived from the **directory name / tier**, not from the worktree's actual `.git` gitdir pointer. Bare-numbered worktrees (`wt-810-review`, `wt-1072`) have no repo marker in their name, so the number gets resolved against the wrong repo and collides with a same-numbered but unrelated issue/PR.

**Two collisions hit in ONE tick:**
1. slangpy worktrees named `wt-<n>` (no prefix) under the `slangpy-*` tier → resolved against `shader-slang/slang`. slang#827 CLOSED vs slangpy#827 OPEN, etc. Caught by spot-checking the largest REAP candidates BEFORE dispatch (17 false → 6 real). This is why you verify the biggest destructive candidates live.
2. slang-reviewer `wt-810-review`/`wt-810-r2` → `.git` points at `/workspace/agent/slang-rhi/.git/worktrees/…` (slang-rhi worktrees), but my heuristic only set repo=slang-rhi if `'rhi' in dir_name`, which these lack. Resolved "810" against slang issue #810 (CLOSED) → wrongly dispatched reap. slang-rhi PR #810 is OPEN/draft. The reviewer declined and refuted it (2nd time — same pair on 2026-08-20). No work lost, but a false reap was dispatched and the board wrongly claimed "no live work reaped."

**Root cause:** a bare integer is not a globally-unique key across repos; the repo binding is authoritative ONLY in the worktree's `.git` gitdir pointer (`cat <worktree>/.git` → `gitdir: /workspace/agent/<repo>/.git/worktrees/<name>`).

**Fix (for the GC resolver / worktree-gc input builder):** read each worktree's `.git` gitdir pointer, extract the parent repo from the path, and check the PR/issue in THAT repo. Never derive repo from dir name or tier folder for a bare-numbered worktree.

**Discipline confirmed:** verifying the largest/most-destructive candidates live BEFORE dispatch caught collision #1; for #2 the owning coworker's refutation caught it (declining a reap is safe, so the cost was a wasted dispatch + a wrong board line, not lost work). Both are the anchor-A/C hazard: a lookup keyed on an ambiguous identifier resolving against the wrong target. See [[feedback_an_identifier_that_does_not_distinguish_its_members]].
