---
title: "Isolate Reviewer C in a git worktree for parallel /slang-pr-review runs"
type: learning
topic: review-process
source: learnings/1782876940783-isolate-reviewer-c-in-a-git-worktree-for-parallel-.md
---

# Isolate Reviewer C in a git worktree for parallel /slang-pr-review runs

> **↪ Refined 2026-07-13 by [[1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s]]** — current runner: Reviewer **C** self-isolates into its own worktree; it's Reviewer **A** (repro.sh, `cd $REPO_ROOT`) that needs the isolated REPO_ROOT under concurrent runs. The A+C shared-checkout race below is real; the isolation now targets A. See the newer note.

# Isolate Reviewer C in a git worktree for parallel /slang-pr-review runs

When running the `/slang-pr-review` workflow, Reviewer A (`compose-and-run.sh`) and Reviewer C (`run-clarity.sh`) both default to `REPO_ROOT=/workspace/agent/slang` and each does `git fetch origin master` + `git checkout -q origin/master` at startup. Running them concurrently on the *same* checkout risks a git `index.lock` / working-tree-checkout race.

**Fix:** point Reviewer C at an isolated checkout via `REPO_ROOT=<other>` env var. A lightweight `git worktree add --detach /workspace/agent/slang-cwork origin/master` off the main checkout works well — it shares the object store, checks out master (so REVIEW.md + `.claude/skills/slang-review-*` are present), and gives C its own index + working tree. Remove it in the Cleanup step with `git worktree remove --force`. Both reviewers read the PR diff via server-side `gh pr diff`, so base-commit drift between the two checkouts doesn't affect *what* is reviewed, only the surrounding source the model reads for context.

**Gotcha — slang-clarity is already a worktree:** `/workspace/agent/slang-clarity` is a *linked git worktree* of the main `/workspace/agent/slang` repo. Its `.git` is a **file** (a gitdir pointer), not a directory, so a naive `[ -d "$dir/.git" ]` check reports "NOT A GIT REPO" — a false negative. It's actually a valid, usable checkout; confirm with `git -C <dir> rev-parse --git-dir` or `git worktree list` from the main repo instead of testing for a `.git` directory. A future reviewer run could reuse the existing slang-clarity worktree for C's isolation rather than creating a new one (just re-checkout origin/master in it first).

**Devin (Reviewer B) is genuinely best-effort:** on a freshly-opened PR, `devin-fetch.sh` often returns no analysis (writes `devin-error.txt` "Devin did not complete within 30m" even when it exits in ~1 min) — the analysis panel never reaches a completed state. A and C are unaffected; mark B `_skipped_` in the combined report and move on.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782876940783-isolate-reviewer-c-in-a-git-worktree-for-parallel-.md`_
