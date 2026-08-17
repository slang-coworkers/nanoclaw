---
title: "A GitHub DISMISSED review erases the CHANGES_REQUESTED it used to be"
type: learning
topic: review-process
source: learnings/1786025962656-a-github-dismissed-review-erases-the-changes-reque.md
---

# A GitHub DISMISSED review erases the CHANGES_REQUESTED it used to be

# A GitHub `DISMISSED` review erases the `CHANGES_REQUESTED` it used to be

**Fact:** when a review is dismissed, GitHub **rewrites `state` in place** on
`GET /repos/{o}/{r}/pulls/{n}/reviews`. The original verdict is *gone* from that endpoint. It
survives only in the timeline:

```bash
gh api "repos/$O/$R/issues/$N/timeline?per_page=100" \
  -q '.[] | select(.event=="review_dismissed")
     | [.actor.login, .dismissed_review.state, .dismissed_review.review_id, .created_at] | @tsv'
# -> jkwak-work  changes_requested  4675807469  2026-07-13T17:42:28Z
```

**Why it matters:** any metric that counts review cost from the reviews endpoint silently
under-reports, and it under-reports *exactly* the PRs that cost the most — the ones where a
reviewer requested changes, the author fixed it, and the reviewer dismissed their own review as a
courtesy. The dismissal is a signal of *resolved friction*, and it reads as *no friction*.

**Measured 2026-08-06, 200-PR shader-slang/slang census (1,388 review rows, fully paginated):**

- states as reported: `1241 COMMENTED / 114 APPROVED / 28 DISMISSED / 5 CHANGES_REQUESTED`
- of the 28 dismissed, **2 were originally `changes_requested`** ⇒ a strict CR count sees
  **5 of 7** real events, a **29% undercount**
- PR 12043 (bot-authored, merged) reads `reviewers=3, feedbackRounds=0, changesRequestedRounds=0`
  — counted as *reviewed at zero cost*
- direction is not neutral: 15 of 26 approved-dismissals, and the one merged CR-dismissal, are on
  bot-authored PRs — the erasure flatters the bot

**How to apply:** if you compute anything from review `state`, either (a) join the timeline's
`review_dismissed` events to recover the original state (one extra call per PR that has one), or
(b) count a `DISMISSED` review as feedback without recovering its state — strictly closer to truth
than 0. Treating `DISMISSED` as "not submitted feedback" is only correct for `PENDING`; a dismissed
review *was* submitted, then retracted.

**Related instrument note:** `PENDING` genuinely is not submitted. And a `DISMISSED`-only PR still
yields `reviewers >= 1`, so it lands in the *reviewed* bucket at zero cost — the worst of both
denominators.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786025962656-a-github-dismissed-review-erases-the-changes-reque.md`_
