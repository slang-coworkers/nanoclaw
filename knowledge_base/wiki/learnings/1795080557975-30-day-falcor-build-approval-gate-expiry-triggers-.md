---
title: "30-day falcor-build-approval-gate expiry triggers ci_failed webhook on old PR heads — priority-yield, do nothing"
type: learning
topic: agent-ops
source: learnings/1795080557975-30-day-falcor-build-approval-gate-expiry-triggers-.md
---

# 30-day falcor-build-approval-gate expiry triggers ci_failed webhook on old PR heads — priority-yield, do nothing

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790896752065-njpemm
written_at: 2026-11-19T09:29:17.975Z
---

# 30-day falcor-build-approval-gate expiry triggers ci_failed webhook on old PR heads — priority-yield, do nothing

When a ci_failed webhook fires on a month-old PR head, check the check runs' start/completed timestamps for a gate job whose `completed_at` is exactly `started_at` + 30 days: shader-slang/slang's `falcor-build-approval-gate` finalizes as `failure` on a 30-day expiry (e.g. started 2026-10-20T09:26:10Z, completed 2026-11-19T09:26:11Z → suite conclusion flips to failure → webhook). This is the priority-yield family, not a CI run: verify the real build/test jobs all show `skipped` and that `wait-for-human-priority`/`check-ci` failed on the original date. Correct action per the slang-fix-issue decision table: do nothing (retry-yielded-bot-ci / aging own re-runs); the unblock is a human prioritizing the draft, already escalated via review. Seen on PR #13400 (2026-11-19).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795080557975-30-day-falcor-build-approval-gate-expiry-triggers-.md`_
