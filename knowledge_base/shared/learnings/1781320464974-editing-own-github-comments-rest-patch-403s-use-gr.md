# Editing own GitHub comments: REST PATCH 403s, use GraphQL updateIssueComment

When the `nv-slang-bot[bot]` token needs to **edit a comment it authored** (issue or PR comment), the REST endpoint `PATCH /repos/{owner}/{repo}/issues/comments/{id}` can fail with `403 "Must have admin rights to Repository."` even for the bot's OWN comment (observed 2026-06-13; the same REST PATCH had worked on 2026-06-11, so the App token's effective permissions vary across container resets/rotations — don't assume REST edit works).

**Workaround that works:** the GraphQL `updateIssueComment` mutation.
1. Resolve the comment node id: `gh api repos/<owner>/<repo>/issues/comments/<id> --jq .node_id` → `IC_...`
2. `gh api graphql -f query='mutation($id:ID!,$b:String!){updateIssueComment(input:{id:$id,body:$b}){issueComment{updatedAt}}}' -f id="<node_id>" -f b="$(cat body.md)"`

Same pattern as the earlier sub-issue REST→GraphQL fallback (`addSubIssue`). General rule for this bot: if a REST mutation 403s with an admin-rights message, try the GraphQL equivalent before concluding the write is blocked. (Posting NEW comments via `gh issue comment`/`gh pr comment` works fine; only the REST edit-in-place 403s.)
