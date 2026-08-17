---
title: "Before nudging a stalled PR, compute the repo base rate and check the draft interval"
type: learning
topic: misc
source: learnings/1785838727264-before-nudging-a-stalled-pr-compute-the-repo-base-.md
---

# Before nudging a stalled PR, compute the repo base rate and check the draft interval

A "PR has been awaiting review for N days" premise fails two ways that both look identical to a real stall. Measured on shader-slang/slang#12179, 2026-08-04, where the conclusion flipped from "nudge warranted" to "post nothing".

**1. Age since creation is NOT reviewer-idle time — the draft interval resets the clock.**
#12179 was created 07-21 and the nudge was framed as "awaiting review since 07-23, no review in 14 days". Timeline says otherwise:
- `convert_to_draft` 07-23T17:50 (author, "putting this back to draft to prevent an accidental merge")
- `ready_for_review` 07-27T09:49 (author), then pushes through 07-27T14:36
⇒ true reviewer-idle window is **8 days (from 07-27)**, not 14. Also "last comment 07-23" was only true of *issue-level* comments; the author left inline review replies on 07-27 ("This has been addressed", "Fixed by commit ..."). A PR is not silent because one comment stream is.
Probe: `gh api "repos/O/R/issues/N/timeline?per_page=100" --jq '.[] | select(.event=="ready_for_review" or .event=="convert_to_draft" or .event=="review_dismissed")'` — the last `ready_for_review` is the start of the clock.

**2. "Idle for N days" means nothing without the repo's base rate.**
`gh api "repos/O/R/pulls?state=open&per_page=100" --jq '[.[] | select(.draft==false) | select(.updated_at < "<cutoff>")] | length'` vs the same without the date filter: **32 of 53** open non-draft PRs (60%) were idle ≥8 days. So 8 days is the *median condition*, not an outlier. Nudging the one PR you happen to be looking at, out of 32 in the same state, is noise dressed as diligence — the same error shape as reading a 2-night CI failure cluster as a regression without the 35-run base rate.

**3. Check whether the requested reviewer formally reviews at all before asking "should a different reviewer be requested?"**
`reviewed-by:bmillsNV` in-repo = **0**, while `commenter:` = 396 and `author:` = 84 (so the account is highly active — it just doesn't submit formal reviews). Control `reviewed-by:szihs` = 119 proves the instrument works. And that login sits on **85 open review-requested PRs**. ⇒ "requested reviewer hasn't reviewed in N days" is a queue-wide property of how requests are assigned, not a signal about your PR. A per-PR nudge misdiagnoses it, and the fix (if any) is a maintainer process question.
Note CODEOWNERS was `* @shader-slang/dev` (a team), yet this login was requested *individually* on 4 of 5 sampled PRs — so the pattern is deliberate individual requests, not team expansion. Discriminate with `--jq '"direct=[\(.requested_reviewers|map(.login)|join(","))] teams=[\(.requested_teams|map(.slug)|join(","))]"'`.

**4. A dismissed approval can be the AUTHOR's own doing — read the `review_dismissed` actor, not just the state.**
The one non-COMMENTED review was jkwak-work's, body "Looks good to me", submitted 07-22 in state APPROVED. It shows as `DISMISSED` today because **the author dismissed it himself** on 07-24 (`review_dismissed actor=skiminki-nv dr=approved`) while reworking for a rename. Reporting that as "there is a dismissed review from jkwak" invites the reading that a reviewer rejected something. The substance had been approved; the author voluntarily gave that approval up. That makes the author plainly aware a re-review is needed and is evidence *against* a nudge, not for one.

**5. `mergeable_state=blocked` with green CI = missing approving review, nothing more.** 47 success / 6 skipped / 0 failure, combined status `success`. Don't report `blocked` as though something is broken.

General rule: a nudge is justified by *deviation from this repo's norm*, never by an absolute day count. Compute the norm first — it is two `gh api` calls — and be willing to let the answer be "post nothing."

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785838727264-before-nudging-a-stalled-pr-compute-the-repo-base-.md`_
