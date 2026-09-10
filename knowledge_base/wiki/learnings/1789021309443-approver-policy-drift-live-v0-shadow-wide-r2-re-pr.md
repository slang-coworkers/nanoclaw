---
title: "[approver/policy-drift] live v0-shadow-wide-r2 re-protects .github/workflows/**; wiki recall is stale"
type: learning
topic: review-approval
source: learnings/1789021309443-approver-policy-drift-live-v0-shadow-wide-r2-re-pr.md
---

# [approver/policy-drift] live v0-shadow-wide-r2 re-protects .github/workflows/**; wiki recall is stale

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789020923084-wkplrk
written_at: 2026-09-10T06:21:49.443Z
---

# [approver/policy-drift] live v0-shadow-wide-r2 re-protects .github/workflows/**; wiki recall is stale

## Symptom

On slang PR #12983 (a CI change touching `.github/workflows/pr-board-sync.yml` and `.github/workflows/pr-board-sync.md`), Step-0 recall from `/workspace/shared/wiki` confidently said ".github/** is NOT protected under the current live policy — `v0-shadow-wide` removed it." Acting on that recall would have predicted WOULD_APPROVE and skipped the protected-path handoff — a potential false-safe on a supply-chain-sensitive workflow file.

## Root cause

Policy version drift the wiki hasn't caught up to. Two different signed policies:
- `v0-shadow-wide` (2026-08-04) — removed `.github/**` and `*.yml` from `protected_paths`. This is what the wiki concept pages still describe.
- `v0-shadow-wide-r2` (2026-09-09, currently MOUNTED at `/workspace/extra/approver-policy/APPROVAL_POLICY.json`) — `protected_paths` = `[".github/workflows/**"]`. Intent comment: "abstains only on GitHub workflow files" (re-protecting the CI supply-chain surface). Also `require_ci_green:true`, all associations trusted, `allow_fork_head:true`, caps 1M lines / 100k files.

`eval-clauses.py` resolves policy in order: `--policy` > `<ws>/policy/APPROVAL_POLICY.json` > group-mounted `/workspace/extra/approver-policy/APPROVAL_POLICY.json` > bundled default. With no per-PR policy staged it correctly used the mounted `v0-shadow-wide-r2` and FAILed `no_protected_paths`.

## How to catch it

The recall agent itself flagged the right discipline: **do not predict a protected-path outcome from wiki recall — run `eval-clauses.py` and trust its emitted `policy_version`.** `clauses.json` echoes `policy_version`; verify it says `v0-shadow-wide-r2` (or whatever is current) before trusting the clause verdicts. Recall is a prior, never authority on the live policy surface.

## Fix

For any `.github/workflows/**` change under the current mounted policy, expect a clean **ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths** (a policy abstain, excluded from agreement scoring — NOT an infra defect, and NOT a false-safe if you abstain). This applies to slangpy-pr-approver too (same mounted policy). Secondary trap avoided: synthesize `review/review-doc.md` BEFORE running `eval-clauses.py` — otherwise `commit_match` reports `unevaluable` ("review doc absent") and you'd log a spurious infra reason_code `CLAUSE_UNEVALUABLE:commit_match` instead of the true `CLAUSE_FAIL:no_protected_paths`.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789021309443-approver-policy-drift-live-v0-shadow-wide-r2-re-pr.md`_
