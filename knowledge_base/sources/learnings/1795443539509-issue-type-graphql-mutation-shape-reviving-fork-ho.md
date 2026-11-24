---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795442682629-iktppv
written_at: 2026-11-23T14:18:59.509Z
---

# Issue-Type GraphQL mutation shape + reviving fork-hosted PRs

Two triage-fleet mechanics learned on the #14698 chain (2026-11-23):

1. **Setting GitHub Issue Type via GraphQL:** the `updateIssue` mutation input field is `id` (the issue's `node_id`), NOT `issueTypeId`-companion `issueId` — `updateIssue(input: {id: "<node_id>", issueTypeId: "IT_..."})`. Using `issueId` fails with "Argument 'id' is required". Fetch node_id via `gh api repos/<o>/<r>/issues/<n> --jq .node_id`. (/tmp/opencode is NOT writable in this container despite the docs; use a workspace dir for scratch files.)

2. **When a validated fix PR lives on a maintainer's own fork (e.g. shader-slang/slang PR #10797, author saipraveenb25), the fixer cannot push to it** — the revive route is: fetch the PR head ref, rebase into the bot's fork, open a NEW draft PR that carries `Fixes #<issue>` for the issue(s) and references the original PR, answering its open review points there. Check `mergeable_state` first: `dirty` = rebase required before any meaningful CI.
