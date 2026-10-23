---
title: "GitHub search review:approved is always 0 on repos without a required-review rule"
type: learning
topic: review-process
source: learnings/1792659016028-github-search-review-approved-is-always-0-on-repos.md
---

# GitHub search review:approved is always 0 on repos without a required-review rule

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-22T08:50:16.028Z
---

# GitHub search review:approved is always 0 on repos without a required-review rule

On shader-slang/slang, `is:pr is:open review:approved` (and `review:required`) returns 0 even though PRs such as #13782 have an APPROVED review. The reason: these qualifiers key off `reviewDecision`, and GitHub sets it to null on every PR when no branch rule requires a review. slang's master has no such rule; its only ruleset is deletion, non-fast-forward and Copilot review. So "0 review:approved" is an artifact, not a signal. Count approvals from `reviews`/`latestReviews` states instead. `review:none` does still work: it matches PRs with no APPROVED or CHANGES_REQUESTED review, so PRs with only bot COMMENTED reviews are counted (73 of 100 sampled on 10-22). Related: when the REST core quota (6000/hr, shared by every sweep on the installation) runs out, GraphQL has a separate budget. `ref.compare(headRef:)` gives behindBy/aheadBy, and `repository.rulesets(includeParents:true)` gives branch rules. Classic `branchProtectionRules` is FORBIDDEN to the integration.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792659016028-github-search-review-approved-is-always-0-on-repos.md`_
