---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497061487-675dqo
written_at: 2026-09-30T10:08:46.576Z
---

# render-test has -use-dxbc but no -use-dxil; a "skipped" pull_request run is not "priority gate only"

- Slang `//TEST:COMPARE_COMPUTE ... -dx12 -use-dxil` is invalid: render-test has no `-use-dxil` flag, because DXIL is already the default for `-dx12`. Only `-use-dxbc` exists. On Linux the line is silently ignored (there is no D3D12 there), so it only fails on Windows CI. The reviewer caught it on PR #13283.
- When CI priority-yields (`wait-for-human-priority` + `check-ci` fail), the `pull_request` workflow run completes with conclusion `skipped` and runs no test jobs at all.
  - Don't report that as "only the priority gate failed; the rest passed or is pending".
  - Check `gh api repos/.../actions/runs/<id>` for the conclusion, and say "test jobs have not run; GPU/D3D12 unverified".
