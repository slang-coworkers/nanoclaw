---
name: feedback_check_runs_omit_legacy_commit_statuses
description: "COUNTING / CLEARING CI CHECKS: `commits/<sha>/check-runs` is only one surface — legacy commit statuses (e.g. `license/cla`) live on `commits/<sha>/status` and never appear in check-runs at any per_page. Query both and sum; the PR web UI merges both, so its count won't match a check-runs-only count. Measured slang-rhi#809: 21 check-runs + 1 status = 22."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-05
---

# check-runs omits legacy commit statuses — an API total is a claim about ONE surface

Split 2026-10-01 from [[feedback_filter_latest_returns_two_suites_per_sha]], which covers
*currency* (which suite is the live verdict). This one covers *completeness* (did you see all the
checks at all) — an independent failure: a perfect suite reconciliation still misses a check that
never appears in `check-runs`.

**Measured 2026-08-05, slang-rhi#809 head `6eb4ffe203`:**

| surface | call | result |
|---|---|---|
| Checks API | `commits/<sha>/check-runs?per_page=100` | `total_count: 21`, all `success` |
| Legacy Statuses API | `commits/<sha>/status` | `state: success`, 1 status — `license/cla` |

`slangpy-triager` reported 22; I would have reported 21. Nothing errors, no field is null, no page
is truncated — the missing item belongs to a different endpoint (schema partitioning, not
pagination). The GitHub PR UI merges both surfaces, and the UI number is what a maintainer quotes.

**Recipe — always query both, then sum:**
```bash
SHA=$(gh api repos/{o}/{r}/pulls/{N} --jq '.head.sha')
gh api "repos/{o}/{r}/commits/$SHA/check-runs?per_page=100" \
  --jq '{n: .total_count, conc: [.check_runs[].conclusion]|group_by(.)|map({(.[0]//"null"):length})|add}'
gh api "repos/{o}/{r}/commits/$SHA/status" --jq '{state, n: (.statuses|length), ctx: [.statuses[].context]}'
```
`statusCheckRollup` (GraphQL / `gh pr view --json`) returns both kinds in one list and does not
dedup repeated runs ([[feedback_gh_pr_checks_dedups_runs_rollup_does_not]]).

## Why it was nearly missed: the fact was filed under the wrong key
I already held it — [[feedback_two_nv_slang_bot_identities_cla_gate]] records `license/cla` as
living only on `commits/{sha}/status`, but under *bot identity / CLA gating*, where nobody counting
CI checks looks. This file is the counting-oriented copy; keep the two in sync. Diagnosing *why* a
held fact didn't fire has two causes with different fixes — see
[[feedback_a_rule_that_doesnt_fire_is_a_retrieval_failure]].

Siblings: [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] (right surface, truncated) ·
[[feedback_correction_must_sweep_whole_file]] (ask where else a claim needs to live).
