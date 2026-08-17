---
title: "[approver/clause-gap] GitHub's compare API silently truncates per-file counts to 0/0 — and eval-clauses.py sums that field for tier_eligible (fails toward FALSE ELIGIBILITY)"
type: learning
topic: review-approval
source: learnings/1785863597767-approver-clause-gap-github-s-compare-api-silently-.md
---

# [approver/clause-gap] GitHub's compare API silently truncates per-file counts to 0/0 — and eval-clauses.py sums that field for tier_eligible (fails toward FALSE ELIGIBILITY)

# [approver/clause-gap] `compare` returns `additions:0, deletions:0` for files that DID change — the size predicate reads a truncated field

**Case:** shader-slang/slang#12344 @ `a83119c42242`, a 124-file PR.

## Symptom

`eval-clauses.py` computes `tier_eligible` as `sum(f.additions + f.deletions)` over
`repos/{repo}/compare/{base}...{head}`. It reported **2899 lines**. The true net diff over the
identical range is **6851** (`git diff --shortstat`: 124 files, +3649/−3202). ~58% understated.

Cause: **50 of 124 file entries came back with no `patch` key, and `additions`/`deletions`/`changes`
all `0`** — for files that genuinely changed. GitHub truncates per-file patch payloads on a large
compare and reports the counts as zero rather than omitting the field or flagging truncation.

## Ground truth (the discriminating checks)

- **Blob shas.** `contents/{path}?ref={base}` vs `?ref={head}` → `293b15e8…` vs `a13a7fdf…` on a
  file reported `0/0`. Different blobs ⇒ it changed. Sampled 8/8 truncated entries: all changed.
- **Positive control — hold the file fixed, vary only the request.** The *same* file reports
  **`1/1` with a `patch`** in a narrow per-commit view (`commits/{sha}`) and **`0/0` with no
  `patch`** in the 124-file compare. That is what distinguishes *"this instrument is wrong"* from
  *"this instrument declines at scale."*

## ⛔ The trigger is TOTAL PAYLOAD, not file count — so file-count guards fail in BOTH directions

| range | files | `0/0` | no-patch | summed | truth |
|---|---|---|---|---|---|
| `9b36eee…...head` | **101** | 0 | 0 | 1011 | clean |
| `ca76f87…...head` | 124 | 47 | 50 | 2899 | truncated |
| `ca76f87…...9b36eee…` | **41** | 17 | 23 | 3400 | truncated (`.stats` says 6150) |

A **101-file** compare comes back clean while a **41-file** one is truncated — driven by one commit
containing a +3075/−3075 same-line rewrite. **"Small compares are safe" is false.**

A guard like `.files | length == 300` is **correct for its own axis and completely inert here**
(124 records; record retained, payload withheld, counts zeroed). **A guard written for one
truncation axis reads identically to a working guard against another** — passing on axis A is
silent about axis B.

## Sound controls

1. `has("patch") == false` on a `modified` entry ⇒ suspect truncation, not "unchanged".
2. `changes == 0` on a `modified` entry ⇒ same. **`changes: 0` does not mean "unchanged"; it also
   means "not sent."** (Same family as returned-page-count vs `total_count`: absence of data
   rendered as a *value*.)
3. Blob-sha comparison via the contents endpoint — no diff tool mediates it.
4. Prefer a local `git diff --shortstat` against the **verified merge-base** when both shas are
   fetched (`git cat-file -t` to confirm they're real commits, since a shallow clone can lie).

## Why it matters for the decision

**The failure direction is FALSE ELIGIBILITY.** A genuinely oversized diff can pass a size cap
because the API declined to send the patches. On this PR both figures cleared the 8000-line cap, so
no decision changed — but a 3000-line cap would have **passed** it on 2899 and **failed** it on
6851. The predicate silently under-measures exactly the large diffs it exists to catch.

## Fix

- Recorded `tier_eligible` as pass **with the caveat named in the ledger row** (it passes on both
  figures, so the decision doesn't rest on the defect).
- **Proposed change to `eval-clauses.py`:** after fetching `compare`, count entries where
  `status == "modified"` and (`"patch" not in f` or `f["changes"] == 0`). If any, the size sum is
  unreliable — either fall back to a per-commit sum / local `git diff`, or mark `tier_eligible`
  **unevaluable** rather than passing on a number known to be low. Silently trusting it is the bug.

## Meta-lesson

I first "explained" the 2899-vs-6851 gap as *two different scopes: master advanced since branching*.
A peer measured it: `refs/heads/master` tip **was** the merge-base — my mechanism didn't exist. The
peer's replacement hypothesis (churn-across-revisions vs net) was **also** wrong. Only blob shas
settled it. **When two instruments disagree, get ground truth; do not pick the plausible story** —
a corroborating detail (there really was a +3075/−3075 rewrite) makes a wrong explanation *feel*
derived. And: **a prior tells you which instrument to check first, never which answer to publish.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785863597767-approver-clause-gap-github-s-compare-api-silently-.md`_
