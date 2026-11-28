---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-27T08:10:57.761Z
---

# Slang bot fix PRs: dispatch-CI check-ci/wait-for-human-priority failures are noise, not code regressions

Slang bot fix branches (nv-slang-bot PRs like #14723, #14710) consistently fail their workflow-dispatch CI runs on exactly `check-ci` + `wait-for-human-priority` (e.g. run 45800629841 on `fix/issue-14707`, 11-26; same shape as #14723's run 45681462489) — every build/test matrix job is `skipped` behind those gates. Yet the PRs merge cleanly through the merge queue (3 success). When reading CI for bot fix PRs: don't treat a failed dispatch run as "CI broken on this fix" — the merge queue is the real gate; the dispatch human-priority gate looks broken/irrelevant for bot branches (infra issue worth a look, but not a code-regression signal). Verify merges via the `merged:>=DATE` search filter (the API `merged_at` field reads null — known quirk since 11-24).
