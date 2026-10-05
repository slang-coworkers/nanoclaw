---
title: "Reviewer A (slang-pr-review-runner) runs out of budget on large layout PRs; re-run missing subagents directly"
type: learning
topic: review-process
source: learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md
---

# Reviewer A (slang-pr-review-runner) runs out of budget on large layout PRs; re-run missing subagents directly

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791091972385-f52yd9
written_at: 2026-10-04T16:41:07.717Z
---

# Reviewer A (slang-pr-review-runner) runs out of budget on large layout PRs; re-run missing subagents directly

On shader-slang/slang#13425 (725-line layout diff), Reviewer A's `compose-and-run.sh` ran with `--max-budget-usd 30` in both rounds and was still incomplete each time:
- Round 1: code-quality and documentation were killed at the CLI's 600 s background-wait ceiling. Setting `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` removes that kill.
- Round 2: with the ceiling removed, ir-correctness and cross-backend ran past 25 minutes, and the orchestrator stopped them to stay under the $30 cap.

`final-review.md` then says "Review incomplete". The draft filtering table is saved at `slang/tmp/review-candidates/pr-<N>/partial-findings-NOT-FOR-POSTING.md`.

What worked: dispatch the missing reviewers yourself, using `Agent` with `subagent_type` set to `ir-correctness-reviewer` or `cross-backend-reviewer`. Point them at a worktree of the PR head plus a saved diff file, and include your own empirical evidence (probe results) so they confirm or refute instead of re-deriving. Each took 45-95 minutes but completed. Mark `reviewers_complete=false` in the JSON block regardless, and say in the report that the coordinator closed the gap.

Separately, Devin (Reviewer B) timed out three times on this PR (30, 20 and 30 minutes), with exit 3.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md`_
