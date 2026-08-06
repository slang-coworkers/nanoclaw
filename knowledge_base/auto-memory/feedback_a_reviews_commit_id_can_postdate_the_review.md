---
name: feedback_a_reviews_commit_id_can_postdate_the_review
description: "A GitHub review's commit_id can name a commit created AFTER submitted_at — so it is not evidence of the tree the human saw. Measured on slangpy#925: approval 07-29, its commit_id committed 08-05. Also: which side of a finding an approval falls on must be MEASURED per-ref, not assumed."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-05
---

# A review's `commit_id` can postdate the review — and "the approval predates the
# finding" is a measurement, not a reflex

⛔**Two separate errors live here. Both were produced by taking a timestamp/field
at face value instead of asking *which commit, and when did it exist?***

## 1. The field itself is not what it looks like

MEASURED on `shader-slang/slangpy#925` (2026-08-05):

```
review 4806765742  ccummingsNV  APPROVED
  submitted_at = 2026-07-29T10:08:07Z
  commit_id    = 4743d90ff367
gh api repos/.../commits/4743d90ff367 --jq .commit.committer.date
  → 2026-08-05T12:55:32Z          # SEVEN DAYS AFTER the review
gh api repos/.../commits/4743d90ff367 --jq '.parents[].sha'
  → e5f2299b2b63 (2026-06-23)     # the branch head the human plausibly saw
  → 08ae47a4ed66 (2026-08-04)     # main-side parent, also postdates the review
```

The merge commit the review claims to be against **could not have existed** when
the review was submitted — its second parent is dated a week later.

⇒ ⛔⭐⭐⭐**A review's `commit_id` is NOT evidence of the tree the reviewer saw.**
It is the field an approver `commit_match` clause keys on, and it can be
re-pointed onto a later commit. **The cheap discriminator is already in hand:**

```bash
# For every review, does its commit_id predate its own submission?
gh api repos/$R/pulls/$N/reviews --jq '.[] | {login:.user.login, state, submitted_at, commit_id}' \
| while read -r row; do :; done   # then, per commit_id:
gh api repos/$R/commits/$SHA --jq .commit.committer.date
# committer_date > submitted_at  ⇒  commit_id CANNOT be what was reviewed
```

⭐⭐**A clause that reads `commit_id == head` reports `pass` in exactly this
situation** — the head matches because the field was re-pointed *to* the head,
not because a human reviewed the head. **Same shape as the whole "false
coverage" family: a check that cannot say "I couldn't verify."**
See [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

## 2. "The approval predates the finding" — direction must be measured per-ref

The approver flagged a real regression on #925 (Linux wheel builds lose
`SLANGPY_VERSION_OVERRIDE`) and attached: *"`ccummingsNV`'s 2026-07-29 approval
predates it."* **FALSE, and backwards.** Measured ref-by-ref, with positive
controls on every fetch (`name: wheels` and `CIBW_ENVIRONMENT` counts > 0, so a
zero on the target is a real zero):

| ref | date | `CIBW_ENVIRONMENT_LINUX` | step-level `SLANGPY_VERSION_OVERRIDE` | defect live? |
|---|---|---|---|---|
| `6286baba0908` | 04-09 | **present** (day one) | absent (0, controls fired) | no — nothing to drop |
| `6cfb1df2149f` | 04-30 | present | absent | no |
| `e5f2299b2b63` | 06-23 | present | **present** (arrived via main merge) | **YES — born here** |
| `4743d90ff367` | 08-05 | present | present | yes |

The PR-side half was there from the **first commit**; the collision was created
when a **main-side** change (step-level `SLANGPY_VERSION_OVERRIDE`) merged in on
**06-23**. So the 07-29 approval **postdates the defect by ~5 weeks** — it
covered a tree that already contained it.

⇒ ⭐⭐⭐**This inverts the action.** "Approval predates the finding" ⇒ *ask the
human to take a fresh look at something new.* "Approval postdates it" ⇒ *the
human already looked at this tree and missed it, and a bot only surfaced it
today* — a different, stronger reason to escalate, and one the original framing
would have buried.

⚠️**The store already carried two instances of the "approval predates the
finding" shape** (`project_slang_rhi_807_disable_metallib_4_0`,
`project_slangpy_1075_texture_loader_sampler_heap`). **That is how this became a
reflex.** A phrasing that was measured twice got applied a third time
unmeasured — ⛔**a pattern that held twice is a hypothesis, not a lookup.**
See [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]: the
finding was CORRECT and the provenance claim welded to it was FALSE, and the
provenance claim is the half a human acts on.

⭐⭐**A defect introduced by a MERGE has two birthdays — the PR-side half and the
main-side half.** Neither commit alone creates it. Grepping only the PR's own
first commit tells you the wrong date; you must walk every ref and test for
**both** halves.

## 3. Corollary found in the same pass: read `autoMergeRequest`

The approver's `next-action` was *"human review by szihs."* Measured:

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  autoMergeRequest{enabledAt enabledBy{login} mergeMethod}
  mergeStateStatus mergeable reviewDecision }}}'
# → autoMergeRequest: {enabledAt: 2026-08-05T12:55:44Z, enabledBy: ccummingsNV, SQUASH}
#   reviewDecision: APPROVED   mergeable: MERGEABLE   mergeStateStatus: BEHIND
```

Nothing was waiting on a human — the PR was **armed to merge itself** the moment
it stopped being `BEHIND`. ⇒ ⛔⭐⭐**Before writing any `next-action` that names a
person, read `autoMergeRequest` + `reviewDecision`. "Awaiting review" and "armed
to auto-merge" are opposite operational states and the review surface alone
cannot distinguish them.**

## How to apply

Three commands, before any approval-provenance or next-action claim:

1. `gh api repos/$R/commits/$(review commit_id) --jq .commit.committer.date` —
   compare to `submitted_at`. Later ⇒ the field is re-pointed, stop trusting it.
2. Walk **every** ref in `pulls/$N/commits` and test for **each half** of the
   defect separately, with a positive control per fetch.
3. `autoMergeRequest` + `reviewDecision` before naming a human as the blocker.

## Evidence base

ONE chain (slangpy#925, 2026-08-05) for the `commit_id`-postdates measurement —
but the mechanism is **structural and re-checkable in one API call**, and the
measurement is unambiguous (a commit's own parent postdates the review). The
"direction must be measured" half has **three** data points in this store, two
where the reflex was right and one (here) where it inverted — which is exactly
the distribution that makes it dangerous. Per this store's single-case rule:
**re-derive the `commit_id` claim the next time it fires.**

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike]] ·
[[technique_merged_at_not_committer_date_for_merge_time]] ·
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]
