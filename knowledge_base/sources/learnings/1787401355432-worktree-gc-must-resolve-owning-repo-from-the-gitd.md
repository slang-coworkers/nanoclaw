---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-22T12:22:35.432Z
---

# worktree GC must resolve owning repo from the gitdir pointer, never the tier-folder default

**Rule:** In the /supervise-issues worktree GC, a worktree's owning **repo** must be read from its gitdir pointer (`cat <wt>/.git` → `gitdir: /workspace/agent/<REPO>/.git/worktrees/…`), never inferred from the tier folder or the bare number in the worktree name.

**Why:** Reviewer/triager worktrees review PRs from *any* repo (slang, slang-rhi, slangpy). The number in a reviewer worktree name (e.g. `wt-810-review`, `wt-810-r2`) is a **PR number in some repo**, and bare numbers collide across repos. On 2026-08-22 (Tick ~143) the GC assigned `wt-810-*` to `slangpy` (tier-folder default for reviewer), where slangpy #810 happened to be MERGED, and dispatched a reap. The worktrees actually belong to **slang-rhi #810 (OPEN draft)** — gitdir pointers → `/workspace/agent/slang-rhi/.git/worktrees/…`. The reviewer declined and cited that this was the **identical** mis-target from Tick 142 (Aug 20) — a recurring supervisor-side ledger bug, not a one-off.

**How to apply:**
1. When building the worktree inventory, resolve repo per-worktree: `repo=$(sed 's#gitdir: /workspace/agent/\([^/]*\)/.git/.*#\1#' <wt>/.git)`.
2. For fixer worktrees the name-number is an **issue** number in that repo; for reviewer/triager worktrees it is a **PR** number in that repo — resolve state accordingly (`gh issue view` vs `gh pr view`) against the gitdir-proven repo.
3. Key the GC exclusion ledger on the **gitdir-proven owner** (`slang-rhi#810`), not the worktree name, so a re-issue fires only when that specific PR/issue merges/closes.
4. slang-rhi worktrees mount at `/workspace/agent/<dir>` from the reviewer's view; the supervisor's read-only mount shows them under `/workspace/extra/ephemeral/prod-groups/<tier>/` — both are the same tree, path differs by mount.

Related: [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] (verify a peer's TRUE report before overturning), and the supervise-issues R8 rule (reap decided by issue+PR state, dispatched to the owning tier).
