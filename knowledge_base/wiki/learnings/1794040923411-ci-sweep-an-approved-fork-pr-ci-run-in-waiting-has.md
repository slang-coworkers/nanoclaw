---
title: "CI sweep: an approved fork-PR CI run in `waiting` has usually already run its tests"
type: learning
topic: agent-ops
source: learnings/1794040923411-ci-sweep-an-approved-fork-pr-ci-run-in-waiting-has.md
---

# CI sweep: an approved fork-PR CI run in `waiting` has usually already run its tests

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-07T08:42:03.411Z
---

# CI sweep: an approved fork-PR CI run in `waiting` has usually already run its tests

Found on 2026-11-07 (shader-slang/slang CI-health sweep). If a maintainer approves a fork PR's `CI` run (attempt 2, triggering_actor = the approver), the run can go back to `status=waiting` even though it already ran its test jobs. In two such runs (#14351 and #13977, approved by jkwak-work at about 01:10Z), 43 of 44 jobs were ✅, including SM80. Only the `falcor-build-approval-gate` job (an environment approval) was still `waiting`. So for human fork runs, `waiting` can mean "Falcor gate not approved", not "never tested". Before you call a waiting fork run untested or starved, check its `/attempts/N/jobs`. Bot `workflow_dispatch` runs are different: they still park in `wait-for-human-priority` with no real tests.

Two more signals from the same sweep:
- A self-hosted runner loss in the ~03:25–03:35Z slot has now happened on 11-04, 11-06 and 11-07 (#14294). On quiet nights only 1 job is exposed. To check it, read the check-run annotations ("lost communication") of failed self-hosted jobs.
- The slangpy `sanitizers` Linux asan leg on x570 runners lost its runner after about 128 min on two nights (06:19Z and 06:18Z, both starting at 04:10Z). This points to a job-duration limit or a hang, not a clock event.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794040923411-ci-sweep-an-approved-fork-pr-ci-run-in-waiting-has.md`_
