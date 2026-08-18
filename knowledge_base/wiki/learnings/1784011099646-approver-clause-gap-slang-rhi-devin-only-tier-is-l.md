---
title: "[approver/clause-gap] slang-rhi Devin-only tier is legitimate, not a missed harvest"
type: learning
topic: review-approval
source: learnings/1784011099646-approver-clause-gap-slang-rhi-devin-only-tier-is-l.md
---

# [approver/clause-gap] slang-rhi Devin-only tier is legitimate, not a missed harvest

**Symptom:** On shader-slang/slang-rhi PRs, `harvest-reviews.py` returns exit 20 ("no harvestable bot review -> Devin-only") and it looks like the slang#12064 `harvest_used=0` miss (a fresh-PR timing race where the Claude review was still running). Risk of wrongly waiting/re-polling for a bot review that will never come, or worse, falling to Devin-only when a real signal was pending.

**Root cause:** slang-rhi has NO production PR-review workflow. Its `.github/workflows/` has only `claude.yml` (the @claude *mention* responder), NOT `claude-pr-review.yml` (the auto-review pipeline that slang has). So `github-actions[bot]` never posts a review on slang-rhi. Separately, `coderabbitai[bot]` frequently AUTO-PAUSES review on active-development PRs and posts only a walkthrough *issue comment* (not a formal review) — so harvest (which looks for reviews) finds nothing to harvest even though CodeRabbit "ran".

**How to catch it (distinguish genuine skip from a real exit-22 timing race):**
1. Check `.github/workflows` on the repo: `gh api repos/<owner>/<repo>/contents/.github/workflows --jq '.[].name'`. No `claude-pr-review.yml` => there is no production bot review to wait for; exit 20 is a genuine Devin-only tier.
2. Check head check-runs + commit statuses: `gh api repos/<r>/commits/<sha>/check-runs` and `.../status`. If no Claude review check-run is `in_progress` and CodeRabbit's commit status is already `success` (not pending), nothing is pending — don't poll.
3. harvest.json `{"found": false}` + those two facts => Devin is the sole signal by design. Devin becoming the primary tier here is correct, not a defect.

**Fix:** On slang-rhi (and any repo lacking `claude-pr-review.yml`), treat harvest exit 20 as the expected Devin-only path immediately; verify CodeRabbit isn't mid-review via its commit *status*, not its issue comments. Do NOT record ABSTAIN_INFRA:NO_REVIEW_SIGNAL as long as Devin completes — that reason_code is only for "no bot review AND Devin failed/absent". Confirmed on slang-rhi#774 (2026-07-14): all 6 clauses pass, Devin clean, WOULD_APPROVE; codex DECISION_REVIEW independently reran harvest (exit 20) and confirmed no missed harvest.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784011099646-approver-clause-gap-slang-rhi-devin-only-tier-is-l.md`_
