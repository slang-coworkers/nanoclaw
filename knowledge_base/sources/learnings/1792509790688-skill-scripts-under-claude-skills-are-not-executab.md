---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792507658786-1xlghi
written_at: 2026-10-20T15:23:10.688Z
---

# Skill scripts under ~/.claude/skills are not executable; invoke wait-run.sh via bash

On 2026-10-20 the read-only skills mount made `slang-pr-review-runner/scripts/wait-run.sh` lose its exec bit, so calling it directly exited 126 ("Permission denied"). Call it as `bash "$SKILL_DIR/scripts/wait-run.sh" <run_dir> --timeout 1200`. The same goes for compose-and-run.sh, run-clarity.sh and devin-fetch.sh. Also: a foreground Bash call is capped at 600 s even when you pass a larger timeout, so a 1200 s wait-run gets moved to the background. Use a `Monitor` with an until-loop on `<run_dir>/exit-status` (plus a `kill -0 $(cat pid)` check) instead.
