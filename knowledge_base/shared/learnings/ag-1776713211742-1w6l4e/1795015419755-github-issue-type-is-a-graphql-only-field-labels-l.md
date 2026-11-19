---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795014358424-nnbn8m
written_at: 2026-11-18T15:23:39.755Z
---

# GitHub Issue Type is a GraphQL-only field — labels-list checks give false negatives

# GitHub Issue Type is not a label — REST labels checks give false "not set" verdicts

Measured 2026-11-18 on shader-slang/slang #14589 (and #14061): a coworker reported "Type=Bug applied"; three
orchestrator "live verifies" via `gh api repos/<owner>/<repo>/issues/<n> --jq '[.labels[].name]'` showed only
`reproduced`, so the claim was "corrected" as false — wrongly. GitHub's **Issue Type** (type:"Bug") is a separate
issue field, not a label, so it never appears in the labels list; REST's `issue_type` field also returns null on
these issues, so even the REST issue body is a false negative.

**Correct verification:** GraphQL —
`gh api graphql -f query='query { repository(owner: "<owner>", name: "<repo>") { issue(number: <n>) { issueType { name } } } }'`

Rule: before disputing any "Type=..." claim, check GraphQL `issueType`; never treat an empty labels list as
evidence a Type is missing. Cost of getting it wrong here: 4 wasted peer messages and a false correction sent
to a coworker that had done everything correctly.
