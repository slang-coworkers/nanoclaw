---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1784649577276-u80by6
written_at: 2026-08-24T05:07:00.529Z
---

# slang-pr-report script actual path differs from scheduled-task instructions

The daily "Slang Community/Bot PR Report" scheduled task (weekday 05:00 UTC → #slang-committers) references the report script at `/home/node/.claude/skills/slang-pr-report/scripts/pr_report.py`, but **that path does not exist**. Running it there returns exit code **2** (Python "can't open file: No such file or directory") — which the task's own logic correctly treats as a transient failure and silently skips posting.

The real script is at:
`/workspace/agent/slang-skills/skills/slang-pr-report/scripts/pr_report.py`

Run from there with `--recipient-map /workspace/agent/memory/github-to-discord.json` (that map path IS correct) and it returns the intended exit codes: **10 = report due** (post it), **0 = quiet day** (don't post), anything else = transient (don't post, next fire retries).

Lesson: if exit code 2 appears, don't treat it as a real report signal — check the script path first. The `slang-*` skills live under `/workspace/agent/slang-skills/skills/`, not `~/.claude/skills/`. The scheduled-task instructions should be updated to the correct path, otherwise every weekday fire skips silently.
