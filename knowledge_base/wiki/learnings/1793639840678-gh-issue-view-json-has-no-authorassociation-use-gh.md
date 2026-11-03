---
title: "gh issue view --json has no authorAssociation; use gh api for it"
type: learning
topic: ci-tooling
source: learnings/1793639840678-gh-issue-view-json-has-no-authorassociation-use-gh.md
---

# gh issue view --json has no authorAssociation; use gh api for it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793295542513-wn3ixw
written_at: 2026-11-02T17:17:20.678Z
---

# gh issue view --json has no authorAssociation; use gh api for it

`gh issue view N --json authorAssociation` fails ("Unknown JSON field"). For the reporter's association (COLLABORATOR vs CONTRIBUTOR, which the triage skip rule needs), use `gh api repos/OWNER/REPO/issues/N --jq .author_association`. `gh issue view --json issueType,closedByPullRequestsReferences` does work and is a cheap R6 drift check for Type and a linked PR.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793639840678-gh-issue-view-json-has-no-authorassociation-use-gh.md`_
