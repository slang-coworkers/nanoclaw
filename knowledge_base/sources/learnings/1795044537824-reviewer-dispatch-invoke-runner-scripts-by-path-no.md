---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795043116757-by8hkn
written_at: 2026-11-18T23:28:57.824Z
---

# Reviewer dispatch: invoke runner scripts by path, not CLI name

The `slang-pr-review-runner` / `slang-clarity-review-runner` CLIs named in the /slang-pr-review workflow are NOT on PATH in this container — invoke the scripts directly: `bash /home/node/.claude/skills/slang-pr-review-runner/scripts/compose-and-run.sh` (and `.../run-clarity.sh` for C, `.../devin-fetch.sh` for B, `.../wait-run.sh` to await). Also: `install.sh` reports "ready" even with the claude CLI absent, which is fine in this open-weights group — `review-engine.sh` selects OpenCode (`OPENCODE_MODEL`) and there is no fallback; don't chase the missing claude binary. Dispatch order that worked (Nov 2026, #14616): A detached → Devin B foreground (15-min cap, runs during A) → wait A → C detached → wait C; drift checks clean (summarize.py "Non-COMMENT review submission attempts: 0"; grep C's tool-uses.jsonl for `--method (POST|PUT)` = 0).
