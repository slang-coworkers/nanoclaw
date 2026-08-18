---
title: "[approver/clause-gap] ci_green_on_sha reads combined status only — blind to GitHub Actions check-runs, and defaults to require_ci_green=true"
type: learning
topic: review-approval
source: learnings/1785787076247-approver-clause-gap-ci-green-on-sha-reads-combined.md
---

# [approver/clause-gap] ci_green_on_sha reads combined status only — blind to GitHub Actions check-runs, and defaults to require_ci_green=true

## Symptom

`eval-clauses.py` clause `ci_green_on_sha` can report `pass — combined status=success`
on a commit whose actual builds are still `in_progress`, failed, or never ran.
Fails toward GREEN, which is the dangerous direction for an approval gate.

Verified on shader-slang/slangpy#1090 @ `5c384a20b11bcc4bc8a663d914859e569b2292bb`:

- `GET repos/{repo}/commits/{sha}/status` → `{"state":"success","n":2}`
  and those two statuses are **`license/cla`** and **`CodeRabbit`** — *no build at all*.
- `GET repos/{repo}/commits/{sha}/check-runs` → **16** entries (14 success, 2 skipped)
  — every real build job, none visible to the clause.

So on this PR "combined status=success" was literally the CLA bot plus a review bot.
CI happened to be green, so the decision was unaffected — but the signal the clause
consumed carried none of that information.

## Root cause

`eval-clauses.py:187` derives CI state exclusively from the legacy combined-status
API (`commits/{sha}/status`). `grep -cF check-runs eval-clauses.py` = **0** in BOTH
`slang-pr-approver` and `slangpy-pr-approver`.

GitHub Actions jobs are **check-runs**, not commit statuses. The two APIs are
disjoint surfaces: combined status only aggregates legacy status contexts posted by
external apps. A repo whose CI is entirely GitHub Actions can therefore report
`state:success` with zero builds evaluated — and an empty status list degrades to
`state:"pending"`/none rather than to anything that reads as "unknown build state".

## Why the conservative config is the one that breaks

`eval-clauses.py:183` — `if not policy.get("require_ci_green", True)` — defaults the
key to **`true`** when absent. The relaxed mounted policy (`v0-shadow-relaxed`,
`require_ci_green:false`) short-circuits at :184 and never queries, so the defect is
inert in shadow mode. The **bundled** policy (`v0-shadow`) ships
`require_ci_green:true`. Anyone tightening the gate — or running without a mounted
policy, where the `True` default applies — activates the buggy path. The stricter
setting is strictly *less* trustworthy than the lax one. Do not read "we require CI
green" as "we verified CI".

## How to catch it

For any commit, diff the two APIs before trusting a green verdict:

```bash
gh api "repos/$R/commits/$S/status"     --jq '{state,n:(.statuses|length)}'
gh api "repos/$R/commits/$S/check-runs" --jq '[.check_runs[]|{name,status,conclusion}]'
```

If `.statuses[]` contains no build context while `check_runs` is non-empty, the
clause is reading a proxy with no build signal in it.

## Fix

`ci_green_on_sha` must consult **both** surfaces and require:
`combined status != failure` AND every required check-run `status == "completed"`
with `conclusion in {success, skipped, neutral}`. Critically, **absence of build
signal on both surfaces must be `unevaluable`, not `pass`** — the current code has no
path that distinguishes "no builds ran" from "all builds passed". Until fixed, a
`require_ci_green:true` config should be treated as unverified rather than enforced.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785787076247-approver-clause-gap-ci-green-on-sha-reads-combined.md`_
