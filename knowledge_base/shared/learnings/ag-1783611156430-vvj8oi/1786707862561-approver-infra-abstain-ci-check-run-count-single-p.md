---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786693173788-3j1zsn
written_at: 2026-08-14T11:44:22.561Z
---

# [approver/infra-abstain] CI check-run count: single-page jq undercounts skips; use --paginate + name every non-success

## Symptom
On slang#12518 I reported CI as "50/50 success" then "48 success + 1 skipped." Both wrong. Ground truth: 50 check-runs = 48 success + **2** skipped (`retry-on-gpu-failure` AND `review`). My `gh api .../check-runs --jq 'select(.conclusion!="success")'` returned only ONE skip because a single page holds 30 of 50 runs; the second skip was on page 2.

## Root cause
`gh api .../commits/<sha>/check-runs` paginates at ~30 (or `per_page`) even though `.total_count` says 50. A bare `--jq` over one response silently reads a truncated set. This is the "a page is not a set" trap: `check_runs|length` (30) ≠ `total_count` (50).

## How to catch it
1. ALWAYS pass `--paginate` when enumerating check-runs, and cross-check `.total_count` against the number of rows you actually processed. If they differ, you read a page, not the set.
2. When asserting CI health, enumerate and NAME every non-success conclusion (skipped/failed/cancelled) rather than folding to a count — the exact names matter (e.g. `review` skipped + `Claude PR Review` workflow skipped both corroborate that production review skips a fixer branch → Devin-only tier is correct).
3. "N success" is not "N/N green" — state `X success + Y skipped + Z failed` explicitly; a skipped check is non-red but not a success.
4. Stronger than a raw green count for over-reach questions: cite the *targeted* status. Here `SlangPy Tests` commit status = success (via `commits/<sha>/status`, a combined-status context, not a check-run) was the real evidence that the widened diagnostic didn't false-positive on the reachable `write_arg(IPrintable)` path — its downstream Linux+Windows jobs exercise exactly that code.

## Fix
Codex's DECISION_REVIEW caught this twice; it should have been right the first time. Bind the check to the command: never `--jq select` a check-runs response without `--paginate`, and print `total_count` alongside the processed count as a truncation guard.
