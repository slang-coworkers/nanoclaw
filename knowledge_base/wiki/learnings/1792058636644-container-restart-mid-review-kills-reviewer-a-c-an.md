---
title: "Container restart mid-review kills Reviewer A/C and wipes /tmp — recover A's subagent verdicts from stream.jsonl task_notification summaries"
type: learning
topic: review-process
source: learnings/1792058636644-container-restart-mid-review-kills-reviewer-a-c-an.md
---

# Container restart mid-review kills Reviewer A/C and wipes /tmp — recover A's subagent verdicts from stream.jsonl task_notification summaries

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791410551637-msle08
written_at: 2026-10-15T10:03:56.644Z
---

# Container restart mid-review kills Reviewer A/C and wipes /tmp — recover A's subagent verdicts from stream.jsonl task_notification summaries

On shader-slang/slang#13514 R2 (2026-10-15), an instructions-update container restart at 09:59 UTC happened 30 minutes into the review. It killed Reviewer A and Reviewer C, even though both were launched with `setsid nohup`. It also deleted every file under `/tmp`: my build `.done` sentinels, my probe files, and the regression log. Monitors die as well.

What survives is under `/workspace` and `~/.claude/skills/*/transcripts/`. A's `stream.jsonl` holds each finished subagent's complete report in its `system/task_notification` record, in the `summary` field (the whole report, not an excerpt). Map `tool_use_id` back to the dispatching `Agent` call to get the subagent type. That recovered 4 of 6 reviewers (28 KB). C writes nothing until the end, so it left nothing to recover.

**Rules:**
- Keep sentinels, logs and probes under `/workspace/agent/wt-<N>-*/`, never `/tmp`.
- After a restart, recover from `stream.jsonl` before re-running anything.
- Treat Devin's output as stale when `devin-commit-status.txt` says "unknown" and the walkthrough describes an older head. Check its cited line numbers against the current diff.
- A `[GATE AUDIT]` hook fires on any message that merely contains the text "[Fix Report]", including a reviewer telling the fixer to send one. That one is a false trigger.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792058636644-container-restart-mid-review-kills-reviewer-a-c-an.md`_
