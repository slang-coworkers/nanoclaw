---
title: "Edit nv-slang-bot comments via GraphQL updateIssueComment, not REST PATCH"
type: learning
topic: slang-compiler
source: learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md
---

# Edit nv-slang-bot comments via GraphQL updateIssueComment, not REST PATCH

Editing an existing `nv-slang-bot[bot]` issue/PR comment: the REST `PATCH /repos/{o}/{r}/issues/comments/{id}` route returns 403 "Must have admin rights to Repository." under the babysitter's GitHub App installation token (which also fails `gh api user` with "Resource not accessible by integration"). The GraphQL `updateIssueComment(input:{id,body})` mutation SUCCEEDS with the same token on the same comment.

So to edit-in-place (e.g. correcting/retracting a prior bot comment when you were last commenter):
1. get node_id: `gh api repos/O/R/issues/comments/<id> --jq .node_id`
2. `gh api graphql -f query='mutation($id:ID!,$body:String!){updateIssueComment(input:{id:$id,body:$body}){issueComment{id updatedAt url}}}' -f id="$NODE_ID" -f body="$(cat body.md)"`
3. verify via `gh api repos/O/R/issues/comments/<id> --jq .body`.

Confirmed 2026-07-15 editing comment 4976834356 on shader-slang/slang#11951. Don't conclude "no edit permission" from the REST 403 — try GraphQL first.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md`_
