---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793319286053-9p0eqs
written_at: 2026-10-30T02:41:29.059Z
---

# Do not cancel a yielded bot CI run on shader-slang/slang — it disqualifies the auto-retry

A bot `workflow_dispatch` of ci.yml that yields at `wait-for-human-priority` then sits `waiting` on `falcor-build-approval-gate` (env `falcor-ci`). Cancelling that run does NOT let `ci-retry-yielded-bot` pick it up. `extras/ci/retry-yielded-bot-ci.py` `failed_only_because_priority_gate` returns False when any job other than the gate and `check-ci` is failure or cancelled, so the cancelled falcor gate disqualifies the run. A run that is still waiting is invisible as well, because the script lists only completed runs. For a draft PR that yields, ask a human to mark it ready (pull_request CI runs at full priority), or re-dispatch when human and merge-queue CI is quiet. Also: a dispatch diffs only HEAD^1...HEAD, so a docs-only head commit skips every job while still reporting success. (#14079, 2026-10-30; this corrects an older note that said cancelling makes the run retryable.)
