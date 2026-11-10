---
title: "Slang CI 11-09: anonymous-download 504s, MQ-only PRs missing from updated: search, deletion front at 11-04"
type: learning
topic: slang-compiler
source: learnings/1794213563648-slang-ci-11-09-anonymous-download-504s-mq-only-prs.md
---

# Slang CI 11-09: anonymous-download 504s, MQ-only PRs missing from updated: search, deletion front at 11-04

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-09T08:39:23.648Z
---

# Slang CI 11-09: anonymous-download 504s, MQ-only PRs missing from updated: search, deletion front at 11-04

- **GitHub "anonymous traffic" 504 incidents break Slang CI downloads** (11-08 08:34-~12:30Z and 11-09 05:15Z onward; githubstatus posted later than CI saw it: "CI jobs and release downloads may fail with a 504"). Signatures: `cmake/FetchDXC.cmake:277 file DOWNLOAD cannot compute hash on failed download`, FetchContent `dxc_*.zip` / `optix-dev/archive/*.zip` `HTTP/2 504`, `Setup sccache` `curl: (22) ... 504` / `curl: (56)`, Claude PR Review `setup-bun` "Unexpected HTTP response: 504" then `bun: command not found` (exit 127). Nightly MDL Perf fails in `Build Slang (tip of tree)` in ~1 min, so that night has NO timings (analyze passes, Perf Bisect skips) - do not read it as "regressions fixed" or "new regression". Classify as GitHub outage, not PR code. nv-slang-bot re-runs failed slangpy `Slang PR #N` dispatches (attempt 2/3), which hides those failures from a `status=failure` list (they end success).
- **`is:pr updated:>=` search misses PRs whose only activity is a merge-queue event**: #14351 was enqueued 11-08T12:06Z and evicted 13:34Z (`failed_checks`) but its `updatedAt` stayed 11-07. Find MQ PRs from `merge_group` run branch names (`gh-readonly-queue/master/pr-<N>-...`), then read `RemovedFromMergeQueueEvent` on that PR.
- **Actions run deletion front moves ~2 days/day, oldest first, skipping `waiting` runs**: on 11-09 slang `created=2026-11-03` fell 1,105 -> 25 and 11-04 2,433 -> 1,656; 11-04 nightly run IDs 404; workflow run lists jump from 11-05 to 10-30. Cite run IDs from the last ~3 days only, or save the facts you need (counts, failure sets) locally.
- slangpy sanitizers Linux asan leg on 2u1g-x570 hosts loses its runner at ~129 min after VM start (3rd sighting 11-09); on b650 the same leg finished in 100 min (11-08).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794213563648-slang-ci-11-09-anonymous-download-504s-mq-only-prs.md`_
