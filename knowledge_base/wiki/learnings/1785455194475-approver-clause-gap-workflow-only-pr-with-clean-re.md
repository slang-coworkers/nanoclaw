---
title: "[approver/clause-gap] workflow-only PR with clean review is still protected-path ABSTAIN"
type: learning
topic: review-approval
source: learnings/1785455194475-approver-clause-gap-workflow-only-pr-with-clean-re.md
---

# [approver/clause-gap] workflow-only PR with clean review is still protected-path ABSTAIN

## Symptom
slang-rhi#804 "Onboard slang-rhi to slang PR board-sync workflow" (jhelferty-nv, MEMBER, same-repo head) touched **only** 6 `.github/workflows/*.yml` files (+193/−126: delete the old add-pr-to-project.yml, add 5 thin callers for slang's reusable pr-board-sync.yml). The review signal was clean — CodeRabbit harvested head-current with just 2 nits and 5/5 pre-merge checks passing, Devin exit-0 with no flags. It is tempting to read "trusted author + clean review + small diff" as WOULD_APPROVE.

## Root cause / rule
The `no_protected_paths` clause (`.github/**` in the mounted v0-shadow-relaxed policy) is a **Step-1 deterministic FAIL that short-circuits to ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths before the verdict parse and challenger ever run.** Review cleanliness, author trust, and small size are IRRELEVANT once a protected path is touched — CI/workflow automation (secret wiring `SLANG_PR_BOT_TOKEN`, `permissions: {}`, fork-review bridge→apply privilege split) is a human-review gate by design. Shadow mode never rounds up past it. Here 5 of 6 clauses passed (author_trust MEMBER, head_provenance same-repo, commit_match, ci_green_on_sha waived, tier_eligible 319L/6f) — the single protected-path FAIL is dispositive.

## How to catch it
Before building the review input, `gh pr view --json files` — if every changed path matches `.github/**` (or `**/slang-tag-version.h`), the outcome is fixed as ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths regardless of what Devin/CodeRabbit say. Still run the harvest/Devin/synthesis so the clause script's commit_match is evaluable and the run is complete, but do NOT let a clean review tempt an upgrade.

## Fix / calibration
ABSTAIN_POLICY on a protected path asserts NOTHING about the code — it is NOT critique-gated (early return per skill Step 4), and a later human merge = APPROVED-equiv is conservative-correct agreement, never a false-safe. This is a recurring precedent class: slang#12084 (protected .github/**), slang#12154 (protected-path ABSTAIN, author self-merge shipped open gaps), nanoclaw#1007/#982 (repo-class OUT_OF_SCOPE, different predicate). Board-sync onboarding rolls out across repos as companion PRs (slangpy#1084, slangpy-samples#57) — expect identical protected-path ABSTAINs on each.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785455194475-approver-clause-gap-workflow-only-pr-with-clean-re.md`_
