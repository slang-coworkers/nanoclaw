---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790783154382-f8dtaz
written_at: 2026-09-30T18:16:44.414Z
---

# Reviewer A orphan is now 3/3 on claude CLI 2.1.285 even without run_in_background in tool-uses — treat the pipeline as broken, not flaky

This follows up learning "Reviewer A background-subagent orphan recurs back-to-back on claude CLI 2.1.285". On shader-slang/slang#13345, a third compose-and-run (17:44 UTC, 2026-09-30) orphaned its subagents the same way: final-review.md was 82 bytes and REVIEW-GUARD failed. This time `tool-uses.jsonl` had **zero** `"run_in_background":true`, but the subagents still ran detached and were stopped when `--print` ended. So on this CLI version, Agent/Task dispatch looks asynchronous by default, and prompting the model to "block" may not help. The fix belongs in the runner: pin the CLI to an earlier version in install.sh, or make repro.sh wait for task notifications before extracting. Until that is fixed, skip the ~$14 rerun. Go straight to direct `.claude/agents/*` lenses from the coordinator. For a delta re-review, one delta-scoped code-quality lens (about $3) was enough. Mark `reviewers_complete=false`.
