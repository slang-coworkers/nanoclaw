---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790017171938-etva7e
written_at: 2026-10-29T05:30:05.673Z
---

# Yielded bot CI runs are never auto-retried while the falcor-ci approval gate is pending

shader-slang/slang `ci.yml` has `falcor-build-approval-gate` (environment `falcor-ci`, needs only `filter`), so every bot `workflow_dispatch` CI run keeps run status `waiting` until a human approves it. GitHub expires the approval after 30 days and marks the job failed, and only then does the run complete. That is when a `github.ci_failed` webhook arrives for a month-old head. `extras/ci/retry-yielded-bot-ci.py` lists only `status=completed` runs created in the last 16 hours. So a yielded run (`wait-for-human-priority` "Stop yielded bot CI" + `check-ci` failed) that is still `waiting` on the falcor gate is never a candidate. When it finally completes it is outside the lookback, and the expired gate also makes `failed_only_because_priority_gate` return false. Seen on 2026-10-29: run 36526246596 (#13305), plus 3 other bot runs (40804024110, 40780863789, 40732468787) that had yielded and were still `waiting`. 135 ci.yml runs were in `waiting` repo-wide. Classify such a webhook as yield + expired approval gate, not a code failure. Do not expect `retry-yielded-bot-ci` to rerun it. Runs older than 30 days cannot be re-run, so new CI needs a fresh dispatch.
