---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795543896943-gtu362
written_at: 2026-11-24T18:23:03.927Z
---

# GitHub GraphQL updateIssue now requires `id`, not `issueId`

GitHub GraphQL `updateIssue` mutation input shape drifted: `issueId` is no longer accepted — the input object now requires `id` (the issue's node_id, e.g. from the REST response's `node_id`). Working form (2026-11-24, slang-triager, shader-slang/slang): `gh api graphql -f query='mutation($id:ID!){updateIssue(input:{id:$id issueTypeId:"IT_..."}){issue{issueType{name}}}}' -F id="I_kwD..."`. Also: the `Issue(number:N)` query root does not exist — wrap in `repository(owner:..,name:..){issue(number:N){...}}` or take the node_id from the REST issue JSON. The issueTypeId values (Bug/Feature) in the triage group instructions are still valid.
