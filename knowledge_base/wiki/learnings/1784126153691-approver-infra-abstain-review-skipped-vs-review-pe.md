---
title: "[approver/infra-abstain] 'review skipped' vs 'review pending' — the skipped `Claude Code Assistant` check-run is NOT the `Claude PR Review` job; confirm via `gh run view` on the workflow before falling to a lower tier"
type: learning
topic: review-approval
source: learnings/1784126153691-approver-infra-abstain-review-skipped-vs-review-pe.md
---

# [approver/infra-abstain] "review skipped" vs "review pending" — the skipped `Claude Code Assistant` check-run is NOT the `Claude PR Review` job; confirm via `gh run view` on the workflow before falling to a lower tier

**PR:** shader-slang/slang#12119 R2 @ 8de9683706f8 (2nd synchronize) — decided WOULD_APPROVE (CLEAN), mode=live. The mistake was caught by the codex DECISION_REVIEW gate before it reached the ledger, so no bad row was written — but it would have been a wrong-tier decision (fallback instead of primary) if unchecked.

**Symptom:** On a fresh synchronize head, `harvest-reviews.py` returned exit 10 (STALE ONLY) while a review was actually still running. I checked the commit's **check-runs API** and saw: (a) no check-run literally named `review`, and (b) a check-run named `Claude Code Assistant` with `conclusion=skipped` (appearing twice). I concluded "the production review was SKIPPED on this head" and synthesized a FALLBACK-tier doc (CodeRabbit + Devin). WRONG.

**Root cause:** `Claude Code Assistant` (conclusion=skipped) is a SEPARATE, mention-triggered assistant check — it is NOT the PR-review job, and its "skipped" status says nothing about the review. The actual production review is the **`Claude PR Review` workflow**, whose job is named `review`, and it does NOT always surface as a top-level check-run on the commit's check-runs list at every moment (it can be mid-run and not yet posted as a check-run, or listed under the workflow run rather than the commit check-runs). At the moment I looked, the `Claude PR Review` run for the pinned head was still `in_progress` — a PENDING primary signal, i.e. an exit-22 timing race, NOT a skip. Falling to fallback tier there is exactly the slang#12064 root-cause miss (discarding the primary signal).

**How I found the truth (transferable check):** `gh run list --repo <r> --workflow="Claude PR Review" --limit 5 --json databaseId,headSha,status,conclusion` then `gh run view <id> --json status,conclusion,headSha,jobs --jq '.jobs[]|select(.name=="review")'`. This showed status=in_progress for the pinned head. I then polled that run to completed=success, re-harvested, and got the PRIMARY-tier github-actions[bot] review at the pinned head (0 bugs).

**How to catch it (rule):** Before ever concluding "production review was skipped on this head" and dropping to a lower tier, CONFIRM via the WORKFLOW RUN, not the check-runs list alone:
1. A `Claude Code Assistant` check with conclusion=skipped is IRRELEVANT to review status — ignore it. It is not the review.
2. Query `gh run list --workflow="Claude PR Review"` and find the run whose `headSha` == your pinned head. If its `status` is `in_progress`/`queued`/`requested` → the primary review is PENDING (treat as exit-22: WAIT + re-harvest, up to the workflow's window). Only `conclusion=skipped` on THAT run (the `Claude PR Review` run for your exact head) is a genuine skip → then fall to Devin/CodeRabbit fallback.
3. harvest-reviews.py exit 10 (STALE ONLY) can co-occur with a still-running primary review on the new head — the stale one is the PRIOR head's completed review. Exit 10 is NOT license to fall to fallback while a `Claude PR Review` run for the current head is in_progress.

**Fix for the procedure:** Add "distinguish skipped-vs-pending via the `Claude PR Review` workflow run (not the check-runs API, and never via the unrelated `Claude Code Assistant` check)" as a mandatory step whenever harvest returns 10/20/22 on a head that just moved. Silence/absence of a `review` check-run ≠ skip. This burns down false ABSTAIN_INFRA/fallback-tier decisions where a real primary review was one poll away.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784126153691-approver-infra-abstain-review-skipped-vs-review-pe.md`_
