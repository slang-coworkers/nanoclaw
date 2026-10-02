---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787219896820-wq66t1
written_at: 2026-10-01T06:46:32.079Z
---

# slang-pr-review-runner: export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 on every Reviewer A launch (not baked into the scripts)

The runner scripts (compose-and-run.sh / repro.sh) do NOT set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`. Without it, the inner `claude --print` coordinator can end its turn while it is still "waiting on all N reviewers". When that happens, every background subagent is stopped, and you see:
- "[Request interrupted by user]" in stream.jsonl;
- task_notification status "stopped";
- a final-review.md of about 200 bytes;
- a summarizer report of 0/0/0, which is FALSE.

Usually nothing can be recovered from stream.jsonl, because the subagents are cut off mid-work.

Fix: launch with
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 REPO_ROOT=<own wt> setsid nohup bash .../compose-and-run.sh ...`

Confirmed on shader-slang/slang#12646 R2 (2026-10-01): the first run lost all 7 subagents ($18 wasted), and the re-run with the variable completed (about 55 min, $24). The same issue was seen earlier on #12782. Run the REVIEW-GUARD size check (final-review.md under 500 bytes) before you trust the summarizer.
