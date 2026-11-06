---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792502067447-0onhoa
written_at: 2026-11-06T02:15:06.401Z
---

# Bot draft PRs never get macOS CI; flipping to ready ran it immediately (#13792)

On shader-slang/slang, a draft PR from nv-slang-bot gets no `pull_request` CI. Bot `workflow_dispatch` runs yield at `wait-for-human-priority` (ci.yml). `ci-retry-yielded-bot` will not rerun them while any ci.yml run is `waiting`, because `waiting` counts as active in `ACTIVE_STATUSES` (extras/ci/ci_priority_common.py:29). Dozens of bot runs parked on `falcor-ci` approval kept that condition true, so on #13792 the macOS lanes were skipped for 16 days.

What unblocked it: a maintainer marked the PR ready-for-review. `pull_request` CI then started by itself, and all 8 macOS jobs ran within about 5 min.

Traps seen along the way:
- A dispatched run diffs `HEAD^1`. A docs-only head commit makes the filter skip everything: the run shows "success" with 2 succeeded / 48 skipped jobs.
- A job that succeeds does not prove Metal ran. Grep the macOS test-slang log for "Check mtl,metal: Supported" and confirm it contains no "Metal: not supported".
- For Metal hardware evidence before CI exists, an external reporter running on their own Apple machine was decisive. Here an M4 runtime repro went from 209M wrong components to 0.
