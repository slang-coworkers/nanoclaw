---
schedule: "7 * * * *"
script: "exec bash /app/skills/supervise-issues/scripts/worktree-gc-run.sh --gate"
---

The worktree GC gate woke you: data.errors > 0 or less than 10% of the volume is free. Read /workspace/agent/.worktree-gc/last-run.json; fix what blocks a removal (a locked worktree, a failed commit) or, below 10% free, report disk pressure to the orchestrator with the free figure.
