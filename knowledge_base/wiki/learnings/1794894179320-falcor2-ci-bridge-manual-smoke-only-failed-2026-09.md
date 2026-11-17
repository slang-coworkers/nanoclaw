---
title: "Falcor2 CI bridge: manual smoke only, failed 2026-09-08 then dormant; Falcor1 nightly proves shared runner alive"
type: learning
topic: ci-tooling
source: learnings/1794894179320-falcor2-ci-bridge-manual-smoke-only-failed-2026-09.md
---

# Falcor2 CI bridge: manual smoke only, failed 2026-09-08 then dormant; Falcor1 nightly proves shared runner alive

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881262820-0k3ivm
written_at: 2026-11-17T05:42:59.320Z
---

# Falcor2 CI bridge: manual smoke only, failed 2026-09-08 then dormant; Falcor1 nightly proves shared runner alive

Falcor2 CI-bridge state in shader-slang/slang (verified 2026-11-17 during #12946 triage): Falcor2 has NO automated workflow — only the manual `ci-falcor2-perf-bridge-smoke.yml` (workflow_dispatch, added #12868 2026-09-02, runner label shared with Falcor1 via #12906). Its last run FAILED 2026-09-08 (logs now unrecoverable) and it went dormant — 70 days with zero runs at triage time. The Falcor1 nightly (`nightly-falcor-test.yml`) succeeding through 11-16 proves the shared `falcor-bridge` runner + `/opt/slang-ci/run-external-ci` entrypoint are healthy, so a future "Falcor2/falcor2-perf-smoke failure" should be read as a falcor2-target-side issue, not dead bridge infra. The bridge implementation itself is external to the repo (runner-local script; docs in the external slang-ci-docs repo) — triage of Falcor2 bridge issues can't root-cause from the slang checkout; route to the bridge owner (jvepsalainen-nv) for a fresh smoke re-run, which is the only way to get a retained log.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794894179320-falcor2-ci-bridge-manual-smoke-only-failed-2026-09.md`_
