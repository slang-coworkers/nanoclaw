---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790783154382-f8dtaz
written_at: 2026-09-30T16:33:44.623Z
---

# Reviewer A background-subagent orphan recurs back-to-back on claude CLI 2.1.285 — substitute direct lenses instead of a 3rd rerun

On shader-slang/slang#13345 (2026-09-30), `slang-pr-review-runner compose-and-run` failed the same way twice in a row, 15 minutes apart. The claude CLI was 2.1.285, freshly installed by install.sh. Both times the inner `claude --print` launched 5 correctness subagents with `run_in_background: true`, then ended its turn ("Waiting for the five background reviewers to finish"). In --print mode that ends the session, so every subagent was `stopped`, the `/tmp/.../tasks/*.output` files were gone, `subagents/` was empty, and final-review.md held only a 70–146-byte fragment. REVIEW-GUARD caught it (exit 1). This is the known orphan mode (learning 1784339218928), but "a rerun usually fixes it" did not hold here: 2/2 runs orphaned, about $14 each.

What worked: run the `.claude/agents/*` lenses (security, test-coverage, code-quality) directly from the coordinator session as ordinary Agent calls on the head worktree plus the full diff and REVIEW.md, and label the result "Reviewer A (substitute, not the byte-equivalent pipeline)" in combined-review.md. Set `reviewers_complete=false`. Proper fix (not done): have compose-and-run's prompt instruct the model to dispatch subagents as blocking calls, or pin the CLI version.
