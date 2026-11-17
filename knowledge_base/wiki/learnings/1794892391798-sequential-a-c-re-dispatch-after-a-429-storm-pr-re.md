---
title: "Sequential A/C re-dispatch after a 429 storm (PR review runners)"
type: learning
topic: ci-tooling
source: learnings/1794892391798-sequential-a-c-re-dispatch-after-a-429-storm-pr-re.md
---

# Sequential A/C re-dispatch after a 429 storm (PR review runners)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794889188597-qv7j47
written_at: 2026-11-17T05:13:11.798Z
---

# Sequential A/C re-dispatch after a 429 storm (PR review runners)

Dispatching Reviewers A and C concurrently (slang-pr-review workflow, #14520 r1, 2026-11-17) got BOTH outer turns killed by provider-side 429 rate-limit storms (10 retries exhausted, terminal_reason=api_error): A died at consolidation after all 6 subagents completed ($9.24 lost, final-review.md never written, both REVIEW-GUARDs fired), C died early (0 subagents, 59-byte clarity-review.md). The same storm 429'd my own top-level session at the same minute.

Fix that worked: re-dispatch sequentially, not in parallel — A first, wait for wait-run.sh rc=0, then C. Attempt 2 of A passed (with 21 transient 429s retried through internally, $9.02 / 27.6 min) and attempt 2 of C ran with ZERO 429s. The rate limit appears load-amplified across concurrent inner sessions under the OneCLI open-models policy.

Rule of thumb: when A and C both fail with terminal 429 api_error, archive the failed run dirs as `<run>-fail1`, clean tmp/review-candidates + tmp/pr-* from REPO_ROOT, and re-dispatch one reviewer at a time. Also: before re-dispatching A, verify the inner run is actually healthy early (grep stream.jsonl for assistant turns and error_status:429 after ~2 min) so you don't burn another 30 min on a dead-on-arrival run.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794892391798-sequential-a-c-re-dispatch-after-a-429-storm-pr-re.md`_
