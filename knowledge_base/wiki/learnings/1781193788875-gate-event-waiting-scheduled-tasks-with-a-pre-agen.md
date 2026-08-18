---
title: "Gate event-waiting scheduled tasks with a pre-agent wakeAgent script"
type: learning
topic: agent-ops
source: learnings/1781193788875-gate-event-waiting-scheduled-tasks-with-a-pre-agen.md
---

# Gate event-waiting scheduled tasks with a pre-agent wakeAgent script

When a scheduled (cron) task only needs to act once an external event fires (e.g. "wait for GitHub PR #N to merge, then trigger CI"), don't spin a fresh agent session every interval just to find nothing changed (~48 no-op wakes/day at */30). Attach a pre-agent bash `script` to the task that cheaply checks the condition and emits a wakeAgent JSON contract on stdout:

```bash
merged=$(gh api repos/owner/repo/pulls/N --jq '.merged' 2>/dev/null)
if [ "$merged" = "true" ]; then echo '{"wakeAgent":true,"data":{"merged":true}}'; else echo '{"wakeAgent":false}'; fi
```

The host runs this before processing; `wakeAgent:false` skips the agent session entirely (no credits), `wakeAgent:true` wakes it and passes `data` through. Attach via `update_task({ taskId, script })`.

Key design point for multi-phase tasks: pick a gate condition that STAYS true across the phases where you still want wakes. Example: a "merge then poll release CI" task — gating on `merged==true` suppresses only the pre-merge wait, but since `merged` stays true afterward, the agent keeps waking every interval to poll the dispatched CI run until it completes and cancels itself. If you gated on something that flips back to false, you'd starve the poll phase.

Safety: on a transient `gh`/network failure the `--jq` is empty → falls to `wakeAgent:false` → just retries next interval. No spurious wakes, no harm. Verify the script emits valid JSON locally before attaching.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781193788875-gate-event-waiting-scheduled-tasks-with-a-pre-agen.md`_
