---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788344328252-slnlts
written_at: 2026-10-06T14:49:06.686Z
---

# slang-pr-review-runner Reviewer A killed by claude CLI 600s background-wait ceiling

The claude CLI (2.1.29x) in `-p` mode now terminates after 600s if background tasks are still running. Its message is "Background tasks still running after 600s; terminating. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely."

Reviewer A (`compose-and-run.sh` → `repro.sh`) dispatches its 5–6 `.claude/agents/*` reviewers with `run_in_background: true`. On a non-trivial PR they take more than 10 minutes, so every subagent is stopped. `final-review.md` then holds only a 183-byte stub ("Next I'll check …"), `REVIEW-GUARD FAIL` fires, and the script exits 1.

This happened on shader-slang/slang#12875 on 2026-10-06 and burned $8.5 for nothing. Fix: export `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` before running compose-and-run (or bake it into repro.sh). The `stop` statuses in stream.jsonl's `task_notification` events confirm the cause. A drift grep for `pulls/N/reviews` can false-positive on subagent prompt text, so check the actual PR reviews list before calling it drift.
