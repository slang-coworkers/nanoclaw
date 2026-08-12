# [approver/clause-gap] A review's commit_id is NOT evidence of the tree the human reviewed — GitHub re-points it, so commit_match passes on a commit that postdates the review

## Symptom

On slangpy#925 the `commit_match` clause read **pass** with evidence
`review commit_id=4743d90ff367 == pinned`. It was matching a review that had
been submitted **a week before that commit existed**:

```
ccummingsNV | APPROVED | submitted=2026-07-29T10:08:07Z | commit_id=4743d90ff367
4743d90ff367 committer=2026-08-05T12:55:32Z
```

The clause did exactly what it was written to do — string-compare `commit_id`
against the pinned head — and produced a confidently wrong "the review and the
head agree."

## Root cause

`commit_id` on a review is **mutable state maintained by GitHub**, not a
historical record of what the reviewer looked at. When a PR advances, GitHub
re-points a still-valid APPROVED review at the new head. So `commit_id == head`
is satisfied *by the very act of the head moving*, which is the opposite of the
guarantee the clause is trying to establish.

The implementation compounds it (`eval-clauses.py:173-176`): the only three
outcomes are `unevaluable` (field absent), `pass` (equal), `fail` (unequal).
Once the field is present there is **no branch that can say "present but not
trustworthy."** A clause that cannot express *"I couldn't verify this"* will
launder an unverifiable input into a pass. Same family as `ci_green_on_sha`
returning `status:"pass"` at both `:184` (policy doesn't require CI) and `:190`
(CI actually green) — two very different epistemic states collapsed onto one
token.

## How to catch it

One call discriminates. Compare the review's `submitted_at` against the
**committer date** of the commit it claims to have reviewed:

```bash
sub=$(gh api repos/$R/pulls/$P/reviews --jq '.[] | select(.state=="APPROVED") | .submitted_at' | tail -1)
cid=$(gh api repos/$R/pulls/$P/reviews --jq '.[] | select(.state=="APPROVED") | .commit_id' | tail -1)
cdate=$(gh api repos/$R/commits/$cid --jq .commit.committer.date)
# cdate > sub  ⇒  the field was re-pointed; it says nothing about the reviewed tree
```

`cdate` later than `submitted_at` is physically impossible for an honest
"reviewed at this commit" claim, so it is a clean, cheap falsifier.

## Fix

- Treat `commit_id` as a **claim requiring a freshness check**, never as
  evidence on its own. If `committer_date(commit_id) > submitted_at`, the field
  was re-pointed ⇒ `unevaluable`, not `pass`.
- Give every clause a real `unevaluable` path and never let one token stand for
  both "verified true" and "not required / not checkable." When auditing a
  clause, grep its own source for how many distinct states map to `pass` — more
  than one is a smell.
- Generalizes beyond reviews: any API field that the platform *maintains*
  (mergeability, check conclusions on a moved head, `updated_at`) is current
  state, not history. Ask "could this field have become correct without anyone
  doing the thing I'm trying to verify?" If yes, it carries no bits.

See also `[approver/challenger-miss]` on merge-born defects having two birthdays
(same PR) — both are failures to check *when* a fact became true.
