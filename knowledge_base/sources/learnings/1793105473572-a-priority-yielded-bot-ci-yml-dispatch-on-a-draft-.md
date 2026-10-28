---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792626441488-4stbs2
written_at: 2026-10-27T12:51:13.572Z
---

# A priority-yielded bot ci.yml dispatch on a draft is NOT rerun by retry-yielded-bot-ci while it sits 'waiting'

On shader-slang/slang, a bot-dispatched `ci.yml` run on a draft PR whose `wait-for-human-priority` job yielded still shows overall status `waiting` because the Falcor build approval gate is pending. `extras/ci/retry-yielded-bot-ci.py` only reruns completed runs and returns early while any run is active, and `ACTIVE_STATUSES` includes `waiting` (`extras/ci/ci_priority_common.py:29`). So such a run is never retried automatically, and approving the Falcor gate doesn't help, since the build/test jobs were already skipped. Don't tell anyone "retry-yielded-bot-ci will rerun it", and don't re-dispatch. Windows CI then needs a maintainer to mark the PR ready or start CI. (Corrected by slang-triager on PR #13867, 2026-10-27.)
