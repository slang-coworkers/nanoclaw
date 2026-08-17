---
title: "A rebase dismisses approvals, and BLOCKED can change meaning without changing string"
type: learning
topic: review-approval
source: learnings/1785940451757-a-rebase-dismisses-approvals-and-blocked-can-chang.md
---

# A rebase dismisses approvals, and BLOCKED can change meaning without changing string

**2026-08-05, slangpy PR #1080. Two coupled findings, both verified via `gh pr view`, not relayed.**

## 1. Rebasing an approved PR silently costs you the approval
A stacked PR had to be rebased after its base squash-merged. Post-rebase CI came back perfect — run `completed/success`, **12/12 jobs, 15/15 checks non-failing, 0 pending**. Easy to read that as "ready to merge."

It wasn't:
```
gh pr view <n> --json reviewDecision,latestReviews
⇒ reviewDecision: REVIEW_REQUIRED
⇒ latestReviews: [{user: ccummingsNV, state: DISMISSED}]   # was APPROVED at the pre-rebase head
```
**A force-push invalidates existing approvals.** Neither the fixer nor I anticipated this before pushing. It is inherent to rebasing an approved PR ⇒ ⭐⭐**the re-approval round-trip belongs in the DECISION to rebase, not discovered after the push.** If a PR is approved and you're weighing a rebase, price in "this costs a human re-review."

## 2. `mergeStateStatus: BLOCKED` changed MEANING without changing STRING
Before the rebase, `BLOCKED` meant *draft + CI incomplete*. After, the identical token meant *draft + missing review*. **A new blocker appeared behind an unchanged string.** Anyone who had cached "BLOCKED just means it's still a draft" would have carried that reading straight past a real gate.

⇒ ⭐⭐⭐**A composite status token is not a fact — decompose it every time you read it.** `BLOCKED`, `DIRTY`, `UNSTABLE`, `blocked`, "pending" and friends are *summaries over several conditions*; the summary is stable while its causes rotate underneath. Re-read the components (`isDraft`, `reviewDecision`, `statusCheckRollup`, `mergeable`) on every check, and state which component you're asserting about.

Same family as: a guard can be inert yet read as passing; a status can report `pass` when it should report `unevaluable`. The failure mode is **a state that cannot say "something else is wrong now."**

## Checks
- After any force-push to a reviewed PR: `gh pr view <n> --json reviewDecision,latestReviews` before reporting readiness.
- Never report "CI green" as a readiness claim. CI answers *one* of ≥3 gates (checks / review / draft). Name the gate you measured.
- Decompose composite tokens rather than comparing them to a remembered value — an unchanged token is not evidence of an unchanged situation.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785940451757-a-rebase-dismisses-approvals-and-blocked-can-chang.md`_
