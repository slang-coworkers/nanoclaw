---
title: "Reviewer A + C parallel isolation: use /workspace/agent/slang-clarity as C's REPO_ROOT"
type: learning
topic: review-process
source: learnings/1782586901771-reviewer-a-c-parallel-isolation-use-workspace-agen.md
---

# Reviewer A + C parallel isolation: use /workspace/agent/slang-clarity as C's REPO_ROOT

> **↪ Refined 2026-07-13 by [[1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s]]** — current runner: Reviewer **C** self-isolates into its own worktree; it's Reviewer **A** (repro.sh, `cd $REPO_ROOT`) that needs the isolated REPO_ROOT under concurrent runs. The A+C shared-checkout race below is real; the isolation now targets A. See the newer note.

# Reviewer A + C parallel isolation: use /workspace/agent/slang-clarity as C's REPO_ROOT

When running the /slang-pr-review workflow's Reviewer A (slang-pr-review-runner/compose-and-run.sh) and Reviewer C (slang-clarity-review-runner/run-clarity.sh) concurrently, both default `REPO_ROOT=/workspace/agent/slang` and each does `git fetch` + `git checkout -q origin/master` there during setup. Concurrent runs race on `.git/index.lock`/refs.

**Fix that worked:** point Reviewer C at the *separate existing clone* `/workspace/agent/slang-clarity` via `REPO_ROOT=/workspace/agent/slang-clarity bash .../run-clarity.sh ...`, leaving Reviewer A on the default `/workspace/agent/slang`. That clone already has `REVIEW.md` + `.claude/skills/slang-review-clarity-workflow` (clarity skills) and `origin=shader-slang/slang`, so it satisfies run-clarity.sh's preflight with no setup. Simpler than the git-worktree approach the prior learning suggested, and fully isolates the two checkouts.

**Why:** in `pr` mode neither script checks out the PR branch (the inner claude reads the diff via `gh pr diff`), so only the setup-phase fetch/checkout collides — separate dirs eliminate it. **How to apply:** any time you launch A and C as background jobs in the same session, give C its own checkout dir. Reviewer B (Devin) is unaffected (browser only, no git).

Also reconfirmed: `devin-fetch.sh` can exit 0 while Devin's analysis still shows "Generating..." (premature DONE match) — it captures only the PR-description echo with Bugs/Flags "(none reported)". Re-run after a few minutes; the second fetch got the real analysis (commit-status "Analysis is up to date"). Don't treat the first exit-0 as authoritative — verify the "## AI Analysis" body isn't "Generating...".

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782586901771-reviewer-a-c-parallel-isolation-use-workspace-agen.md`_
