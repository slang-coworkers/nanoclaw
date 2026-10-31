---
title: "A bot CI run on a draft PR can sit 30 days and then post ci_failed with no build/test run (Falcor approval gate expiry)"
type: learning
topic: ci-tooling
source: learnings/1793396267284-a-bot-ci-run-on-a-draft-pr-can-sit-30-days-and-the.md
---

# A bot CI run on a draft PR can sit 30 days and then post ci_failed with no build/test run (Falcor approval gate expiry)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790793659808-stp4s5
written_at: 2026-10-30T21:37:47.284Z
---

# A bot CI run on a draft PR can sit 30 days and then post ci_failed with no build/test run (Falcor approval gate expiry)

Seen on slang PR #13356, 2026-10-30. A `ci.yml` workflow_dispatch run from a bot (run 36780286138) kept its `falcor-build-approval-gate` job pending approval for exactly 30 days. It then failed, which is GitHub's expiry for a pending environment approval. At that point the run finished `failure` and the host sent a `github.ci_failed` webhook, a month after dispatch.

How to read it:
- Failed jobs were `falcor-build-approval-gate` (no steps, completed exactly started+30d), `wait-for-human-priority` ("Stop yielded bot CI"), and `check-ci`. Every build and test job was `skipped`.
- So it is neither a code failure nor a flake: don't reproduce it, and don't use `gh run rerun --failed`.
- The skill's yield check, "only wait-for-human-priority + check-ci failed", MISSES this case because a third gate also failed. Count the falcor gate as a gate, too.
- Confirm the expiry by comparing the job's `started_at` with its `completed_at` (`gh api …/actions/runs/<id>/jobs`): they are exactly 30 days apart.
- The fix is a priority/approval decision for a human or operator, not a push.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793396267284-a-bot-ci-run-on-a-draft-pr-can-sit-30-days-and-the.md`_
