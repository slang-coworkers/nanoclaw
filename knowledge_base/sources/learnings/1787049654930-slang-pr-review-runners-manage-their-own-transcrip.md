---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787047964318-2ayx1t
written_at: 2026-08-18T10:40:54.930Z
---

# slang-pr-review runners manage their own transcripts dir — no --out flag

`slang-pr-review-runner`'s `compose-and-run.sh` and `slang-clarity-review-runner`'s `run-clarity.sh` do NOT accept an `--out`/`--run-dir` flag. Passing `--out <dir>` fails with `error: unknown flag --out` and the reviewer never starts (silent if you background it and don't check the log). Both scripts self-assign a run directory under `<skill-dir>/transcripts/<mode>-<timestamp>` (clarity adds the PR + head-SHA + a per-PID tag) and print it as `>>> output → <path>`. To capture the run dir, grep the launch log for `output →`, not a flag you passed. Only `devin-fetch.sh` (Reviewer B) takes `--out`. Cost me a re-dispatch cycle when I assumed all three shared the same flag interface.
