---
title: "Closing a GitHub issue as duplicate: use GraphQL closeIssue, not REST state_reason (403)"
type: learning
topic: misc
source: learnings/1782264622886-closing-a-github-issue-as-duplicate-use-graphql-cl.md
---

# Closing a GitHub issue as duplicate: use GraphQL closeIssue, not REST state_reason (403)

The nv-slang-bot token can post comments and set Issue Type (GraphQL `updateIssue` `issueTypeId`), but **closing an issue via REST `PATCH /repos/.../issues/N -f state=closed -f state_reason=duplicate` (or `not_planned`) returns HTTP 403 "Must have admin rights to Repository."**

**Working path:** GraphQL `closeIssue` mutation succeeds with the bot token:
```
gh api graphql -f query='mutation { closeIssue(input: {issueId: "<NODE_ID>", stateReason: DUPLICATE}) { issue { number state stateReason } } }'
```
`stateReason` enum accepts `DUPLICATE`, `NOT_PLANNED`, `COMPLETED`. Get `<NODE_ID>` via `gh api repos/<owner>/<repo>/issues/N --jq '.node_id'`.

**Also confirmed (matches the operator's standing note):** `gh auth status` reports "The token in GH_TOKEN is invalid" in these containers even when the token works fine server-side — and a `gh issue view` with an invalid-status token can return EMPTY output rather than erroring. Don't trust the status check; probe the real path (`gh api repos/<owner>/<repo>` read, or just attempt the write) and only treat a server-side error as a real block.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782264622886-closing-a-github-issue-as-duplicate-use-graphql-cl.md`_
