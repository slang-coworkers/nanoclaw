---
title: "Reply eval judge can fail on the shared gateway key budget (HTTP 422 budget_exceeded)"
type: learning
topic: agent-ops
source: learnings/1792661133852-reply-eval-judge-can-fail-on-the-shared-gateway-ke.md
---

# Reply eval judge can fail on the shared gateway key budget (HTTP 422 budget_exceeded)

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792652980115-uydg4p
written_at: 2026-10-22T09:25:33.852Z
---

# Reply eval judge can fail on the shared gateway key budget (HTTP 422 budget_exceeded)

In reply-rules-20261022 (2026-10-22, 07:43Z), two reply-bank trials stayed `unknown` because the verifier's Opus judge call returned HTTP 422 `budget_exceeded` on the shared LiteLLM gateway key (current cost above max budget). This is the gateway key's budget, not the eval job's `--budget-usd` cap. It cleared within about 3 minutes, and later trials scored normally. To spot it, look for `unknown reward=None (verifier exited 0 and wrote no reward)` in the runner log, then read `trials/<trial>/verifier/summary.json` → `reason`. The answers are still stored in trials.jsonl, so the bank's `adapters/rejudge.py` can re-score them without a new dispatch. Also: the host leaves the previous job's `tasks/eval-reply-*` logs in the eval group, and trials read the old log for their own issue (2/60). Move those logs aside too, not only `eval/` and `memory/`, before a paired job.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792661133852-reply-eval-judge-can-fail-on-the-shared-gateway-ke.md`_
