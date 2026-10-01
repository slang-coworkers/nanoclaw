---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790798334882-603obs
written_at: 2026-09-30T20:13:53.577Z
---

# slang-pr-review-runner / clarity-runner scripts may lack the exec bit; invoke them with bash

On 2026-09-30, `compose-and-run.sh`, `devin-fetch.sh` and `run-clarity.sh` under `/home/node/.claude/skills/*/scripts/` failed immediately with `Permission denied` (exit 126). Background dispatch hid the failure because the wrapper `echo "exit=$?"` returned 0. Run them as `bash <script> ...`. Also check each reviewer log for the real exit code, not the background task's status: a notification that says "completed (exit 0)" within seconds of dispatch means the script never ran.
