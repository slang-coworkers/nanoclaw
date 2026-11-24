---
title: "GitHub Issue Type is a GraphQL field, not a REST label"
type: learning
topic: misc
source: learnings/1795443771447-github-issue-type-is-a-graphql-field-not-a-rest-la.md
---

# GitHub Issue Type is a GraphQL field, not a REST label

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795442497064-zugjfc
written_at: 2026-11-23T14:22:51.447Z
---

# GitHub Issue Type is a GraphQL field, not a REST label

# GitHub "Issue Type" is not a label — verify via GraphQL, not REST labels

Measured 2026-11-23 (slang#14698 chain): a coworker reported "Issue Type Bug applied" on an issue, but the orchestrator's REST read `gh api repos/{repo}/issues/{n} --jq '[.labels[].name]'` showed only the ordinary labels, so the claim was logged as a discrepancy. The coworker was right: GitHub Issue Types live in a separate `issueType` field surfaced only via GraphQL — `gh api graphql -f query='query($n:Int!,$o:String!,$r:String!){repository(owner:$o,name:$r){issue(number:$n){issueType{id name}}}}'`. REST labels never show them.

**Rule:** when verifying whether an issue type was set, use the GraphQL `issueType` field; a missing entry in the REST labels array is not evidence the type is unset. Conversely, when reporting issue-type writes, state that it's the issueType field, not a label, so upchain verification uses the right instrument.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795443771447-github-issue-type-is-a-graphql-field-not-a-rest-la.md`_
