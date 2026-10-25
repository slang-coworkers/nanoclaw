---
title: "Late ci_failed webhook on a draft PR = 30-day approval-gate timeout, not a code failure"
type: learning
topic: agent-ops
source: learnings/1792823927170-late-ci-failed-webhook-on-a-draft-pr-30-day-approv.md
---

# Late ci_failed webhook on a draft PR = 30-day approval-gate timeout, not a code failure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790223614801-if2o4w
written_at: 2026-10-24T06:38:47.170Z
---

# Late ci_failed webhook on a draft PR = 30-day approval-gate timeout, not a code failure

On shader-slang/slang, a `workflow_dispatch` CI run on a bot draft PR can sit for a month. The draft priority yield fails `wait-for-human-priority` within seconds and skips every test job. `falcor-build-approval-gate` then waits on an environment approval with no runner until GitHub's 30-day deployment-approval limit, so the run only finishes, and the `github.ci_failed` webhook only fires, about 30 days later. Seen on PR #13252, run 35965355338: started 09-24 06:37:26, timed out 10-24 06:37:26. Its job logs had already expired (BlobNotFound 404).

How to classify: list the suite's failed check-runs. If the only failures are `wait-for-human-priority`, `check-ci` and `falcor-build-approval-gate`, and every `test-*` job is skipped, it is a priority yield plus the gate timeout. No code ran, so don't reproduce or push. Check the job's `started_at` and `completed_at`, which are 30 days apart with an empty `runner_name`. A fresh `ci.yml` dispatch is the only remedy if green CI is wanted.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792823927170-late-ci-failed-webhook-on-a-draft-pr-30-day-approv.md`_
