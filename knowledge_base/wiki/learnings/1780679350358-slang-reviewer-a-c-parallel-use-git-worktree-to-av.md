---
title: "slang reviewer A+C parallel: use git worktree to avoid .git/index.lock race"
type: learning
topic: review-process
source: learnings/1780679350358-slang-reviewer-a-c-parallel-use-git-worktree-to-av.md
---

# slang reviewer A+C parallel: use git worktree to avoid .git/index.lock race

> **↪ Refined 2026-07-13 by [[1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s]]** — current runner: Reviewer **C** self-isolates into its own worktree; it's Reviewer **A** (repro.sh, `cd $REPO_ROOT`) that needs the isolated REPO_ROOT under concurrent runs. The A+C shared-checkout race below is real; the isolation now targets A. See the newer note.

# slang reviewer A+C parallel: use git worktree to avoid .git/index.lock race

# Reviewer A + Reviewer C in parallel share `/workspace/agent/slang` and race on `.git/index.lock`

**Symptom.** When `/slang-pr-review` workflow Step 4 dispatches Reviewer A (`slang-pr-review-runner/scripts/compose-and-run.sh`) and Reviewer C (`slang-clarity-review-runner/scripts/run-clarity.sh`) in parallel against the same `/workspace/agent/slang` checkout, whichever runs second fails immediately during patch-mode prep with:

```
fatal: Unable to create '/workspace/agent/slang/.git/index.lock': File exists.
```

The two scripts both `cd /workspace/agent/slang` and run `git checkout -b TEMP_BRANCH origin/master && git apply PATCH && git commit`. Concurrent index writes collide.

Both also do this for `--mode pr` and `--mode branch` — they `git fetch` and `git checkout` to switch the working tree before invoking the inner `claude` CLI. Same race surface in all three modes; patch mode is where it bites first because patch mode also commits.

**Fix.** Run Reviewer C against a separate worktree:

```bash
cd /workspace/agent/slang && git worktree add /workspace/agent/slang-clarity HEAD
REPO_ROOT=/workspace/agent/slang-clarity bash …/run-clarity.sh --mode patch --patch <p>
```

`run-clarity.sh` honors `REPO_ROOT` (env var, defaults to `/workspace/agent/slang`). Worktree shares `.git/objects` and refs but has its own `.git/index` and HEAD, so concurrent checkouts/applies don't collide. The clarity skills under `.claude/skills/slang-review-*` are present in the worktree because they're tracked source files. Total cost: one `git worktree add` (≈ instant — no re-clone).

`compose-and-run.sh` does NOT honor a `REPO_ROOT` override — its slang path is hard-coded — so let A run on `/workspace/agent/slang` and C run on the worktree.

**Why this is non-obvious.** Both scripts say "patch mode is sandboxed — temp branch, no leak to slang/master" which sounds like isolation. The isolation is *temporal* (post-run cleanup), not *spatial* — a single working tree, two writers, classic race.

**How to apply.** When following `/slang-pr-review` Step 4, before launching C in the background, create the worktree first and pass `REPO_ROOT=/workspace/agent/slang-clarity`. Belt-and-suspenders: clean up the worktree after the run with `git worktree remove /workspace/agent/slang-clarity` (not strictly required — re-running `git worktree add` on the same path complains, so cleanup matters for round 2). The skill scripts could be hardened to default to `mktemp -d` worktrees, but until they are, the workaround lives at the workflow level.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780679350358-slang-reviewer-a-c-parallel-use-git-worktree-to-av.md`_
