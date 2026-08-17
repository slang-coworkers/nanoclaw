---
title: "Slang PR review: concurrent runs clobber shared checkout tmp/, causing wrong-PR reviews"
type: learning
topic: slang-compiler
source: learnings/1784771691413-slang-pr-review-concurrent-runs-clobber-shared-che.md
---

# Slang PR review: concurrent runs clobber shared checkout tmp/, causing wrong-PR reviews

**Symptom:** Reviewer A (slang-pr-review-runner compose-and-run.sh) finishes with `INTEGRITY-FAIL.txt` in its run dir and NO `final-review.md`. The `INTEGRITY-FAIL.txt` shows "reviewed:" files that belong to a *different* PR than the one requested.

**Root cause:** `compose-and-run.sh` defaults `REPO_ROOT=/workspace/agent/slang` (the shared checkout) and stages the diff to `$REPO_ROOT/tmp/pr-diff.patch` + `tmp/pr-files.txt` + `tmp/context.json`. If a SECOND review run (different PR) starts on the same shared checkout while the first is mid-flight, the second's `rm -f tmp/pr-diff.patch` + re-stage CLOBBERS the shared path. The first run's already-dispatched subagents then read the WRONG PR's diff. The runner's built-in integrity check (compares reviewed `+++ b/` paths vs actual PR files) catches it and refuses to emit final-review.md — good, but the run is wasted (~20 min).

**Confirmed by:** `tmp/context.json` showing the OTHER PR's number/head_sha; a sibling clarity transcript `pr-pr<OTHER>-...` with an overlapping timestamp; the model's own note in stream.jsonl ("clobbers the first's artifacts mid-review, so already-dispatched reviewer subagents silently read the WRONG PR's diff").

**Fix — run Reviewer A in an isolated git worktree:** `git worktree add --detach /workspace/agent/wt-<PR>-reviewA <base-sha>` then `REPO_ROOT=/workspace/agent/wt-<PR>-reviewA bash scripts/compose-and-run.sh ...`. The worktree has its own private `tmp/`, immune to clobbering by concurrent runs on the shared checkout. Follows the `wt-<pr>-<tag>` naming convention the supervisor's worktree GC reaps. Reviewer C (clarity runner) already isolates via its own `wt-clarity-*` worktree, so only Reviewer A (correctness) is exposed to this race by default.

**Note:** `tmp/rv<PR>/pr-diff.patch` (the model's own isolated copy) may hold the CORRECT diff even after the failure — but the subagents read the shared `tmp/pr-diff.patch`, not the isolated one, so that doesn't save the run.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784771691413-slang-pr-review-concurrent-runs-clobber-shared-che.md`_
