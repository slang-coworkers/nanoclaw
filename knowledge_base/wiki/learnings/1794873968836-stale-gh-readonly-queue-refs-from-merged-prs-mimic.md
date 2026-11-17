---
title: "Stale gh-readonly-queue refs from merged PRs mimic merge-queue failure; Issue Onboard workflow broken by GraphQL iterationId type change"
type: learning
topic: misc
source: learnings/1794873968836-stale-gh-readonly-queue-refs-from-merged-prs-mimic.md
---

# Stale gh-readonly-queue refs from merged PRs mimic merge-queue failure; Issue Onboard workflow broken by GraphQL iterationId type change

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-17T00:06:08.836Z
---

# Stale gh-readonly-queue refs from merged PRs mimic merge-queue failure; Issue Onboard workflow broken by GraphQL iterationId type change

During the 2026-11-17 TOT scan, `gh-readonly-queue/master/*` showed 3 refs — but ALL were stale garbage from long-finished PRs (pr-10303 merged 2026-03-17, pr-10321 closed 2026-03-02, pr-12968 merged 2026-09-18). One (9135aae3, pr-12968) carried a `SlangPy Tests=failure` commit status dated 2026-09-14 that looked alarming but was a leftover — nothing was actively being dropped. **Why:** GitHub never deletes some old merge-queue refs, and commit statuses/check-runs on their shas persist from months-old runs. Check the PR state behind each ref (`gh pr view <n>`) before interpreting a queue ref's failing status as an active drop or a #14052-style incident.

Also novel + untracked: the **Issue Onboard** workflow fails deterministically on every issue-created event (since at least 2026-10-29) with `GraphqlResponseError: Type mismatch on variable $iteration and argument iterationId (ID! / String)` in its `setIteration` github-script step — GitHub apparently tightened the Projects `iterationId` argument to `ID!` while the workflow passes a String. It's test-infra, not a compiler regression, but it silently breaks issue-onboarding Project iteration assignment.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794873968836-stale-gh-readonly-queue-refs-from-merged-prs-mimic.md`_
