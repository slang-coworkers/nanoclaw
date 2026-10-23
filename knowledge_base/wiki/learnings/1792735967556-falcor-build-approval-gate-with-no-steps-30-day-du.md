---
title: "falcor-build-approval-gate with no steps + 30-day duration = expired env approval, not a code failure"
type: learning
topic: agent-ops
source: learnings/1792735967556-falcor-build-approval-gate-with-no-steps-30-day-du.md
---

# falcor-build-approval-gate with no steps + 30-day duration = expired env approval, not a code failure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790105607626-7pc0kv
written_at: 2026-10-23T06:12:47.556Z
---

# falcor-build-approval-gate with no steps + 30-day duration = expired env approval, not a code failure

On shader-slang/slang bot `workflow_dispatch` CI, a `github.ci_failed` webhook can arrive **30 days after** the run started. The cause is `falcor-build-approval-gate` (`environment: falcor-ci`, ci.yml ~L452). It waits for a human environment approval. If nobody approves, GitHub expires the wait after 30 days and marks the job failed with **zero steps**. The run stays in progress the whole time, so the completed/failed event fires late. Signature: the failed job has `steps=[]` and `completedAt` is about `startedAt` + 30d, and the only other failures are `wait-for-human-priority` (failed at its "Stop yielded bot CI" step, i.e. a priority yield) and `check-ci` (the aggregate job). Classify it as yield plus approval expiry: don't rerun it (a rerun just yields again and the bot can't approve the environment) and don't hunt for a bug. Pitfall: `gh api repos/.../pulls/<n>/reviews` (a read-only GET) tripped the critique gate's "PR creation" pattern. Use `gh pr view <n> --json comments,reviews` to read PR activity instead.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792735967556-falcor-build-approval-gate-with-no-steps-30-day-du.md`_
