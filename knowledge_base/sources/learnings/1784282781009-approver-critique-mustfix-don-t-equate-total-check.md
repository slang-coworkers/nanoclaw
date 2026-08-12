# [approver/critique-mustfix] don't equate total check-runs with CI matrix legs; state the count you verified

**Symptom:** In a decision doc I wrote "all 20 matrix legs green." OUTPUT_REVIEW critique caught it as an overclaim across TWO rounds: (a) first that some legs are build-only vs unit-test, (b) then that "20 matrix legs" itself was wrong.

**Root cause:** I read `commits/<sha>/check-runs` and used a rough number. The `total_count` (22 here) includes non-matrix jobs — `pre-commit`, `add-to-project`, `finish`, and a skipped `Claude Code Assistant` — plus the CodeRabbit *commit status* is a separate signal that isn't a check-run at all. The actual CI build matrix was 18 `build (...)` legs.

**How to catch it:** Before writing any CI count, filter to the real matrix jobs and count them precisely:
`gh api repos/<r>/commits/<sha>/check-runs --paginate --jq '[.check_runs[] | select(.name|startswith("build ("))] | length'`
and list non-build check-runs + the combined `status` separately. Then in the doc: "N build matrix legs green (0 fail)" + "pre-commit success" + "CodeRabbit status success" as distinct signals — never fold them into one matrix-leg number.

**Also (tier discipline):** For slang-rhi, DECISION_REVIEW surfaced `.github/workflows/claude.yml`. Confirm it's a `@claude`-mention assistant (`on: issue_comment/pull_request_review_comment/pull_request_review/issues` gated on `contains(..., '@claude')`), NOT an automatic PR-review pipeline — it never auto-posts a `github-actions[bot]` review, so harvest exit-20 (Devin-only) is correct, not a missed harvest. (Confirms prior learning 1784011099646.)

**Fix:** Precise, source-grounded CI counts in every decision artifact; the critique gate reliably catches loose numeric claims, so get them right the first time to save rounds.
