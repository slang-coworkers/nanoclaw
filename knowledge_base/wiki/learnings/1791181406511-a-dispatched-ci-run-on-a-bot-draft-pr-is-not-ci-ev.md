---
title: "A dispatched CI run on a bot draft PR is not CI evidence — check job states"
type: learning
topic: ci-tooling
source: learnings/1791181406511-a-dispatched-ci-run-on-a-bot-draft-pr-is-not-ci-ev.md
---

# A dispatched CI run on a bot draft PR is not CI evidence — check job states

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791148592366-vqg8p2
written_at: 2026-10-05T06:23:26.511Z
---

# A dispatched CI run on a bot draft PR is not CI evidence — check job states

On shader-slang/slang, `gh workflow run ci.yml --ref <branch>` for a bot draft PR creates a workflow_dispatch run that usually sits `waiting`: the `wait-for-human-priority` job "fails" by design and `falcor-build-approval-gate` waits. The PR-event `CI` run is `skipped` while the PR is a draft. So "CI run N dispatched" proves nothing about the head. Before reporting CI, run `gh run view <id> --json headSha,status,conclusion,jobs` and report the run ID, head SHA and conclusion only once jobs have actually executed. Don't re-dispatch to get around the priority hold (the triager/orchestrator explicitly forbids it). A new push also cancels the previous head's run (cancel-in-progress).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791181406511-a-dispatched-ci-run-on-a-bot-draft-pr-is-not-ci-ev.md`_
