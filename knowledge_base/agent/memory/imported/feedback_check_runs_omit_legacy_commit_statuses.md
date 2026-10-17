---
name: feedback_check_runs_omit_legacy_commit_statuses
description: "COUNTING / CLEARING CI CHECKS: `commits/<sha>/check-runs` and `commits/<sha>/status` are two independent surfaces and the rule is BIDIRECTIONAL — check-runs miss legacy/cross-repo statuses (`license/cla`, `SlangPy Tests`, which the merge queue gates on: slang#12328 evicted with 55/55 check-runs green), and `status: success` can be a lone `license/cla` with every Actions job still running (slangpy#1073). Query both and sum; name a pending check, never just count it. Measured slang-rhi#809: 21 check-runs + 1 status = 22."
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

## ⛔ The rule is bidirectional: the gating case, then the inverse

**Gating (slang#12328, 2026-08-04).** All 55 check-runs were green, and the merge queue still evicted
the PR (`failed_checks`). The evictor was a cross-repo `SlangPy Tests` **commit status** on the
merge-group commit. The queue reads both surfaces, so a check-runs-only sweep confidently clears a PR
that is about to be evicted. The recipe for the right commit is in
[[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]].

**Inverse (slangpy#1073 head `09ac1d91`, 2026-08-05).** `commits/<sha>/status` returned
`state: success` with `total_count: 1`, and that one status was `license/cla`. All 14 build/test jobs
are check-runs, and one was still `in_progress`. So **"commit status green" says nothing about CI**. I
had cited exactly that phrase to an operator as evidence a PR was green.

⇒ Check-runs miss statuses, and statuses miss all of Actions. Never let either surface stand for "CI".

**Name the pending check, don't count it.** The one unsettled job was
`build (windows, x86_64, msvc, Debug, 3.10)`, the only platform where the bug under test reproduces.
"1 of 14 pending" and "the only reproducing platform hasn't reported" are different facts, and the
count hides the second.

## Why it was nearly missed: the fact was filed under the wrong key
I already held it — [[feedback_two_nv_slang_bot_identities_cla_gate]] records `license/cla` as
living only on `commits/{sha}/status`, but under *bot identity / CLA gating*, where nobody counting
CI checks looks. This file is the counting-oriented copy; keep the two in sync. Diagnosing *why* a
held fact didn't fire has two causes with different fixes — see
[[feedback_a_rule_that_doesnt_fire_is_a_retrieval_failure]].

Siblings: [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] (right surface, truncated) ·
[[feedback_correction_must_sweep_whole_file]] (ask where else a claim needs to live).
