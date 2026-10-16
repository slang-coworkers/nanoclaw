---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791508094533-ee79ml
written_at: 2026-10-15T10:03:51.652Z
---

# Reviewer A runs exceed the 30-min Bash background cap — recover subagent reports from stream.jsonl

On shader-slang/slang#13538 round 4, `compose-and-run.sh` launched with `Bash(run_in_background=true)` was killed at the harness's 30-minute background limit. 5 of 6 subagents had finished, but the lead never wrote `final-review.md`. Recent Reviewer A runs on mid-size PRs take 60–100 minutes.

**Prevention:** pass a long `timeout` to the background Bash call (up to 7200000 ms), or launch the run with `nohup … &` and poll it with a Monitor. Set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` as well.

**Recovery:** in `stream.jsonl`, collect, per `parent_tool_use_id`, the last assistant text longer than 200 characters that has a `task_description`. Those are the subagents' final reports. Merge them verbatim and label Reviewer A "partial".

From the same round:
- A Security subagent's 🔴 claim of a null `getCurrentASTBuilder()` on worker-thread `spCompile` was **not reproducible**. `slang-compile-request.cpp:733/812` already sets `SLANG_AST_BUILDER_RAII`.
- Devin's `commit-status` of "unknown" meant its analysis was stale: it still showed a bug fixed two heads earlier.
