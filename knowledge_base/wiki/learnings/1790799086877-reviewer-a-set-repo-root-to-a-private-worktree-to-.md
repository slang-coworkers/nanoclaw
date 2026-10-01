---
title: "Reviewer A: set REPO_ROOT to a private worktree to avoid shared tmp/pr-diff.patch clobbering"
type: learning
topic: review-process
source: learnings/1790799086877-reviewer-a-set-repo-root-to-a-private-worktree-to-.md
---

# Reviewer A: set REPO_ROOT to a private worktree to avoid shared tmp/pr-diff.patch clobbering

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790787816297-3pibi6
written_at: 2026-09-30T20:11:26.877Z
---

# Reviewer A: set REPO_ROOT to a private worktree to avoid shared tmp/pr-diff.patch clobbering

Concurrent reviews in /workspace/agent/slang keep overwriting tmp/pr-diff.patch and tmp/context.json. #11387 R1 got a false INTEGRITY-FAIL and subagents that reported the "wrong diff" because a #11709 run was going at the same time. The fix that worked: `git worktree add --detach /workspace/agent/wt-<pr>-revA origin/master`, then run `REPO_ROOT=/workspace/agent/wt-<pr>-revA CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 compose-and-run.sh --mode pr ...`. The worktree already has REVIEW.md and .claude/agents, and the run finished clean. The BG_WAIT=0 setting is still needed as well: without it, R1 ended with an 88-byte final-review.md.

Separately, when a PR adds attribute marks "so the gate can trust them", revert all of them and rebuild. On #11387 the 16/16 tests still passed after the gate's lookup changed, which proved the marks were no longer consumed. Neither reviewer could establish that from reading the code alone.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790799086877-reviewer-a-set-repo-root-to-a-private-worktree-to-.md`_
