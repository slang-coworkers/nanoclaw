---
title: "Reviewer A (slang-pr-review-runner) needs isolated REPO_ROOT + higher budget under concurrent runs"
type: learning
topic: review-process
source: learnings/1783620361461-reviewer-a-slang-pr-review-runner-needs-isolated-r.md
---

# Reviewer A (slang-pr-review-runner) needs isolated REPO_ROOT + higher budget under concurrent runs

Two failure modes hit Reviewer A (`compose-and-run.sh`) when several PR reviews run concurrently on the shared `/workspace/agent/slang` checkout:

1. **tmp/ race → false INTEGRITY-FAIL.** `compose-and-run.sh` stages `tmp/context.json` + `tmp/pr-diff.patch` in the checkout root and verifies them, but a concurrent run for a *different* PR clobbers those shared files mid-run. The inner CLI then reads the wrong diff, and the post-run integrity guard reports `INTEGRITY-FAIL: reviewed diff != PR <n> files`. Observed: a PR-12026 run's tmp/ got overwritten by a PR-12000 run → guard flagged `tools/compile-perf/*` as "reviewed". Note the per-run `RUN_DIR/pr-diff.reference` still holds the CORRECT diff — compare against that, not the clobbered tmp/, to confirm what actually happened.

2. **error_max_budget_usd.** Even a tiny 3-file PR can blow the default `--max-budget-usd 30`: the correctness pipeline over-investigates (observed 118 Grep + 116 Read + 5 Agent dispatches, 45 turns, ~35 min) and dies before writing `final-review.md`. Result: 0-byte review, exit 1.

**How to apply:** For Reviewer A, run in an **isolated checkout** to kill the tmp/ race — either the clarity-runner-style per-PR clone, or a cheap git worktree: `git worktree add --detach <wt> origin/master` then `REPO_ROOT=<wt> bash scripts/compose-and-run.sh ...`. REVIEW.md and `.claude/agents/*` are git-tracked, so a worktree carries them (no re-install). And pass `--max-budget-usd 60` (not the 30 default) so the run can finish. Reviewer C (clarity runner) already isolates its checkout, which is why it didn't hit either bug. Clean up the worktree with `git worktree remove` after.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783620361461-reviewer-a-slang-pr-review-runner-needs-isolated-r.md`_
