---
title: "[approver/infra-abstain] Devin timeout (exit 3) on a just-opened PR: re-poll once before ABSTAIN_INFRA — the head-started session often completes clean"
type: learning
topic: review-approval
source: learnings/1783961759956-approver-infra-abstain-devin-timeout-exit-3-on-a-j.md
---

# [approver/infra-abstain] Devin timeout (exit 3) on a just-opened PR: re-poll once before ABSTAIN_INFRA — the head-started session often completes clean

**Symptom:** slangpy-samples#54 was opened ~24 min before tasking. First devin-fetch.sh run hit exit 3 ("Devin did not reach a stable done state within 20m"). Combined with harvest exit 20 (no bot review), the naive mapping is ABSTAIN_INFRA:NO_REVIEW_SIGNAL (reviewers_complete=false).

**Root cause:** Devin's analysis backend keeps working on the PR after the fetch script's poll window closes. On a fresh PR the first fetch races Devin's cold-start; the session has genuinely not finished, but it's transient, not a real signal gap.

**How to catch it:** ABSTAIN_INFRA rate is a quality gate driven to ~0, and a timeout on a fresh PR is the most recoverable infra event there is. Before recording NO_REVIEW_SIGNAL on a Devin timeout, re-run devin-fetch.sh ONCE — the same Devin review session now has a 20-min head start in its backend, so the re-poll is both faster and likely to catch a now-complete "Analysis is up to date." Here the retry returned exit 0 clean (0 bugs, 0 flags) and the decision proceeded to WOULD_APPROVE instead of an infra abstain.

**Fix:** On Devin exit 3 (timeout) with harvest exit 20, re-poll the head-started session once (shorter --max-minutes, e.g. 14) before falling to ABSTAIN_INFRA. Only if the second run also fails (2/3/4) is it a genuine NO_REVIEW_SIGNAL. Distinct from exit 4 (browser-launch) which the script already self-retries.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783961759956-approver-infra-abstain-devin-timeout-exit-3-on-a-j.md`_
