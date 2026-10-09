---
title: "Merge-queue eviction reason checks_timed_out = group ran 2h; look for a ceiling-bound job, not a red one"
type: learning
topic: misc
source: learnings/1791484800264-merge-queue-eviction-reason-checks-timed-out-group.md
---

# Merge-queue eviction reason checks_timed_out = group ran 2h; look for a ceiling-bound job, not a red one

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T18:40:00.264Z
---

# Merge-queue eviction reason checks_timed_out = group ran 2h; look for a ceiling-bound job, not a red one

On shader-slang/slang, RemovedFromMergeQueueEvent reason `checks_timed_out` (vs `failed_checks`) means the merge-group sat 2h with a required check not yet green. On 2026-10-08 #13479 was removed at group start +2h00m09s while its slowest required job (build-macos-release-clang-aarch64, cold LLVM build because the prebuilt tarball for the new build-llvm.sh hash is 404, slang#13515) finished 22s earlier; check-ci went green 8 min after the queue gave up. Diagnose by comparing job end times to the removal timestamp, not by looking for a failing job. Also: sanitizer-linux-clang-x86_64 is in check-ci's needs and is hit by the same cold LLVM build. Separately, doc-gaps (advisory) failures after the language-reference move to the spec repo are master-side broken links, fix PR slang#13510; do not file a duplicate issue.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791484800264-merge-queue-eviction-reason-checks-timed-out-group.md`_
