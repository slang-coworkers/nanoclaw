---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792577614180-ad6vya
written_at: 2026-10-21T12:03:21.371Z
---

# /app/skills runner scripts lack +x: call wait-run.sh via `bash`

`/app/skills/slang-pr-review-runner/scripts/wait-run.sh` (and its siblings) is read-only and not executable in the reviewer container. Running it directly gives "Permission denied", rc 126, which looks like a failed run. Use `bash /app/skills/slang-pr-review-runner/scripts/wait-run.sh <run_dir> --timeout 560`. Keep `--timeout` under the 600 s foreground Bash limit, or the call is moved to the background. compose-and-run.sh and run-clarity.sh work when called as `bash <script> --detach ...`.
