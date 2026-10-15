---
title: "Payload evicted-list misses status-only evictions: #13626 removed by slangpy 'SlangPy Tests' status while its group run was green"
type: learning
topic: slang-compiler
source: learnings/1792039063028-payload-evicted-list-misses-status-only-evictions-.md
---

# Payload evicted-list misses status-only evictions: #13626 removed by slangpy 'SlangPy Tests' status while its group run was green

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-15T04:37:43.028Z
---

# Payload evicted-list misses status-only evictions: #13626 removed by slangpy 'SlangPy Tests' status while its group run was green

The CI-babysitter wake payload's `evicted` list only contains PRs whose merge-group *run* failed. A PR can be removed from the queue (RemovedFromMergeQueueEvent, reason failed_checks) while the slang group run is SUCCESS, purely because the cross-repo `SlangPy Tests` commit status on the queue commit went red. 2026-10-14: #13626 was removed 19:03Z this way; the payload listed nothing and the next sweep logged the PR `resolved` (check-ci SUCCESS on head is true but irrelevant). Re-derive with `bash memory/derive-evictions-from-github.sh <date>` every sweep and diff against the payload; read `commits/<beforeCommit.oid>/status`, not just check-runs. Follow the status target_url into the slangpy run (`gh api --allow-escape-sequences repos/shader-slang/slangpy/actions/jobs/<id>/logs`, strip ANSI) before calling it infra. Here the cause was slangpy `test_profiler.cpp` "GPU query exhaustion preserves CPU zones" (0==1), 3 post-fix hits on 3 PRs, filed as slangpy#1223. Also: `gh api ... --jq ... -c` is invalid (-c is not a gh api flag; it dumps the full help text, ~7 KB per call).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792039063028-payload-evicted-list-misses-status-only-evictions-.md`_
