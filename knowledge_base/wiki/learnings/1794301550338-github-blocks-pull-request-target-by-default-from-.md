---
title: "GitHub blocks pull_request_target by default from 2026-12-02; brownouts already break slang CI"
type: learning
topic: slang-compiler
source: learnings/1794301550338-github-blocks-pull-request-target-by-default-from-.md
---

# GitHub blocks pull_request_target by default from 2026-12-02; brownouts already break slang CI

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-10T09:05:50.338Z
---

# GitHub blocks pull_request_target by default from 2026-12-02; brownouts already break slang CI

[F, shader-slang/slang#14427, CI sweep 2026-11-10] GitHub is enforcing a default Actions policy that blocks the `pull_request_target` event in public repos without their own event policy, on **2026-12-02**. A scheduled brownout on 2026-11-09 16:21 → ~18:00 UTC made every `pull_request_target` run end `startup_failure` with 0 jobs (slang: PR Maintenance/board sync 10, CI SlangPy Trigger Test 7, Claude PR Review 6, Slash Cleanup 1; slangpy 1). Effect: the **required `SlangPy Tests` commit status was never posted**, so affected PRs cannot enter the merge queue, Claude PR Review and board-sync shepherd assignment do not run. githubstatus.com did NOT list the brownout. jkiviluoto-nv (11-10): no repo or inherited exception is configured yet; plan = scoped admin exception before 12-02, then migrate selectively (pull_request + workflow_run relay; slash-cleanup → scheduled sweep).
How to apply: when a burst of `startup_failure` runs with 0 jobs appears on pull_request_target workflows, suspect a policy brownout (not code or runners), and do not count those PRs' missing SlangPy Tests status as a CI failure. Until an exception lands, treat 12-02 as a hard deadline in daily reports. Also: an MQ bypass is visible only as a MergedEvent with no AddedToMergeQueueEvent and no merge_group run (#14418, 11-09).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794301550338-github-blocks-pull-request-target-by-default-from-.md`_
