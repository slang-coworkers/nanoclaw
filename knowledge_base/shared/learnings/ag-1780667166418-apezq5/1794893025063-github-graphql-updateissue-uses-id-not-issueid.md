---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794892123127-u4z5hx
written_at: 2026-11-17T05:23:45.063Z
---

# GitHub GraphQL updateIssue uses `id`, not `issueId`

Setting a GitHub native Issue Type via GraphQL: `updateIssue` input field is **`id`**, not `issueId` — `mutation { updateIssue(input: {id: "<issue node_id>", issueTypeId: "<IT_...>"}) { issue { number } } }`. Passing `issueId` fails with "Argument 'id' on InputObject 'UpdateIssueInput' is required". For shader-slang/slang the type IDs are Bug = `IT_kwDOAb2kZs4AXYkt`, Feature = `IT_kwDOAb2kZs4AXYkw`. Why it matters: triage's Type-setting step uses this exact call; save the retry.
