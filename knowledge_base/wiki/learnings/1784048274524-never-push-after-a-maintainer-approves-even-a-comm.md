---
title: "Never push after a maintainer approves — even a comment-only commit auto-dismisses the approval"
type: learning
topic: review-approval
source: learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md
---

# Never push after a maintainer approves — even a comment-only commit auto-dismisses the approval

# Never push to an approved PR head unless it's a requested code/CI change

**Rule (two parts, operator-confirmed 2026-07-14 via parent):**

1. **Don't push after a maintainer approves** unless the push is a *requested code change* or a *real CI fix*. **Any** commit to the PR head auto-dismisses the standing approval — including a comment-only / cosmetic reword. A comment reword is **never** worth losing an approval. If the PR is approved and you have a cosmetic tweak, **hold it** (or bundle it into a future round only if the maintainer requests further changes).

2. **Before reporting "APPROVED / awaiting merge," re-check `reviewDecision` at HEAD** — and that the approving review's `commit_id` == the current head SHA. Don't infer "approved" from an earlier `pr_review` webhook; a later push may have dismissed it.

**How it bit us (slang#11982 / PR #12034, 2026-07-14):** maintainer jkwak-work APPROVED at 16:46 on head `bdf2c2a2d0`. The fixer then pushed a **comment-only** commit `a0635cc612` at 16:50 (a comment restructure jkwak had *requested* in the same review) → GitHub **auto-dismissed the approval** at 16:50:23. PR dropped to `reviewDecision=REVIEW_REQUIRED`. A cosmetic push threw away a maintainer approval for zero functional gain. (Same pattern hit PR #12009 independently.)

**Subtlety:** even when the maintainer *requested* the comment change, applying it still dismisses their approval. The right move is to **flag that trade-off** ("applying this will dismiss your approval — want me to, or leave the comment as-is?") and let them decide, rather than silently pushing.

**Verify-at-HEAD one-liner:**
```
gh pr view <n> -R <owner>/<repo> --json reviewDecision,headRefOid,reviews \
  --jq '{decision:.reviewDecision, head:.headRefOid, approvals:[.reviews[]|select(.state=="APPROVED")|{who:.author.login, commit:.commit_id}]}'
```
"Approved at HEAD" requires `decision=="APPROVED"` AND an approval whose `commit == head`.

**Related conflict:** the natural remedy — re-request review from the maintainer — is a `requested_reviewers` write, which the dev-team operator directive (dashboard-admin 2026-06-05) forbids for any maintainer/reporter. So you can't just re-request to re-land the approval; surface the conflict to parent (options: scoped override, or a no-@ "ready for re-approval" nudge comment).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md`_
