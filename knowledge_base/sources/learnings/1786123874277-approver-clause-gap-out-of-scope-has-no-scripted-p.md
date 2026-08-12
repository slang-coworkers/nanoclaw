# [approver/clause-gap] OUT_OF_SCOPE has no scripted predicate — and the COI case is the one that needs it most

## Symptom

`slang-coworkers/nanoclaw#1145` patched **the approver's own Devin scraper**
(`container/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh` + its test).
The correct call is `ABSTAIN_POLICY:OUT_OF_SCOPE:approver-harness` — but
`APPROVAL_POLICY.json v0-shadow-wide` has **no repo-class predicate and no
conflict-of-interest predicate** (`protected_paths` is only
`**/slang-tag-version.h`), and `OUT_OF_SCOPE:*` is **not in the reason_code set
SKILL.md:134-138 lists**, despite two prior ledger rows (nanoclaw#982, #1007)
already using it.

So the determination rests entirely on the approver **recalling precedent**.
On this run 6/6 clauses PASSED — nothing mechanical fired. Had recall missed,
the clause output pointed straight at a merits decision on a PR the approver is
structurally unable to review.

## Root cause

Two separate gaps that look like one:

1. **Repo class** — every clause is calibrated for `shader-slang/slang`; nothing
   checks the repo *identity*.
2. **Conflict of interest** — nothing checks whether the changed paths *are the
   deciding harness itself*. This is the sharper gap: a COI is not a property of
   the repo, so widening a repo predicate would not catch an own-harness PR
   landing in an in-domain repo.

Note what did **not** apply: #982's story was "gh api 401 ⇒ out-of-domain
symptom". Here `gh api` resolved `MEMBER` cleanly, so the 401 heuristic was
absent — reusing #982's *symptom* as the trigger would have missed this
entirely. **The predicate that fired in precedent was repo identity / COI, never
the 401.** (Grep precedent for the predicate that fired, not the outcome.)

## How to catch it

Before any merits work, ask: *do the changed paths include the instrument that
produces my own review signal, or the rules I decide by?* If yes, that is a COI
regardless of repo, and no review signal I can gather is independent — the only
available signal would be produced **by the artifact under decision**.

Mechanical check (what I ran, and what should be a clause):

```
gh pr diff <n> --repo <r> --name-only \
  | grep -E 'container/skills/(slang|nanoclaw)-pr-(approver|review-runner)/|APPROVAL_POLICY'
```

Also verify the COI in-container rather than assuming it: I confirmed the patch
under decision was **already running here** (`grep -c checksSettled` → 2 and
`View results` → 3 in both the 223-line nanoclaw and 360-line slang copies).
`~/.claude/skills/` is **per-container**, so "the PR is merged" and "my container
runs it" are different claims.

## Fix

- Add two Step-1 clauses: `repo_in_domain` (`repo == shader-slang/slang` for the
  slang approver) and `no_self_harness_paths` (changed paths ∩ approver/runner
  skill dirs ∪ policy files). Both are **data-only** — they read paths and repo
  name, never the diff body — so they are legitimate Step-1 predicates and won't
  evaluate `unevaluable`.
- Add `OUT_OF_SCOPE:<family>` to SKILL.md's `ABSTAIN_POLICY` reason_code list so
  the three existing ledger rows stop being off-enum.
- **An absent scripted predicate is not permission to ignore a verified COI** —
  flag the policy gap upward; do not stretch an unrelated clause to fit.

## Bonus, same run: re-run an `unevaluable` clause before believing it

`commit_match` reported `unevaluable` on the first pass purely because clauses
ran **before** `review/review-doc.md` was staged. Per SKILL.md:59-60 the
Devin-only tier writes `commit_id = commit_sha`, so it PASSES once the doc
exists — re-running gave **6/6 PASS**. Reasoning about the `unevaluable` instead
of re-running would have recorded a spurious
`ABSTAIN_INFRA:CLAUSE_UNEVALUABLE:commit_match`. **An ordering artifact and a
real infra gap emit the identical token; only re-running distinguishes them.**
