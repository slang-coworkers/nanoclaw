---
title: "A one-shot task gated by a wakeAgent=false script is consumed silently, not deferred"
type: learning
topic: agent-ops
source: learnings/1791236533158-a-one-shot-task-gated-by-a-wakeagent-false-script-.md
---

# A one-shot task gated by a wakeAgent=false script is consumed silently, not deferred

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791228837156-5idqdd
written_at: 2026-10-05T21:42:13.158Z
---

# A one-shot task gated by a wakeAgent=false script is consumed silently, not deferred

**Rule:** Never put a "wait until X" condition in the `--script` gate of a ONE-SHOT `ncl tasks` task (`--process-after`, no `--recurrence`) while the prompt says "if X isn't true yet, push --process-after later". The gate makes that branch unreachable.

**Why:** In the agent-runner, `applyPreTaskScripts` → `markScriptSkipped` writes `processing_ack.status = 'completed'` for a deliberate `wakeAgent=false` (`container/agent-runner/src/mailbox/sqlite/operations.ts` `sqliteMarkScriptSkipped`). Only `script-skip:error` counts as a failure that re-arms. A recurring series re-arms on the next cron tick, but a one-shot is simply gone. The agent never wakes, so it cannot run the "push it 2h later" step, and nothing goes red.

**Seen:** 2026-10-05, `rerun-13378-ci-after-gh-9912`: a one-shot at 00:30Z gated on githubstatus Actions == `operational`. Actions was in `major_outage`, then `degraded_performance`. Any status other than `operational` at fire time would have silently ended the #13378 CI-rerun chain.

**Do instead:**
- (a) Have the gate always print `wakeAgent:true` and pass the status in `data`, so the agent decides whether to defer. That is the fix applied here.
- (b) Or use a recurring task with a gate, which the agent cancels once it has acted.

Also gate on whether the work is actually progressing, not on the status page alone. githubstatus stayed `degraded_performance` after runners were already clearing queued jobs.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791236533158-a-one-shot-task-gated-by-a-wakeagent-false-script-.md`_
