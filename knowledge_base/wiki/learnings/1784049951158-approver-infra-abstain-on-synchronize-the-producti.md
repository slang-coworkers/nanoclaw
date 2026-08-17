---
title: "[approver/infra-abstain] On synchronize, the production 'review' check can still be in_progress at synthesis — poll it to settle AND re-harvest right before recording, or you miss the primary tier"
type: learning
topic: review-approval
source: learnings/1784049951158-approver-infra-abstain-on-synchronize-the-producti.md
---

# [approver/infra-abstain] On synchronize, the production 'review' check can still be in_progress at synthesis — poll it to settle AND re-harvest right before recording, or you miss the primary tier

**Symptom:** Twice in one session on slang PR #11670, `harvest-reviews.py` returned exit 10 (STALE ONLY) on a fresh synchronize head while the production `review` check-run (github-actions, the claude-pr-review.yml pipeline) was still `in_progress`. If you fall to the Devin-only tier at that moment and synthesize/decide, the head-matched `github-actions[bot]` review posts a minute or two later and you've decided on the weaker signal. On the 57a7e0 revision the primary review landed at 17:18:10 — ~1 min AFTER my decision timestamp 17:16:51; the DECISION_REVIEW critique caught it (it re-checked live GitHub and saw the head-current review), forcing a re-harvest onto the primary tier. On the b7686cb revision the same lag hid the review long enough that I'd synthesized Devin-only first.

**Root cause:** (1) `harvest-reviews.py`'s `pending_bot` detection is unreliable when a STALE review from a prior head is present — it reports exit 10 / `pending_bot: null` even though a `review` check-run is actively running on the pinned head (the stale review masks the pending signal). (2) The production review pipeline posts the `github-actions[bot]` COMMENT-state review only at the END of its run, which can be several minutes after the check-run appears — a real timing race on any fresh synchronize, exactly the slang#12064 `harvest_used=0` failure mode.

**How to catch it:** do NOT trust harvest exit 10 alone on a fresh/synchronize head. Independently query the check-runs for a `review` job (or "Claude Code Assistant"): `gh api repos/<repo>/commits/<head>/check-runs --jq '.check_runs[]|select(.name|test("review|claude";"i"))|{name,status,conclusion}'`. If it's `in_progress` (or a `review` job exists with null conclusion), the primary review is IMMINENT — poll until the check settles (completed/gone) AND a head-matched `github-actions[bot]` review appears, then RE-HARVEST. Only fall to Devin-only if the check reaches conclusion `skipped` (production genuinely skips no-source-delta master-merges, fixer branches, bot PRs) or never settles within the window. Note: a "Claude Code Assistant" check = `skipped` means no review will post → Devin-only is correct.

**Fix:** procedure — always re-harvest immediately before `record_decision`, and treat "review check in_progress" as "wait, don't fall through." The critique gate (DECISION_REVIEW) is the backstop: it re-reads live GitHub and will flag a Devin-only decision made while a head-current primary review exists — but don't rely on the gate to catch what the harvest step should. Tooling fix to file: make `harvest-reviews.py` detect an in_progress `review`/claude check-run even when a stale review is present, and return exit 22 (pending) instead of 10, so the workflow waits+re-harvests rather than falling to Devin-only.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784049951158-approver-infra-abstain-on-synchronize-the-producti.md`_
