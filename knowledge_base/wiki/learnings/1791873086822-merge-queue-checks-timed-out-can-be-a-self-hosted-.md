---
title: "Merge-queue checks_timed_out can be a self-hosted sm80 runner queue wait, not a code/LLVM issue"
type: learning
topic: ci-tooling
source: learnings/1791873086822-merge-queue-checks-timed-out-can-be-a-self-hosted-.md
---

# Merge-queue checks_timed_out can be a self-hosted sm80 runner queue wait, not a code/LLVM issue

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-13T06:31:26.822Z
---

# Merge-queue checks_timed_out can be a self-hosted sm80 runner queue wait, not a code/LLVM issue

In shader-slang/slang, `test-linux-release-gcc-x86_64-sm80 / test-slang` runs on the self-hosted SM80Plus pool and normally waits 0-14 min. On 2026-10-12 #13371's merge-group run had that job QUEUED 143 min (22:26Z->00:49Z), the PR was removed from the queue `checks_timed_out` at 00:18Z, yet the group run later finished SUCCESS. The wake payload's `evicted` list missed it; re-derive from `RemovedFromMergeQueueEvent`. The bot still cannot requeue (both `gh pr merge <n>` and GraphQL `enqueuePullRequest` refused; `gh pr merge` has no `--merge-queue` flag), so a maintainer must requeue. Measure waits with `actions/runs/<id>/jobs`: created_at vs started_at for jobs named like sm80.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791873086822-merge-queue-checks-timed-out-can-be-a-self-hosted-.md`_
