---
title: "Reviewer Pipeline Operations"
type: concept
group: review-process
tags: [pr-review, reviewer-a, reviewer-b, reviewer-c, devin, harvest, production-review, coderabbit, check-run, reviewer-coworker, commit-id, polling, re-harvest, delegated-review]
source_count: 9
---

# Reviewer Pipeline Operations

How the approver *sources* its review input: harvesting the production (PRIMARY) review, polling for it to settle, reading Devin (Reviewer B) coverage, distinguishing skipped from pending check-runs, and consuming a delegated reviewer-coworker's review doc. These are the mechanics of the review-input pipeline that feeds the decision — separate from the decision itself (see [approver and CI operational notes](review-pr-approver-and-ci-operational-notes.md)).

## TL;DR
- **`harvest-reviews.py` exit 0 is not "the PRIMARY review was read."** The secondary bot (`coderabbitai[bot]`) is fast and posts first; a clean exit can mean the harvest selected the secondary while the primary `github-actions[bot]` production review was still `in_progress`. Confirm which tier was harvested before deciding.
- **When the primary review is still in flight, WAIT and RE-HARVEST — do not settle for the fallback tier.** A fresh production review can post minutes after your first harvest and flip both the tier and the severity of a synchronize revision.
- **A STALE-only first harvest is recoverable.** Exit-10 (STALE ONLY) after a fresh master-merge push means the newest primary review is against the pre-merge commit; re-harvest at the settled head recovers a head-current PRIMARY.
- **`skipped` ≠ `pending`.** The skipped `Claude Code Assistant` check-run is NOT the `Claude PR Review` job; confirm the actual workflow state via `gh run view` before concluding the production review is absent and falling to a lower tier.
- **Devin commit-status `unknown` ≠ "up to date."** After a synchronize, an `unknown` status may mean Devin's analysis does not cover the settled head — treat it as uncovered, not clean.
- **A delegated reviewer-coworker doc must carry `commit_id` + `_approver_result`.** Omitting either makes `commit_match` unevaluable and forces ABSTAIN_INFRA — a pure staging defect that can cost a decision on an otherwise-clean PR.
- **A staging/infra defect is fixed at the producer, not worked around downstream.** The commit_id-omission was resolved by retiring the delegate path (Option 1), not by an open "stamp the handoff" task.

## Harvesting the production (PRIMARY) review: tiers, polling, and re-harvest

The harvest step selects a review to feed the decision from a tiered set: the PRIMARY production review (`github-actions[bot]`, the claude-code-action job) is preferred; `coderabbitai[bot]` is a SECONDARY fallback. The trap is that a clean exit code does not tell you which tier you got. On a freshly-opened PR the secondary posts first (CodeRabbit is fast), so `harvest-reviews.py` can return exit 0 having harvested CodeRabbit while the primary production review's check-run is still `in_progress` — the correct response is to WAIT and re-harvest for the primary, never settle for the fallback tier ([[approver/infra-abstain] harvest exit-0 on SECONDARY (CodeRabbit) while production review check-run still in_progress = wait + re-harvest, don't settle for fallback tier](../learnings/1784113859103-approver-infra-abstain-harvest-exit-0-on-secondary.md); [[approver/infra-abstain] harvest exit-0 can pick CodeRabbit secondary while the primary prod review is still in_progress — re-harvest, do not settle](../learnings/1784117112458-approver-infra-abstain-harvest-exit-0-can-pick-cod.md)).

The same "harvest too early" hazard bites on a synchronize revision: harvesting right after the debounced settled head can find only the STALE R1 production review and fall to CodeRabbit fallback, when a fresh production review posts minutes later and would flip the tier (and severity). Re-harvest before deciding a synchronize ([[approver/critique-mustfix] Re-harvest before deciding a synchronize revision — a fresh production review can post minutes after your harvest and flip the tier (and severity)](../learnings/1784149553897-approver-critique-mustfix-re-harvest-before-decidi.md)). A STALE-only harvest is not a dead end: after a fresh post-master-merge head, the first harvest can return exit-10 (STALE ONLY) because the newest `github-actions[bot]` review targets the pre-merge commit — re-harvesting at the settled head recovers the head-current PRIMARY (the slang#12064 class, exit-10 variant) ([[approver/challenger-miss] Re-harvest recovers head-current PRIMARY after a STALE-only first harvest (slang#12064 class, exit-10 variant)](../learnings/1784166433977-approver-challenger-miss-re-harvest-recovers-head-.md)).

## Distinguishing a skipped check-run from a pending one

Before falling to a lower reviewer tier on the belief that the production review is absent, confirm the actual job state. The skipped `Claude Code Assistant` check-run is NOT the `Claude PR Review` job — a skip on one is not evidence the other did not run. Confirm via `gh run view` on the workflow before treating "review skipped" as "review pending" and downgrading the tier ([[approver/infra-abstain] 'review skipped' vs 'review pending' — the skipped `Claude Code Assistant` check-run is NOT the `Claude PR Review` job; confirm via `gh run view` on the workflow before falling to a lower tier](../learnings/1784126153691-approver-infra-abstain-review-skipped-vs-review-pe.md)).

## Devin (Reviewer B): commit-status coverage after a synchronize

`devin-fetch.sh` can return exit 0 with a commit-status of `unknown` — which is NOT the same as "Analysis is up to date." After a synchronize adds new content (e.g. a large test migration on top of the original code), an `unknown` status means Devin's analysis may not cover the settled head. Treat unknown as uncovered rather than clean, and re-verify at the current head ([[approver/challenger-miss] Devin commit-status unknown means it may not cover the settled head after a synchronize](../learnings/1784156846935-approver-challenger-miss-devin-commit-status-unkno.md)).

## The delegated reviewer-coworker doc contract (commit_id / _approver_result)

When a reviewer-coworker (a delegated reviewer) produces the review doc the approver consumes, that doc must carry the contract-required `commit_id` and `_approver_result` fields. Omitting either leaves `commit_match` UNEVALUABLE, which forces ABSTAIN_INFRA — a purely mechanical staging defect, not a finding about the code ([[approver/infra-abstain] reviewer-coworker review-doc omits contract-required commit_id + _approver_result → commit_match UNEVALUABLE → ABSTAIN_INFRA](../learnings/1784186159657-approver-infra-abstain-reviewer-coworker-review-do.md)). The calibration cost of that defect is concrete: the commit_id-omission ABSTAIN on slang#12055 merged-APPROVED at the exact decided head with the gap merged over — the staging defect spent a decision on a clean PR ([[approver/infra-abstain] JOIN: commit_id-omission infra-abstain (slang#12055) merged-APPROVED at exact decided head, gap merged over — the staging defect cost a decision on a clean PR](../learnings/1784197707754-approver-infra-abstain-join-commit-id-omission-inf.md)). The right resolution is at the producer, not a downstream workaround: the slang#12055 commit_id-omission was FIXED via Option 1 (the delegate path was retired), NOT left as an open "stamp the handoff" task ([[approver/infra-abstain] CORRECTION+SUPERSEDES — slang#12055 commit_id-omission abstain is FIXED via Option 1 (delegate path retired), NOT an open 'stamp the handoff' task](../learnings/1784197928722-approver-infra-abstain-correction-supersedes-slang.md)).

---

**Source learnings (9):**

- [[approver/infra-abstain] harvest exit-0 on SECONDARY (CodeRabbit) while production review check-run still in_progress = wait + re-harvest, don't settle for fallback tier](../learnings/1784113859103-approver-infra-abstain-harvest-exit-0-on-secondary.md)
- [[approver/infra-abstain] harvest exit-0 can pick CodeRabbit secondary while the primary prod review is still in_progress — re-harvest, do not settle](../learnings/1784117112458-approver-infra-abstain-harvest-exit-0-can-pick-cod.md)
- [[approver/infra-abstain] 'review skipped' vs 'review pending' — the skipped `Claude Code Assistant` check-run is NOT the `Claude PR Review` job; confirm via `gh run view` on the workflow before falling to a lower tier](../learnings/1784126153691-approver-infra-abstain-review-skipped-vs-review-pe.md)
- [[approver/critique-mustfix] Re-harvest before deciding a synchronize revision — a fresh production review can post minutes after your harvest and flip the tier (and severity)](../learnings/1784149553897-approver-critique-mustfix-re-harvest-before-decidi.md)
- [[approver/challenger-miss] Devin commit-status unknown means it may not cover the settled head after a synchronize](../learnings/1784156846935-approver-challenger-miss-devin-commit-status-unkno.md)
- [[approver/challenger-miss] Re-harvest recovers head-current PRIMARY after a STALE-only first harvest (slang#12064 class, exit-10 variant)](../learnings/1784166433977-approver-challenger-miss-re-harvest-recovers-head-.md)
- [[approver/infra-abstain] reviewer-coworker review-doc omits contract-required commit_id + _approver_result → commit_match UNEVALUABLE → ABSTAIN_INFRA](../learnings/1784186159657-approver-infra-abstain-reviewer-coworker-review-do.md)
- [[approver/infra-abstain] JOIN: commit_id-omission infra-abstain (slang#12055) merged-APPROVED at exact decided head, gap merged over — the staging defect cost a decision on a clean PR](../learnings/1784197707754-approver-infra-abstain-join-commit-id-omission-inf.md)
- [[approver/infra-abstain] CORRECTION+SUPERSEDES — slang#12055 commit_id-omission abstain is FIXED via Option 1 (delegate path retired), NOT an open 'stamp the handoff' task](../learnings/1784197928722-approver-infra-abstain-correction-supersedes-slang.md)
</content>
</invoke>
