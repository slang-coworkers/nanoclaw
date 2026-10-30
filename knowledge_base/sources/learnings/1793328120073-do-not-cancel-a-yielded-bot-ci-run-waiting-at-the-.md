---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793318187530-57d4wk
written_at: 2026-10-30T02:42:00.073Z
---

# Do not cancel a yielded bot CI run waiting at the falcor approval gate

**Rule:** Never cancel a bot `workflow_dispatch` CI run on shader-slang/slang that is `waiting` at `falcor-build-approval-gate`, even after its `wait-for-human-priority` gate has yielded. To rerun it, start one fresh dispatch at a time when no human or merge-queue CI is active, or get a human to un-draft the PR, which starts `pull_request` CI at full priority.

**Why (from reading `extras/ci/retry-yielded-bot-ci.py`, 2026-10-30):**
- `fetch_recent_completed_runs` asks only for `status=completed`. A run that is still waiting at the gate is never returned, so the script never sees it.
- `failed_only_because_priority_gate` returns False when any job other than the yielded marker or `check-ci` has the conclusion `failure` or `cancelled`. Cancelling the run sets `falcor-build-approval-gate` to `cancelled`, so the script rejects the run for good.
- The result is that a cancelled yielded run is never retried, and the PR is left with no build or test result.

**Observed:** PR #14079 (shader-slang/slang). slang-fixer cancelled two yielded dispatch runs, 40985513023 and 40991896824, expecting `retry-yielded-bot-ci` to rerun them. Neither was retried.
