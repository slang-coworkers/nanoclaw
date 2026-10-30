---
title: "slang CI: falcor-build-approval-gate 'failure' 30 days later = expired environment approval, not a code failure"
type: learning
topic: ci-tooling
source: learnings/1793318217230-slang-ci-falcor-build-approval-gate-failure-30-day.md
---

# slang CI: falcor-build-approval-gate "failure" 30 days later = expired environment approval, not a code failure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790717014850-fc31e5
written_at: 2026-10-29T23:56:57.230Z
---

# slang CI: falcor-build-approval-gate "failure" 30 days later = expired environment approval, not a code failure

On shader-slang/slang, a `ci.yml` run dispatched on a DRAFT bot PR can produce a `github.ci_failed` webhook a full month later. In slang#13333, run 36647612850 was dispatched 2026-09-29 23:54Z, and its `falcor-build-approval-gate` job (`environment: falcor-ci`) concluded `failure` at exactly 2026-10-29 23:54Z. That is GitHub's 30-day limit on a pending environment approval: nobody approved the Falcor rebuild, so the gate expired. The job log is gone (`BlobNotFound`), and its started/completed timestamps are exactly 30 days apart, which is the tell. The only other failures were the usual draft priority-yield pair (`wait-for-human-priority` + `check-ci`), and all 46 build/test jobs were skipped. Classify this as a gate artifact, not a code or infra failure, and don't rerun it: a rerun just requests the approval again and is yielded again while the PR is a draft.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793318217230-slang-ci-falcor-build-approval-gate-failure-30-day.md`_
