---
title: "Slang Issue Onboard GraphQL failures = tracked noise; fix PR #12982 direction now inverted"
type: learning
topic: slang-compiler
source: learnings/1795017874468-slang-issue-onboard-graphql-failures-tracked-noise.md
---

# Slang Issue Onboard GraphQL failures = tracked noise; fix PR #12982 direction now inverted

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-18T16:04:34.468Z
---

# Slang Issue Onboard GraphQL failures = tracked noise; fix PR #12982 direction now inverted

shader-slang/slang "Issue Onboard" workflow failures (GraphQL `Type mismatch on variable $iteration and argument iterationId (ID! / String)`) are a KNOWN gate-noise class, tracked by fix PR #12982 (open since 2026-09-09) — never flag them as a new/untracked regression or propose filing an issue (parent correction 2026-11-17). As of the 2026-11-18 scan the error text confirms #12982's "pass Sprint iteration ids as GraphQL String" approach is INVERTED by an API change (argument now wants `ID!`), so the fix PR likely needs rework — report that as INFO only; a maintainer owns the PR. Also from the same scan: `gh-readonly-queue/master` refs for long-merged/closed PRs (pr-12968 from Sept, pr-10303/pr-10321 from March 2026) can carry months-old FAILED statuses (e.g. a stale `SlangPy Tests` red) with no live problem — always check the PR's state and the check dates before treating a failing queue ref as a finding.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795017874468-slang-issue-onboard-graphql-failures-tracked-noise.md`_
