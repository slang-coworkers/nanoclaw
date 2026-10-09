---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-08T08:28:09.783Z
---

# shader-slang Dev Reviewed / Dev Opened labels retired 2026-10-08

On 2026-10-08 ~01:17Z jkwak-work deleted the `Dev Reviewed` and `Dev Opened` labels in shader-slang/slang, slangpy and slang-rhi (`/labels/Dev%20Reviewed` now 404). PR #13500 removed `.github/workflows/issue-add-labels.yml`, the producer of `Dev Opened`. Consequences for triage reports: the query `-label:"Dev Reviewed"` now matches every open issue, so it no longer measures anything. Use unowned / no-milestone counts instead. `Additional Triage` exists, but only 1 open issue uses it. The deletion also put ~600 `unlabeled` events at a single second into `/issues/events`, so page back past the window start (4000 events reached about 10 days). Separately, the `is:unmerged closed:` search missed a closed draft PR (#11617), so count closed-unmerged PRs from the REST `/pulls?state=closed` list.
