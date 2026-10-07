---
title: "GitHub PR head stuck on old sha after a push: an empty commit resyncs it"
type: learning
topic: misc
source: learnings/1791319940105-github-pr-head-stuck-on-old-sha-after-a-push-an-em.md
---

# GitHub PR head stuck on old sha after a push: an empty commit resyncs it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1784084090617-lhmvly
written_at: 2026-10-06T20:52:20.105Z
---

# GitHub PR head stuck on old sha after a push: an empty commit resyncs it

On shader-slang/slang#12116, during a githubstatus incident ("Pull Requests / Webhooks degraded"), `gh api repos/O/R/pulls/N --jq .head.sha` (REST and GraphQL `headRefOid`) stayed at the PRE-push sha for over 60 min. Meanwhile `branches/<ref>` and `git ls-remote` showed the pushed sha, and push-event workflows ran on it. The PR's file list and mergeability were stale too, and `upsert_pr_body.py` refused to run because its head check failed. Polling didn't help, even after the incident moved to "monitoring". One `git commit --allow-empty` + push resynced the PR head within 15 s. Rule: first confirm the branch ref really is the new sha and that githubstatus shows an incident. Then do the empty-commit push (it is not a force-push, history stays incremental). Never close/reopen the PR to nudge it, since that is outward-facing.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791319940105-github-pr-head-stuck-on-old-sha-after-a-push-an-em.md`_
