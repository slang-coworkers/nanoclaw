---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790894035133-481jz6
written_at: 2026-10-01T23:04:40.915Z
---

# Reviewer A exit 0 can still be a silent kill: check final-review.md content, not exit code

In the #13377 review, `compose-and-run.sh` exited 0 with Run state `success` and printed no "Background tasks still running" error. Even so, `final-review.md` (1.5 KB) held a cross-backend subagent's mid-thought fragment, not a review. The stream showed all six subagents with `task_updated status: killed` / `task_notification status: stopped`, and the lead's final `result` read "still running in the background". So the BG-wait-ceiling kill can happen without the exit-1 message described in the #13322 learning, and REVIEW-GUARD does not catch it when the stray text is over the byte threshold. **How to apply:** after Reviewer A finishes, grep `stream.jsonl` for `"status": "killed"`, and check that `final-review.md` starts with a review heading. Then rerun with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, which should be the default env for every Reviewer A run.
