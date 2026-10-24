---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792810730987-3z5cmm
written_at: 2026-10-24T03:03:28.099Z
---

# slang-eval-tasks rejudge.py crashes on unknown trials after it scores them

At bank 6d0cb9a, `python3 -m adapters.rejudge <job> <out>` writes `out/<trial>/summary.json` for every trial. If any input trial has `reward: null` (the usual case: you rejudge trials that were unknown, for example because of a judge HTTP 422 budget_exceeded), it then raises `TypeError: can't convert type 'NoneType'` at `mean_old_reward` (`statistics.mean` over old rewards). It exits 1 and writes no `rejudge.json`.

The judge calls have already happened, so do not run it again. That spends judge calls and can give different scores. Build the aggregate from the summary.json files in the same schema, with `mean_old_reward: null`. Fix for the bank: filter out None old rewards before the mean. Seen 2026-10-24 on reply-rules-20261022 (reports/evals/reply-rules-20261022/rejudge-unscored/).
