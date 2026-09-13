---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789175919970-hqx6uc
written_at: 2026-09-12T14:07:49.725Z
---

# slang-pr-review-runner: shared checkout /workspace/agent/slang is contended — run Reviewer A in an isolated worktree to avoid wrong-diff INTEGRITY-FAIL

Running two `slang-pr-review-runner compose-and-run` passes (or an unrelated patch-mode review by another session) concurrently against the shared checkout `/workspace/agent/slang` can cause a **wrong-diff review**: the inner claude model, when the sandbox lets it read a pre-existing `tmp/pr-diff.patch`, reviews *that* stale patch instead of the intended PR. The runner's diff-integrity net catches it and exits 1 with `INTEGRITY-FAIL.txt` naming the mismatched files (e.g. reviewed `slang-ir-specialize.cpp` while PR #13027's files are `slang-ir-lower-copy-logical.*` / `slang-ir-spirv-legalize.cpp` / the test).

Observed on PR #13027 R2: the checkout was parked on an abandoned `patch-review-<ts>` branch and had a stale `tmp/pr-diff.patch` (from a #12766/#12608 patch-mode review) that a concurrent run re-created *after* compose-and-run's own `rm -f tmp/pr-diff.patch` guard. compose-and-run's guard only clears the artifact at run start; it does not protect against a concurrent writer mid-run.

**Fix / prevention (worked):** re-run Reviewer A in an **isolated git worktree** so it has its own working dir (no shared `tmp/`, no branch contention):
```
cd /workspace/agent/slang && git fetch --depth 50 origin master
git worktree add --detach /workspace/agent/wt-<pr>-rereview origin/master
REPO_ROOT=/workspace/agent/wt-<pr>-rereview bash .../slang-pr-review-runner/scripts/compose-and-run.sh --mode pr --pr <N> --repo <owner/repo> --max-budget-usd 30
git worktree remove /workspace/agent/wt-<pr>-rereview --force   # cleanup after
```
This works because `REVIEW.md` and the 6 `.claude/agents/*` are git-tracked (a master worktree has them), and pr-mode reviews the `gh pr diff` text (doesn't need the PR checked out). RUN_DIR still lands under the skill's own `transcripts/`, not REPO_ROOT.

**Notes:**
- Reviewer C (clarity) and Reviewer B (Devin) were NOT affected in the same incident — clarity fixes its diff hash up front and Devin scrapes the live PR page — so only Reviewer A needed the isolated re-run.
- Always name the worktree `wt-<pr>-<tag>` (the supervise-issues GC reaps by that convention). Only remove worktrees YOU created; the checkout carries many other sessions' `wt-*-verify` worktrees.
- Always verify a completed A run's `INTEGRITY-FAIL.txt` is absent and its `pr-diff.reference` diff hash matches the PR head before trusting `final-review.md`.
