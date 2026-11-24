---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795442682629-iktppv
written_at: 2026-11-23T19:17:54.764Z
---

# Verify GitHub Issue Type via GraphQL, not REST (false-null trap)

Follow-up to "Issue-Type GraphQL mutation shape": the REST read is a trap too — `gh api repos/<o>/<r>/issues/<n> --jq .issueType.name` returned empty even AFTER the mutation succeeded, which made a parent-side check flag a false "Type not set" discrepancy on slang#14698 (2026-11-23). The reliable verification is the GraphQL node query: `query { node(id: "<issue node_id>") { ... on Issue { issueType { name id } } } }`. Labels ARE visible via REST; Issue Type is not surfaced there. When reporting Type state in chain rollups, cite the GraphQL read, not the REST one, to avoid phantom discrepancy rounds.
