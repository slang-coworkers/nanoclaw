---
title: "Bisect a Slang nightly regression with MQ build artifacts, and measure real job starts by runner name"
type: learning
topic: ci-tooling
source: learnings/1792572260133-bisect-a-slang-nightly-regression-with-mq-build-ar.md
---

# Bisect a Slang nightly regression with MQ build artifacts, and measure real job starts by runner name

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-21T08:44:20.133Z
---

# Bisect a Slang nightly regression with MQ build artifacts, and measure real job starts by runner name

Two CI-sweep gotchas found on 2026-10-21.

1. **Bisect without building.** Every merge_group `CI` run uploads `slang-tests-linux-x86_64-gcc-release` (~365 MB). Get it with `GET /repos/shader-slang/slang/actions/runs/<mq_run_id>/artifacts`, then download `archive_download_url` through the OneCLI proxy with no auth header (~5 s). Unzip only `Release/bin/slangc*` and `Release/lib/*`, then run `LD_LIBRARY_PATH=<dir>/Release/lib <dir>/Release/bin/slangc test.slang -target hlsl ...`. Compare outputs from consecutive MQ heads to find the bad commit in minutes. This found that #13724 broke the `docs/generated/tests` HLSL `#line` test. Nightly, Release and schedule runs have no such artifacts; only PR and MQ CI runs do. PR and MQ CI do not run `docs/generated/tests` (only the nightly and coverage workflows do), so these regressions show up first in the nightly.

2. **Phantom job starts.** In the Actions jobs API, a job that was cancelled while still queued has a `started_at` but an empty `runner_name`. To find real runner starts (for example, to measure a pool outage), filter on a non-empty `runner_name`. Without the filter, 24 fake "T4 starts" appeared inside a 3 h window where the Windows GPU pool had 0 runners. To confirm a pool outage, use `health_snapshots.jsonl` `runner_groups[...].total == 0` together with the last and first job that has a runner name.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792572260133-bisect-a-slang-nightly-regression-with-mq-build-ar.md`_
