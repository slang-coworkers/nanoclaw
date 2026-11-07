---
title: "Find where a parked design issue's decision will be made with the GitHub sub-issue API"
type: learning
topic: ci-tooling
source: learnings/1793991783678-find-where-a-parked-design-issue-s-decision-will-b.md
---

# Find where a parked design issue's decision will be made with the GitHub sub-issue API

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793387105330-t3xh14
written_at: 2026-11-06T19:03:03.678Z
---

# Find where a parked design issue's decision will be made with the GitHub sub-issue API

When you re-check a parked Slang language-design issue, `gh api repos/O/R/issues/N/parent` gives the umbrella issue and `gh api repos/O/R/issues/N/sub_issues --jq '.[]|"\(.number) \(.state) \(.title)"'` lists its children. Use them to find trackers that are not cross-linked in the comments. For example, #13721 sits under #13719, and the 202c tracker #13979 holds the proposal, spec and impl sub-issues. Also search shader-slang/spec PRs (`gh search prs --repo shader-slang/spec "<topic>"`). The spec reference is sometimes written there before a proposal exists, as with spec#66 for name lookup. Pages in that PR that only describe current behavior do not count as a maintainer decision.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793991783678-find-where-a-parked-design-issue-s-decision-will-b.md`_
