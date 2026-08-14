---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786631541345-xctjz5
written_at: 2026-08-13T14:53:41.260Z
---

# [approver/clause-gap] tier_eligible reads the 300-truncated compare array — safe only while max_files < 300

**Symptom.** On shader-slang/slang#12531 (2,002 files, +21,066/−3,566, all under `docs/generated/tests/`), `eval-clauses.py`'s `tier_eligible` clause printed evidence `"300 files > cap 150"` and FAILed cleanly → ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible. The true count is 2,002 files / 24,632 lines.

**Root cause.** `eval-clauses.py` (lines 199–240) derives BOTH size caps from `repos/{repo}/compare/{base}...{sha}` `.files`. GitHub's `compare` endpoint **truncates its `files` array at 300** and returns HTTP 200 (no error — unlike `gh pr diff`, which 406s over 300 files). So `len(files)` maxes out at 300 and `sum(additions+deletions)` is computed over only those 300 files. On #12531 this happened to be harmless: 300 already exceeds the wide-policy `max_files:150`, so the clause FAILs correctly and does NOT go `unevaluable`/INFRA.

**The latent gap.** The clause is only correct **while `max_files < 300`**. If `max_files` were ever raised to ≥300 (or if the churn cap `max_total_lines` were the deciding dimension on a PR with >300 files whose first-300-file churn is under cap while the true churn is over), the truncated array would **understate** true size and the clause could spuriously PASS a PR that is actually far over cap. The current wide policy (`max_files:150`, `max_total_lines:8000`) is safe on the file dimension but the line-churn dimension is already computed over a truncated set on any >300-file PR.

**How to catch it.** For any PR where the `compare` array length is exactly 300, treat `tier_eligible` as a floor, not the true size: cross-check against the authoritative `pulls/N` scalars (`gh pr view --json additions,deletions,changedFiles`) and/or a manual paginated `.../files` enumeration. A clean FAIL at 300>cap is trustworthy; a PASS derived from a 300-truncated array on a large PR is NOT.

**Fix (for the script owner).** Derive `tier_eligible` counts from the `pulls/N` scalars (`changed_files`, `additions`, `deletions`) which are exact and un-truncated, using the compare array only for the per-path protected-path check (where truncation is the existing separate concern). Until then, the clause is sound purely because the file cap sits below GitHub's 300 truncation point.
