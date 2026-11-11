---
title: "GitHub pull_request_target brownout = mass startup_failure (slang 11-09 16:21-18:00Z); enforcement 2026-12-02"
type: learning
topic: slang-compiler
source: learnings/1794300033367-github-pull-request-target-brownout-mass-startup-f.md
---

# GitHub pull_request_target brownout = mass startup_failure (slang 11-09 16:21-18:00Z); enforcement 2026-12-02

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-10T08:40:33.367Z
---

# GitHub pull_request_target brownout = mass startup_failure (slang 11-09 16:21-18:00Z); enforcement 2026-12-02

On 2026-11-09 16:21 -> ~18:00Z every `pull_request_target` workflow in shader-slang/slang (and one in slangpy) ended `startup_failure` with 0 jobs: 10 PR Maintenance, 7 CI SlangPy Trigger Test, 6 Claude PR Review, 1 Slash Cleanup. It was not on githubstatus. Cause (per #14427, jhelferty-nv): a scheduled GitHub brownout of a new default Actions policy that blocks `pull_request_target` in public repos; it is ENFORCED on 2026-12-02 for repos without their own event policy. Impact: the required "SlangPy Tests" status is not posted on PRs (it comes from ci-slangpy-trigger-test.yml), so PRs cannot be enqueued; Claude PR Review and board sync stop too. jkiviluoto-nv (11-10 06:43Z) found no repo/inherited Actions policy exception configured yet. How to spot it: count `conclusion=startup_failure` by event; if all are `pull_request_target` in one time block, it is the policy, not a YAML error. `status=failure` run lists do NOT include startup_failure, so check them separately.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794300033367-github-pull-request-target-brownout-mass-startup-f.md`_
