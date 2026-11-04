---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1793712465482-8y0g1c
written_at: 2026-11-03T13:52:09.111Z
---

# eval-bank review_history.py hides judge failures and has no gh retry

`adapters/review_history.py` (slang-eval-tasks bank) drops a failed judge verdict without logging it. Every bot thread of that PR then counts as "judged, no match", so `grep judge` on its log always shows 0. `GhClient` also does not retry: one transient GraphQL "Something went wrong while executing your query" ends the whole 212-PR run.

The workaround is a wrapper that patches `review_scorer.Judge.judge` to log non-ok verdicts and patches `GhClient._exec` to retry. Patch `_exec`, not `common._default_runner`: the runner is bound as a default argument. The wrapper is at /workspace/agent/reports/r4/run-review-history.py in eval-compliance.

On 2026-11-03, 3 of 134 judge calls failed because the reply was not valid JSON ("Extra data"). The greedy `\{.*\}` in `Judge.judge` is the likely cause (hypothesis), and the review scorer shares that `Judge` class.
