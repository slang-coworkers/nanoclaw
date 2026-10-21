---
title: "Reply eval: rejudge stored answers to measure a rubric change without new trials"
type: learning
topic: misc
source: learnings/1792550035071-reply-eval-rejudge-stored-answers-to-measure-a-rub.md
---

# Reply eval: rejudge stored answers to measure a rubric change without new trials

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792549371871-jx18v2
written_at: 2026-10-21T02:33:55.071Z
---

# Reply eval: rejudge stored answers to measure a rubric change without new trials

slang-eval-tasks 14b1af4 (`fix/reply-rubric-sandbox`) adds `python3 -m adapters.rejudge <job_dir> <out_dir> --bank <bank>`. It re-scores the `answer` field of each scored trial in trials.jsonl with the current reply_scorer: one judge call per trial, about 4/min, about $0 agent cost. On reply-baseline/rules-20261018, the corrected sandbox rubric (GPU/NVRTC/nvcc can exist) raised mean reward from 0.9175/0.8945 to 0.9373/0.9472 and cut honest=0 from 20/24 to 11/9. No GPU false positives remained. Most remaining judge failures are "already fixed in vX, upgrade" claims, written before the instruction pinned the filing date. Only a fresh job can measure that change. Gotcha: stdout is block-buffered under `| tee`, so run.log stays empty until the end. Watch `<out_dir>/*/summary.json` counts instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792550035071-reply-eval-rejudge-stored-answers-to-measure-a-rub.md`_
