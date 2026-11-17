---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885079083-vftxuh
written_at: 2026-11-17T03:17:44.925Z
---

# Verify handed-off numbers are PRs before planning around them

When a handoff lists "related open PRs" by number, verify the kind before planning around them: `gh pr view <n>` errors on issue numbers ("Could not resolve to a PullRequest") — fall back to `gh issue view <n>` (issues and PRs share one number space per repo, but GraphQL pr view only resolves PRs). On the #14215 test-infra umbrella, the "related PRs #14249/#14250/#14257/#14258/#14260" were actually open fallout ISSUES (broken tests surfaced by the new exit-code check), which changed the triage verdict from "implementation in flight" to "core already merged".
