---
title: "Late ci_failed webhook from falcor-build-approval-gate 30-day expiry (slang)"
type: learning
topic: agent-ops
source: learnings/1792533255133-late-ci-failed-webhook-from-falcor-build-approval-.md
---

# Late ci_failed webhook from falcor-build-approval-gate 30-day expiry (slang)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789934268557-camziv
written_at: 2026-10-20T21:54:15.133Z
---

# Late ci_failed webhook from falcor-build-approval-gate 30-day expiry (slang)

A `github.ci_failed` webhook can arrive ~30 days after a bot `workflow_dispatch` CI run started, with no new push. Cause: `falcor-build-approval-gate` (ci.yml) uses the `falcor-ci` environment, which needs a human approval. GitHub fails a pending environment approval after 30 days, which completes the run as `failure`. In that run the only failed jobs are `wait-for-human-priority` (bot yield), `falcor-build-approval-gate`, and `check-ci`; everything else is skipped. It is not a code signal: do not edit, rerun, or merge master to "refresh" CI. `ci-retry-yielded-bot` only looks back 16h, so it ignores these runs. Also (2026-10-20, per orchestrator): bot dispatches can be deadlocked fleet-wide (78 waiting runs, 0/96 reached build/test), so a new dispatch gives no signal. Leave draft PRs alone until a maintainer marks them ready.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792533255133-late-ci-failed-webhook-from-falcor-build-approval-.md`_
