---
name: feedback_reviews_commit_id_can_postdate_submitted_at
description: "GitHub reviews[].commit_id can POST-DATE submitted_at ⇒ it is not a trustworthy 'which SHA was approved'; a stale approval reads as approved-at-head (false-safe toward APPROVE)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d73dcb6-6732-47d9-b20e-255818a8fc2b
---

# `reviews[].commit_id` is NOT "the SHA that was approved"

> ⭐**CONFIRMED FIRING IN PRODUCTION (08-03, slangpy#1068).** This is not a
> hypothetical. slangpy-pr-approver's `eval-clauses.py` `commit_match` clause read this
> field and reported *"review commit_id=266b2072e621 == pinned"* → **PASS**, on
> ccummingsNV's **5-day-stale** approval. It changed no outcome only because Step 2
> failed independently (`reviewers_complete=false`); on a PR with a working review
> pipeline it would have passed **unnoticed**. Filed by the approver as a clause-gap with
> the timestamp remedy below. **Both slang- and slangpy-pr-approver run this clause ⇒
> assume the slang side has the same gap until shown otherwise.**

**VERIFIED EFFECT (08-03, n=2):** `GET /repos/{o}/{r}/pulls/{n}/reviews` can return a
`commit_id` for a commit that **did not exist** when the review was submitted.

- slangpy**#1068**: `ccummingsNV APPROVED submitted_at=2026-07-29T10:05:29Z`,
  `commit_id=266b2072e6…` — that commit's author *and* committer date is
  **2026-08-03T19:22:22Z**, **5 days later**.
- slangpy**#1084** (independent control): `jkwak-work APPROVED submitted_at=2026-07-31T21:13:48Z`,
  `commit_id=febe01ed4b…` — commit date **2026-07-31T22:22:34Z**, **69 min later**.

A review cannot have been submitted against a commit that did not yet exist ⇒ the field is
re-pointed after the fact. **`commit_id` is not evidence of what was reviewed.**

**Why it's dangerous — it fails toward APPROVE.** An approver clause shaped
*"the human approval must be at the current head"* evaluates **TRUE** on a
5-day-stale approval. That is a false-safe in the one direction that ships code
([[feedback_mechanism_must_predict_observed_coordinates]] — audit the artifact that
drives the decision).

## How to apply

Never derive "approved at head" from `commit_id`. Compare **timestamps**:

```bash
gh api repos/$R/pulls/$N/reviews --jq '.[]|{user:.user.login,state,submitted_at,commit_id}'
gh api repos/$R/pulls/$N/commits --jq '.[]|{sha:.sha[0:10],date:.commit.author.date,parents:(.parents|length)}'
# approval is stale iff any commit's date > that review's submitted_at
```

## The field is NOT always head — so a spot-check won't reveal this

Counter-examples where `commit_id` stayed **historical** (≠ head): slangpy**#1063**
(reviews @`f236e20f4c`, head `06912033bb`), **#1075** (reviews @`8b22345bc5`/`e396c57fed`,
head `d001b2bad2`). So you cannot detect the problem by asking "does commit_id equal head?" —
sometimes yes, sometimes no. **Only the timestamp comparison is decisive.**

**UNVERIFIED hypothesis for the split (n=2/2 vs 0/2, mechanism NOT established):** the two
rewritten cases each had a **merge-from-base** commit (`parents=2`, "Merge branch 'main' into …",
the web "Update branch" button) pushed after the review; the two historical cases had only
ordinary `parents=1` pushes. Plausible reading: GitHub carries an approval forward across a
base-merge that doesn't change the reviewed tree. **Do not relay this mechanism as fact** —
the effect above is proven, this story is a correlation on 4 PRs
([[feedback_unattributed_fact_reads_as_your_own]]).

Related: [[project_slangpy_1067_macos_wheels_pyframe_getlasti]] (where it surfaced),
[[feedback_squash_merge_breaks_merge_base_ancestor_check]] (same family: a git/API field whose
plain reading is wrong for a merge shape).
