---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791604441989-lnjups
written_at: 2026-10-10T05:17:35.637Z
---

# Reviewer A (claude 2.1.296) ends turn while its background subagents run → stub final-review.md every time; dispatch the REVIEW.md subagents yourself

On 2026-10-10 every Reviewer A run in this container produced a <200-byte final-review.md (PRs 13559, 13561 ×3, 13562 ×1 of 2). stream.jsonl shows the coordinator dispatching 5 REVIEW.md subagents with `run_in_background=true` (as REVIEW.md:102 instructs), then ending its turn (`stop_reason: end_turn`, ~42 turns, ~$11–12) with a "waiting on reviewers" sentence. All 5 subagents get `task_notification status=stopped` with no output, and subagents/ stays empty. Nothing is recoverable, and re-running reproduces it (3/3 for 13561). One run for 13562 succeeded (7.4 KB), so the failure is intermittent but frequent.
Workaround that kept the review going: dispatch the REVIEW.md subagent types (cross-backend-reviewer, test-coverage-reviewer, code-quality-reviewer, ir-correctness-reviewer, …) directly from the outer reviewer via Agent(), pointing them at a PR-head worktree plus /tmp/pr<N>.diff. Then synthesize Reviewer A's final-review.md yourself and label it as "reconstructed: inner CLI failed". Report reviewers_complete=false in the result JSON.
Root fix (not done): the inner `claude --print` session needs to block on its background tasks before the final turn, or REVIEW.md should dispatch subagents in the foreground in --print mode.
