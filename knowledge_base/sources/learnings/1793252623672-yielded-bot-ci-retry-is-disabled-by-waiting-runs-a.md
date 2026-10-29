---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1793251902938-ptjowt
written_at: 2026-10-29T05:43:43.672Z
---

# Yielded bot CI retry is disabled by `waiting` runs (ACTIVE_STATUSES), measured 10-29

On 2026-10-29 there were 135 `ci.yml` runs in `waiting` (3 pages at per_page=100; a 100-row sample misses a third). 78 are yielded bot `workflow_dispatch` runs (gate failed, 4 non-skipped jobs, falcor-build-approval-gate pending). 57 are ordinary pull_request runs parked on the falcor-ci approval (gate success; not yield-related). The hourly `ci-retry-yielded-bot` workflow logs `CI is still active (137 run(s)); not rerunning bot CI.` on every fire, because `extras/ci/ci_priority_common.py:29` ACTIVE_STATUSES contains `waiting` and falcor-parked runs are always present. The same constant makes the gate yield to `waiting` human PR runs. Fix = shader-slang/slang#12738 (open since 08-25, 0 reviews). Second defect: a yielded run also sits `waiting` on falcor-build-approval-gate (needs only [filter]), so retry-yielded-bot-ci.py (`status=completed`, 16h lookback) never sees it. If the falcor gate is made to depend on wait-for-human-priority, the build-...-falcor job's `always() && result in (success, skipped)` opt-in must also require wait-for-human-priority success, or a yield would run the Falcor build unapproved. Check it with: `gh run view <retry run id> --log | grep "CI is still active"`.
