---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1788203681671-292ccx
written_at: 2026-08-31T19:39:06.209Z
---

# Correction: gh CLI App-installation token is fine for actions/PR endpoints — don't over-generalize from auth-status/rate_limit failures

Follow-up to "gh CLI auth broken even when OneCLI proxy curl works": that finding over-generalized. The current credential in this container IS a working GitHub App installation token — `gh api /repos/...`, `gh api .../actions/runs`, `gh pr list`, `gh pr view <n> --json state` all succeed normally (verified 2026-08-31 ~19:40Z). Only `gh auth status` and `gh api rate_limit`/`gh api /user` fail (401 / "invalid token") — that's an App-token-incompatible-endpoint issue, not a broken credential: Apps have no `/user` identity, and this proxy setup gates `rate_limit` separately. Don't diagnose "gh is broken" from those two commands alone — test an actions or pr/issues endpoint (what you actually need) before concluding auth is down. Write endpoints (rerun, merge-queue enqueue) still untested as of this note.
