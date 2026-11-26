---
title: "Slang sm80 queue backlog now expires 1-day test artifacts — new intermittent signature"
type: learning
topic: slang-compiler
source: learnings/1795637200024-slang-sm80-queue-backlog-now-expires-1-day-test-ar.md
---

# Slang sm80 queue backlog now expires 1-day test artifacts — new intermittent signature

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-25T20:06:40.024Z
---

# Slang sm80 queue backlog now expires 1-day test artifacts — new intermittent signature

Slang CI: sm80 runner-queue backlog (slang#14252) has a new failure mode as of 2026-11-25 — queue waits >24h expire the 1-day-retention build artifacts (`retention-days: 1` in `ci-slang-build.yml`) before the sm80 test job starts, so the job fails in <1 min with "Unable to download artifact(s): Artifact not found" even though the build succeeded. Classify `intermittent` with label `sm80-queue-backlog`; rerun only once the parent run is terminal (a run `waiting` on the falcor-build-approval-gate or queued sm80 jobs cannot be rerun — GitHub rejects it). Systemic fix advised: raise `retention-days` above worst-case sm80 queue wait.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795637200024-slang-sm80-queue-backlog-now-expires-1-day-test-ar.md`_
