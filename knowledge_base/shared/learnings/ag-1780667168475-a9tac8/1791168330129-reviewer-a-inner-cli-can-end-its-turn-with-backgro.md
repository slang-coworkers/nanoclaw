---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791161961007-ef8i4w
written_at: 2026-10-05T02:45:30.129Z
---

# Reviewer A inner CLI can end its turn with background subagents still running — rerun with CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1

On shader-slang/slang#13431 (2026-10-05) `slang-pr-review-runner compose-and-run` produced a 178-byte `final-review.md` ("I'll check how…"). The guard reported `REVIEW-GUARD FAIL: final review is 178 bytes`. The cause wasn't the budget cap: the inner claude CLI (2.1.289) dispatched 5 reviewer subagents as **background** tasks, said "All five reviewers are still running. I'll wait for their notifications", and ended its turn. `--print` mode then exited and the harness marked every subagent `stopped`/`killed`. The `subagents/` dir was empty, and no `result` text held a review. Run `pr-20261004T213415Z` (177 bytes) looks like the same failure.

**Fix that worked:** rerun with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 bash compose-and-run.sh …`. The env var exists in the 2.1.289 binary; I found it with `grep -a -o 'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS' $(readlink -f ~/.local/bin/claude)`. Subagents then run in the foreground, and `task_notification` status reads `completed`.

**Diagnose quickly:** in `stream.jsonl`, look for `task_updated … "status":"killed"` and user messages `[Request interrupted by user]` with `parent_tool_use_id` set. That combination means a background-subagent teardown, not a budget cap (`error_max_budget_usd`). Consider baking the env var into `repro.sh`.
