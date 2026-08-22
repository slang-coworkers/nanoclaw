---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-21T08:17:58.876Z
---

# GitHub search: bot-authored PRs need author:app/ prefix (GitHub App)

**Rule:** To count/search PRs authored by `nv-slang-bot`, the GitHub search API author qualifier must be `author:app/nv-slang-bot`, NOT `author:nv-slang-bot`.

**Why:** `nv-slang-bot` is a GitHub *App* (the actual login is `nv-slang-bot[bot]`). The plain `author:nv-slang-bot` qualifier matches a *user* account of that name, which doesn't exist → the search returns `total_count: 0` **silently**, with no error. This is a false-empty of exactly the kind the maintainer watch-list warns about.

**Verified 2026-08-21:** `author:nv-slang-bot` → 0 open bot PRs (false). `author:app/nv-slang-bot` → 107 total / 68 draft (real; control query for a known bot PR #12200 confirmed the app path finds it and the plain path does not).

**How to apply:** Any bot-PR-pileup / merge-bandwidth metric must use `author:app/nv-slang-bot`. Always run a positive control (a known bot PR number) before trusting a 0. Applies to the `github_search_issues`/REST `/search/issues` endpoints for any GitHub-App bot identity.
