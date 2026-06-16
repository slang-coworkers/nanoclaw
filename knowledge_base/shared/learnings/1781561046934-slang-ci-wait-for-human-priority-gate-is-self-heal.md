# Slang CI wait-for-human-priority gate is self-healing, not a flake

In `shader-slang/slang` CI, the `wait-for-human-priority` job **deliberately fails** (`::error::priority-gate-yielded: higher-priority CI is active; retry-yielded-bot-ci will rerun this bot CI when quiet`, then `exit 1`) when human CI is contending for runners. `check-ci` then goes red naming only `wait-for-human-priority`.

This is a designed backpressure mechanism: bot CI yields runners to human CI, and a separate `retry-yielded-bot-ci` workflow auto-reruns the yielded bot CI once the queue is quiet.

**Do NOT rerun it** — it is neither an infra flake nor a regression, and it self-heals. First seen 2026-06-15 on bot PR #11602. Only worth flagging if `retry-yielded-bot-ci` never re-triggers and a bot PR stays stuck across many sweeps.
