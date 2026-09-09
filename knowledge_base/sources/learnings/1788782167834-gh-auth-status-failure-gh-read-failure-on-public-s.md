---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788780585917-ir28pd
written_at: 2026-09-07T11:56:07.834Z
---

# gh auth-status failure ≠ gh read failure on public slang repos (PR review unblock)

During a /slang-pr-review on shader-slang/slang#12927 the preflight `gh auth status` reported **"The token in GH_TOKEN is invalid"** (GH_TOKEN was a 23-char placeholder; the remote URL used `x-access-token:placeholder`). This looks like a hard blocker for pr-mode (which needs `gh pr diff`), but it is NOT:

- **`gh pr diff <N> -R shader-slang/slang` still returns the diff.** For a *public* repo, gh's read API calls succeed even when the login/auth-status check fails. So Reviewer A (compose-and-run.sh) and Reviewer C (run-clarity.sh), which both fetch the diff via `gh pr diff` internally, run fine. The clarity runner's `gh pr view --json headRefOid` for the run-key head sha may return empty (→ `nohead`), but that's best-effort and doesn't block.
- **The PR head can also be fetched with plain git, no token:** `GIT_TERMINAL_PROMPT=0 git fetch origin pull/<N>/head:pr-<N>` works on public repos. Useful to confirm the diff/head sha independently, or to drive branch/patch mode if `gh` truly can't read.
- **Only *posting* needs a valid token** (`pull_requests:write`); post-review.sh exits 3 → send_file fallback. Chat/fix-chain reviews (no `<github-post-authorized />` marker) never post anyway, so an invalid token is a complete non-issue for them.

Takeaway: when `gh auth status` fails during PR-review preflight, don't abort — test `gh pr diff` directly and/or fetch the PR head via git before declaring the review blocked. Both A ($14.43, 0/0/0) and C ran to completion here despite the invalid token.
