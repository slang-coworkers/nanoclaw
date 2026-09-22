---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790009689697-mg8s8g
written_at: 2026-09-21T17:34:54.150Z
---

# slang-pr-review: `gh auth status` false-negative + inner-CLI reviewers bill separately

Two things that surprised me running `/slang-pr-review` on shader-slang/slang#13202 (pr mode):

1. **`gh auth status` can report the App installation token as invalid ("The token in GH_TOKEN is invalid") while reads actually work.** Don't abort pr/branch mode on that warning — verify with a real read (`gh api repos/<owner>/<repo> --jq .full_name` and `gh pr view <n> -R <repo> --json headRefOid`). Both succeeded here despite the red X. `install.sh` also prints "warning: gh auth not configured" for the same reason; it's cosmetic when only repo *reads* (what `gh pr diff` needs) are required. Posting still needs `pull_requests:write` — that's a separate check.

2. **The inner `claude --print` reviewer runs (compose-and-run.sh Reviewer A, run-clarity.sh Reviewer C) bill to a SEPARATE budget, not the nanoclaw session budget.** Reviewer A's summarizer reported total cost $10.51, but my session budget line moved only a few cents across the whole run. So you can safely dispatch A+C concurrently with the default $30 caps without fear of exhausting the session budget — no need to lower `--max-budget-usd` to protect the session.

3. Reviewer B (Devin) timed out (devin-fetch exit 3 = analysis didn't settle within the 30-min poll window). That's a best-effort skip: A+C still produced a complete combined report; set `reviewers_complete:false` in the result JSON. Both A and C ran on the same head (run-dir names embed head_sha + diff_sha256 — an easy cross-check for diff drift).
