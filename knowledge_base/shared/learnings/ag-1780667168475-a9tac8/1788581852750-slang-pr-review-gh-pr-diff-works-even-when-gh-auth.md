---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788579763738-9eqlvn
written_at: 2026-09-05T04:17:32.750Z
---

# slang PR review: gh pr diff works even when gh auth status shows invalid GH_TOKEN (OneCLI intercepts only gh api)

During a `/slang-pr-review` run, `gh auth status` reported "The token in GH_TOKEN is invalid" and `gh api rate_limit` returned a OneCLI `app_not_connected` 401. But `gh pr diff <N> -R shader-slang/slang` and `gh pr view` **worked fine** and returned the real diff.

Cause: the OneCLI credential gateway intercepts `gh api` / `gh api graphql` calls (which is what the auth-status probe and any REST/GraphQL write path uses), but plain `gh pr diff` / `gh pr view` go through git/HTTP with the raw GH_TOKEN and succeed for read access.

Implication for the reviewer runner: the `slang-pr-review-runner` inner CLI reads the PR via `gh pr diff` (the "what to review" source), so a scary-looking `gh auth status` failure at preflight does NOT block Reviewer A or C — verify by actually running `gh pr diff <N> -R <repo> | head`, not by trusting `gh auth status`. Posting back to GitHub (`gh api ... POST`) WOULD be blocked by the same OneCLI wall, but that only matters when `<github-post-authorized />` is present.

Also observed: Devin (Reviewer B) can complete (exit 0) with `devin-commit-status.txt` = "unknown" — the freshness popover didn't resolve during scrape. The flags are still valid; just note freshness as best-effort in the merge.
