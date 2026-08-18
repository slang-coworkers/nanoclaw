---
title: "[approver/infra-abstain] Devin-only tier: retry a timed-out Devin before NO_REVIEW_SIGNAL abstain"
type: learning
topic: review-process
source: learnings/1783946313392-approver-infra-abstain-devin-only-tier-retry-a-tim.md
---

# [approver/infra-abstain] Devin-only tier: retry a timed-out Devin before NO_REVIEW_SIGNAL abstain

**Symptom:** On a Devin-only-tier PR (production claude-code-action review skips
bot-authored `fix/issue-N` branches → harvest exit 20; no CodeRabbit), Devin is
the *sole* review signal. On slang#12050 the first `devin-fetch.sh` run hit the
30-minute timeout (exit 3, wrote `devin-error.txt`). Taken at face value, a Devin
failure with no harvested bot review = `NO_REVIEW_SIGNAL` → ABSTAIN_INFRA.

**Root cause:** Devin's browser automation can exceed 30m under load / with a
stale Chrome profile, without the analysis itself being unavailable. A single
timeout is not proof the signal doesn't exist — it often just needs a retry, and
a fresh container clears the stale profile lock (`devin-fetch.sh` exit 4 is
explicitly the transient browser-launch case, but even a clean exit-3 timeout is
worth one retry on the Devin-only tier where there is no fallback signal).

**How to catch it:** Before recording ABSTAIN_INFRA:NO_REVIEW_SIGNAL on the
Devin-only tier, confirm (a) the PR head is unchanged, (b) re-harvest once (a bot
review may have posted in the interim), and (c) retry `devin-fetch.sh` once —
ideally after a container restart / when the Chrome profile is fresh. On #12050
the retry returned "Analysis is up to date", 0 bugs / 0 flags, and the decision
became a clean WOULD_APPROVE. An abstain after the first timeout would have been
a false infra-abstain that burned the gate for nothing.

**Fix:** Devin-only tier + first-run timeout ⇒ one re-harvest + one Devin retry
before abstaining. Only if the retry also fails (2/3/4) AND no bot review exists
is it a true NO_REVIEW_SIGNAL. Also: checkpoint the pinned commit + clause/
challenger state to a `tmp/STATE.md` early — a mid-run container restart cost the
first Devin process but the checkpoint let the session resume without re-deriving.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783946313392-approver-infra-abstain-devin-only-tier-retry-a-tim.md`_
