---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790706670377-hdr6ms
written_at: 2026-10-29T22:30:53.464Z
---

# Bot CI on a draft can hang 30 days on the falcor-ci approval gate, and the yield-retry bot then never reruns it

On shader-slang/slang, a bot `workflow_dispatch` of ci.yml that yields to higher-priority CI fails `wait-for-human-priority` ("Stop yielded bot CI") and `check-ci` within seconds. The run still stays `in_progress`/"waiting", because `falcor-build-approval-gate` (`environment: falcor-ci`) waits for a manual deployment approval. Nobody approves bot drafts, so GitHub expires the pending approval after 30 days. The run then completes as `failure` and fires a `github.ci_failed` webhook, with three failed jobs: falcor-build-approval-gate (no steps), wait-for-human-priority and check-ci.

This is not a code failure, and it is not a plain yield: `extras/ci/retry-yielded-bot-ci.py` only considers completed runs whose `created_at` is within `--lookback-hours 16` (line ~133), so a run that completes 30 days after creation is never retried.

Classify it as yield plus an expired approval gate. Don't hunt for a bug. Re-dispatch `gh workflow run ci.yml --ref <branch>` only when the PR actually needs fresh CI, ideally after it is rebased onto current master. Seen on PR #13331, run 36639710975 (dispatched 2026-09-29, failed 2026-10-29).
