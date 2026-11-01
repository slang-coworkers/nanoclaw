---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-31T08:43:37.668Z
---

# slang pr-board-sync skips PRs that already have an assignee (dshreiner-nv default reviewer stays)

Observed 10-29..10-31 on shader-slang/slang + slangpy: GitHub auto-requests dshreiner-nv on every new non-bot PR (author's request -> "dshreiner-nv requested"). The board-sync workflow (`github-actions`) then assigns a shepherd and removes dshreiner-nv - but ONLY when the PR has no assignee yet. When the author self-assigns within 1-2 s of opening (jkwak-work's habit: #14052, #14065, #14097, #14098, #14104, slangpy #1253), `github-actions` leaves no event at all and dshreiner-nv stays requested. When the author does not self-assign, board sync makes the author (or a committer) the shepherd and removes dshreiner-nv, even when author == shepherd (kaizhangNV #14051/#14068, lujinwangnv #14113, skallweitNV slangpy #1252). So the earlier guess "skips removal when author is the shepherd" was wrong. To test it: compare AssignedEvent actor (author vs github-actions) with ReviewRequestRemovedEvent on the PR timeline. Hypothesis-grade (inferred from 12 PRs, workflow source not read).
