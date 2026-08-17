---
title: "slang-pr-review: isolate Reviewer A and C with a git worktree + REPO_ROOT override"
type: learning
topic: review-process
source: learnings/1781121669041-slang-pr-review-isolate-reviewer-a-and-c-with-a-gi.md
---

# slang-pr-review: isolate Reviewer A and C with a git worktree + REPO_ROOT override

> **↪ Refined 2026-07-13 by [[1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s]]** — current runner: Reviewer **C** self-isolates into its own worktree; it's Reviewer **A** (repro.sh, `cd $REPO_ROOT`) that needs the isolated REPO_ROOT under concurrent runs. The A+C shared-checkout race below is real; the isolation now targets A. See the newer note.

# slang-pr-review: isolate Reviewer A and C with a git worktree + REPO_ROOT override

Running Reviewer A (`slang-pr-review-runner/scripts/compose-and-run.sh`) and Reviewer C (`slang-clarity-review-runner/scripts/run-clarity.sh`) in parallel in `pr` mode is safe if you give C its own working tree. Both scripts `cd "$REPO_ROOT"` and run `git fetch --depth 50 origin master` + `git checkout -q origin/master` on the SAME default `REPO_ROOT=/workspace/agent/slang`, which races the index/HEAD when concurrent.

**Concrete mechanism that worked (PR #11541, 2026-06-10):**
1. `cd /workspace/agent/slang && git worktree add --detach /workspace/agent/slang-clarity-wt origin/master` — a detached worktree off the *main* checkout. It shares the object store (so the working auth/remote and the already-fetched current `origin/master` are reused) and has its own index/HEAD, so C's `git checkout origin/master` never contends with A's.
2. Dispatch A normally (default REPO_ROOT = main checkout).
3. Dispatch C with `REPO_ROOT=/workspace/agent/slang-clarity-wt` prefixed — `run-clarity.sh` honors the `REPO_ROOT` env var (`REPO_ROOT="${REPO_ROOT:-/workspace/agent/slang}"`). It found REVIEW.md + `.claude/skills/slang-review-clarity-workflow` in the worktree (they're committed on master) and ran clean.
4. Cleanup: `git worktree remove --force /workspace/agent/slang-clarity-wt`.

**Why a worktree, not the existing `/workspace/agent/slang-clarity` clone:** that sibling is itself a registered worktree of the same `.git` but was on a STALE detached HEAD (5230a81) and its remote URL had an `x-access-token:placeholder@` that may block fetch. A fresh `git worktree add ... origin/master` off the main checkout guarantees current master (the PR base) with working auth.

Also: `rm -f /workspace/agent/slang/tmp/pr-diff.patch` before A runs (stale-diff/wrong-PR guard), and independently `gh pr diff <N> --name-only` to cross-check A reviewed the right files.

**Devin on a DRAFT PR:** `devin-fetch.sh` exited 0 and wrote devin-flags.md, but "AI Analysis" showed a "Generating…" marker and just echoed the PR body; Bugs/Flags = none. Treat draft-PR Devin output as best-effort/possibly-incomplete and say so in the verdict.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781121669041-slang-pr-review-isolate-reviewer-a-and-c-with-a-gi.md`_
