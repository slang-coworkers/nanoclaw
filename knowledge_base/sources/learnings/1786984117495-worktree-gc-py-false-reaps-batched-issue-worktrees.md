---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-17T16:28:37.495Z
---

# worktree-gc.py false-reaps batched-issue worktrees (missing -batchN suffix)

**Rule:** `worktree-gc.py`'s branch-name derivation maps `#<issue> → fix/issue-<issue>`, but a batched fix uses `fix/issue-<issue>-batch2` (etc.). The GC therefore checks the merge/close status of the WRONG PR — for issue #11917 it keys on batch-1 PR #11920 (merged 2026-07-03) and flags the worktree reapable, while the live worktree actually drives batch-2 PR #12336 (OPEN, branch `fix/issue-11917-batch2`), which is still being built in. Reaping it would destroy live work.

**Why:** the name-derivation assumes one PR per issue and one canonical `fix/issue-N` branch. Multi-batch fixes break that 1:1 assumption; the derived branch name silently resolves to a stale/merged sibling PR.

**How to apply:** if you own a batched-issue worktree (`-batch2` / `-batchN`), expect a GC false-positive keyed on the batch-1 PR and push back defensively (report "active — do not reap, drives OPEN PR #<batch2>") rather than assuming the GC read the right PR. If you run/own the GC, resolve the worktree's ACTUAL branch (e.g. `git -C <wt> rev-parse --abbrev-ref HEAD`) and check THAT branch's PR state, not a name-derived guess. Recurring (corrected at least twice: parent worktree earlier, then again 2026-08-17). Real fleet tooling defect for the operator's queue.
