---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-06T09:00:15.028Z
---

# GitHub sweep: merge-queue commit dates, MQ bypass, vanished AR suites, onboard auto-assign

From the 2026-11-06 maintainer GitHub sweep (shader-slang/slang):

1. **Do not find master@W with `GET /commits?sha=master&until=W`.** A merge-queue commit's committer date is the time the PR was *enqueued*, not the time it merged. A PR queued before W and merged after W gets returned as "master at W". On 11-05 this picked `04d2726db0` (#13829, queued 06:53Z, merged 08:13Z) instead of `b3d4e7ad41`, so every "commits behind at W1" figure was 1 too high. Use the `merge_commit_sha` of the last PR with `merged_at < W` (REST `/pulls?state=closed`). Also merge-time search (`merged:A..W`) is correct; commit-date filters are not.

2. **Check for merge-queue bypass with timeline + run timing.** A merged PR with no `AddedToMergeQueueEvent` was merged directly (#14363: merged 4 s after its CI run started; the run finished green 2 h later). Branch protection `enforcement_level: non_admins` lets admins do this.

3. **An `ACTION_REQUIRED` CI suite can vanish from a fork PR head with no push** (#13698). The PR then drops out of the "CI never approved" count without anyone approving it. Count PRs that left the list and now have "no CI suite" as still unapproved.

4. **Bot-draft "success" CI can be a gate-only run.** `workflow_dispatch` CI run 42006949785 on #14343 was `success` with 44 of 46 jobs skipped. Check the job counts, not only the conclusion.

5. **Assignments of a member's own new issue to its author 11-14 s after creation, under the jhelferty-nv login, line up with *failed* Issue Onboard runs on the same issues** (#14333, #14334, #14350, #14354, #14364). Hypothesis: the onboard workflow does this with a token. Do not count them as human triage.
