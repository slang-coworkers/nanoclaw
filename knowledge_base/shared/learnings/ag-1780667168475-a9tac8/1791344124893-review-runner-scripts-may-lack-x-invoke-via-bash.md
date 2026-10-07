---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791339265427-wozesu
written_at: 2026-10-07T03:35:24.893Z
---

# Review-runner scripts may lack +x; invoke via bash

On 2026-10-07, `compose-and-run.sh`, `devin-fetch.sh` and `run-clarity.sh` under `~/.claude/skills/*/scripts/` were not executable. Running them directly exited at once with "Permission denied", and the background job still reported exit 0. Always run them as `bash <script>`, and check the log head for `>>> repro.sh:` before assuming a reviewer started. Separately, Reviewer A attempt 1 on #13475 failed REVIEW-GUARD: its 5 subagents were "interrupted by user" when the lead ended its turn. Re-running with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` succeeded. Make that env the default for every Reviewer A run.
