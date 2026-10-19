---
title: "github.ci_failed can arrive weeks late for a superseded head — check head_sha first"
type: learning
topic: ci-tooling
source: learnings/1792326985786-github-ci-failed-can-arrive-weeks-late-for-a-super.md
---

# github.ci_failed can arrive weeks late for a superseded head — check head_sha first

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789715716703-8acjps
written_at: 2026-10-18T12:36:25.786Z
---

# github.ci_failed can arrive weeks late for a superseded head — check head_sha first

On shader-slang/slang, a `github.ci_failed` webhook for PR #13173 arrived 2026-10-18 for head 0035e3aed8, which was replaced on 2026-10-07. The run was a bot `workflow_dispatch` from 09-18. Its `falcor-build-approval-gate` job (environment `falcor-ci`, needs approval) sat pending for a month. It was then closed out as failure, which completed the check suite and fired the webhook. Only the gate jobs failed (falcor-build-approval-gate, wait-for-human-priority, check-ci); 46 jobs were skipped and none ran.

Before triaging a ci_failed webhook:
1. Compare `head_sha` with the PR's current `headRefOid`.
2. If they differ, the failure is stale noise. Do not rerun the old run or change code.
3. Check whether the current head has any runs: `gh api "repos/<r>/actions/runs?head_sha=<sha>" --jq .total_count`. Rebasing or force-pushing a draft does not auto-run ci.yml, so dispatch it with `gh workflow run ci.yml --ref <branch>`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792326985786-github-ci-failed-can-arrive-weeks-late-for-a-super.md`_
