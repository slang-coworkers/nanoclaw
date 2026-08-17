---
title: "[approver/infra-abstain] exit-22 patience pays: hold for the primary bot even at ~30min when Devin will time out anyway"
type: learning
topic: review-approval
source: learnings/1784316416216-approver-infra-abstain-exit-22-patience-pays-hold-.md
---

# [approver/infra-abstain] exit-22 patience pays: hold for the primary bot even at ~30min when Devin will time out anyway

**Symptom:** On fresh PR slang#12147 (ready_for_review, PR ~2 min old), `harvest-reviews.py` returned exit 22 (timing race: production `review` check IN_PROGRESS, CodeRabbit PENDING). The workflow guidance says poll ~6 min then fall to Devin-only. But the production claude-code-action `review` check took ~34 MINUTES to complete (started 18:37:35Z, done ~19:11Z), far past the 6-min window. CodeRabbit finished as a commit-status SUCCESS + summary ISSUE comment but never posted a formal REVIEW object (so the harvester still returned found:false / pending_bot).

**Root cause:** The 6-min window is a floor, not a ceiling. exit-22 means the bot is ACTIVELY RUNNING (named in pending_bot), not absent — falling to Devin-only discards the PRIMARY signal (the slang#12064 harvest_used=0 miss). Critically, in this case Devin ALSO timed out (devin-fetch exit 3, 30m limit) — so falling to Devin-only would have produced ABSTAIN_INFRA:NO_REVIEW_SIGNAL (no bot review AND Devin failed), an infra-abstain that burns the gate, when the real answer was a clean PRIMARY-tier BLOCK.

**How to catch it:** On exit-22, keep re-harvesting as long as `pending_bot` is still IN_PROGRESS (check the check-run status directly), not just for 6 min. Poll in the background with a monitor so you don't block. Only fall to Devin-only if the named bot reaches a TERMINAL non-review state (skipped/absent) — and remember Devin's own 30-min timeout means Devin-only is often NOT a safe fallback on a fresh PR where both are slow. Also: CodeRabbit's commit-status SUCCESS ≠ a harvestable review; it posts a summary issue-comment, and the harvester keys on formal PR review objects, so `found:false` can persist even after CodeRabbit "passes".

**Fix:** Extended the poll window (~40 min, 60s interval) with a settle-monitor. It settled to harvest exit 0 — production github-actions[bot] review landed at the pinned head (diff_hash match) — vindicating the hold. Rule: patience on a running primary bot > speed to a Devin-only tier that may itself be empty.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784316416216-approver-infra-abstain-exit-22-patience-pays-hold-.md`_
