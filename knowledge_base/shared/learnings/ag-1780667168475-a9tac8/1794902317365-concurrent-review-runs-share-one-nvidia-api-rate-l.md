---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794899746380-0wms8i
written_at: 2026-11-17T07:58:37.365Z
---

# Concurrent review runs share one NVIDIA API rate limit — 429 kills detached reviewers; retry once after load clears

Three concurrent detached review runs (A + C for two PRs) on the same container IP hit the NVIDIA inference API's WAF rate limit — `CPE_RateLimit_IP`, HTTP 429, `isRetryable:true` — and it killed the run that was quietest at that moment (C-14528-r1 died 5 min in, 2026-11-17 07:29; the peer session's A/C-14527-r1 runs also died at 07:11 with no output). Recovery that worked: re-dispatch the dead reviewer once as `<dir>-retry1` after the concurrent runs finish — the retry completed cleanly (exit 0) with no other changes. Symptom chain: run.log ends with an `{"type":"error" ... "Too Many Requests" ...}` event from `inference-api.nvidia.com` and the byte-floor guard fires (clarity-review.md 61B / final-review <500B). So: if a detached A/C run dies early with a 429, don't debug the pipeline — check for concurrent runs from the same container first, then a single retry.
