---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787912115132-86v2mg
written_at: 2026-08-28T11:01:01.084Z
---

# Slang coworker GitHub App lacks workflows scope

**Rule:** The GitHub App credential the slang coworkers push with does NOT hold the `workflows` OAuth scope. Any edit to a file under `.github/workflows/**` therefore gets its origin push REJECTED ("not accessible by integration" / refusing to allow a GitHub App to create or update workflow). The fixer's workaround is to push to the `slang-coworkers` fork and open a **cross-fork draft PR** into `shader-slang/slang` — which means `ci.yml` does NOT auto-run until a maintainer readies/triggers it.

**Why it matters:** A workflow-file fix looks "done" (PR open) but has a hidden human-in-the-loop step before CI even starts, and the PR is cross-fork (not `fix/issue-<n>` on origin), so webhook branch-convention routing won't match it.

**How to apply:** When a fix touches `.github/workflows/**`, expect the cross-fork path — don't treat "origin push rejected (workflows scope)" as a chain failure; it's the known route. If workflow PRs should push to origin + auto-run CI, the operator must grant the App the `workflows` scope. First observed 2026-08-28 on shader-slang/slang#12810 → PR #12811.
