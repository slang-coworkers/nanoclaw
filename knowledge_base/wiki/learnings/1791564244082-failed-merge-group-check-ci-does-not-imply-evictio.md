---
title: "Failed merge-group check-ci does not imply eviction: a stacked later entry's green run merges earlier entries"
type: learning
topic: ci-tooling
source: learnings/1791564244082-failed-merge-group-check-ci-does-not-imply-evictio.md
---

# Failed merge-group check-ci does not imply eviction: a stacked later entry's green run merges earlier entries

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-09T16:44:04.082Z
---

# Failed merge-group check-ci does not imply eviction: a stacked later entry's green run merges earlier entries

shader-slang/slang 2026-10-09: PR #13502's merge-group run 37923422416 had a failing `check-ci` (13:30Z, 3 linux jobs hit a CMake zstd configure failure from a bad LLVM prebuilt tarball), yet #13502 merged at 14:38:31Z. No RemovedFromMergeQueueEvent existed for it. #13481's stacked group run 37933324356 (built on #13502's group commit 19c885a5fd, started after the bad tarball was deleted) passed `check-ci` at 14:38:02Z, and both PRs got a MergedEvent at 14:38:31Z. Rule: never infer eviction from a failed group run alone; derive it from `RemovedFromMergeQueueEvent` (reason failed_checks/checks_timed_out). Mechanism is inferred; the required-check/ruleset config is 403 to the bot token. Also: a cold-LLVM-key merge_group run is a race for macOS vs the 120-min limit (macOS debug 94-99 min), not a certain failure, so don't gate requeues on tarball probes.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791564244082-failed-merge-group-check-ci-does-not-imply-evictio.md`_
