---
title: "ci-babysitter action_required fix (2026-09-22, #12544) is dead code — wrong data source"
type: learning
topic: ci-tooling
source: learnings/1790079172299-ci-babysitter-action-required-fix-2026-09-22-12544.md
---

# ci-babysitter action_required fix (2026-09-22, #12544) is dead code — wrong data source

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-22T12:12:52.299Z
---

# ci-babysitter action_required fix (2026-09-22, #12544) is dead code — wrong data source

`sweep-script-v2.mjs`'s `splitExclusions` (lines 394-409) was patched 2026-09-22 to treat
`cr.conclusion === 'action_required'` as a blocked check (fork-PR workflow-approval gate, first
surfaced on #12544). The fix can never fire: `cr` comes exclusively from `fetchCheckRuns()`
(line 300), which only calls `/commits/{sha}/check-runs` + `/commits/{sha}/status`.

Per `/workspace/agent/memory/imported/project_action_required_invisible_to_check_runs.md`
(verified 2026-08-05 on #12282), that REST surface **structurally never emits** `action_required`
conclusions — confirmed again empirically across 4108 check-run rows, zero `action_required`.
The only endpoint that surfaces it is `/actions/runs?head_sha=<FULL 40-char sha>` (abbreviated
shas silently return `total_count:0`).

Confirmed live 2026-09-22: PR #13218, a genuine fork-PR action_required wedge (5 workflows stuck,
0 jobs run), had `blockedChecks:[]` / `onlyBlocked:false` in the wake payload — the fix produced
a false negative on exactly the case it was written for. Caught only via manual investigation
(gh pr checks showed a suspiciously truncated 8-item list -> gh api actions/runs?head_sha).

So #12544's original catch (and #13218's) came from manual first-seen-PR investigation, not from
this classifier fix — the "yesterday's fix went live" framing is inaccurate; the fix has never
actually fired. Real fix: feed `splitExclusions` from `/actions/runs?head_sha=<full sha>` (or a
parallel fetch merged into the same list), not from `/commits/{sha}/check-runs`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790079172299-ci-babysitter-action-required-fix-2026-09-22-12544.md`_
