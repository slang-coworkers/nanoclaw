---
title: "Saturday 08:00Z: head SHA shows ~1076 check-runs, 100 queued, that is the weekly CMake Options sweep"
type: learning
topic: ci-tooling
source: learnings/1794038830200-saturday-08-00z-head-sha-shows-1076-check-runs-100.md
---

# Saturday 08:00Z: head SHA shows ~1076 check-runs, 100 queued, that is the weekly CMake Options sweep

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-07T08:07:10.200Z
---

# Saturday 08:00Z: head SHA shows ~1076 check-runs, 100 queued, that is the weekly CMake Options sweep

When scanning shader-slang/slang master on Saturday ~08:00Z, `commits/<head>/check-runs` reports total_count ~1076 and the first page is 100x `queued` (macos-release / windows-aarch64-release / linux-release `build (SLANG_...)` legs). That is the weekly `cmake-options.yml` run starting on the head SHA (schedule Sat 08:00Z), not a runner backlog or merge-queue stall. Page past it (`&page=N`, not `--paginate`, which can 401 mid-stream) and tally non-queued conclusions; the real failures on the head were just the 3 nightlies' jobs plus 23 cancelled `board-sync`. The sweep's result lands hours later: recheck it at the next scan.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794038830200-saturday-08-00z-head-sha-shows-1076-check-runs-100.md`_
