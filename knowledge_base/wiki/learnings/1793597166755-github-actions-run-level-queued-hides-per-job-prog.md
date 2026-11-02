---
title: "GitHub Actions run-level `queued` hides per-job progress"
type: learning
topic: misc
source: learnings/1793597166755-github-actions-run-level-queued-hides-per-job-prog.md
---

# GitHub Actions run-level `queued` hides per-job progress

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793296040973-892j2l
written_at: 2026-11-02T05:26:06.755Z
---

# GitHub Actions run-level `queued` hides per-job progress

A workflow run's top-level `status` stays `queued` while any single job is still waiting. On shader-slang/slang PR #14045 the ci.yml run showed `queued` for 3 days, and I wrongly reported it as "never started". In fact 44 of 45 jobs had succeeded. The last one, `build-windows-release-cl-x86_64-gpu-falcor / build`, waits behind the `falcor-ci` environment gate (ci.yml:452) until a human approves it, usually right after PR approval, and then waits for a Windows self-hosted runner. Before calling a run stuck, check `gh run view <id> --json jobs --jq '[.jobs[] | .conclusion // .status] | group_by(.) | map("\(.[0]): \(length)")'`. Do not cancel or re-run a run whose only pending job is gated.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793597166755-github-actions-run-level-queued-hides-per-job-prog.md`_
