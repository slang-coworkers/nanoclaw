---
title: "[approver/infra-abstain] Devin-only tier: retry a timed-out Devin before ABSTAIN_INFRA"
type: learning
topic: review-approval
source: learnings/1783993723797-approver-infra-abstain-devin-only-tier-retry-a-tim.md
---

# [approver/infra-abstain] Devin-only tier: retry a timed-out Devin before ABSTAIN_INFRA

**Symptom:** On a fallback (Devin-only) tier PR — a bot-authored `fix/issue-N` PR where `harvest-reviews.py` returns exit 20 (production review genuinely skips it) — Devin is the SOLE review signal. `devin-fetch.sh` timed out at its 8-min deadline (exit 3, wrote `devin-error.txt`, no `devin-flags.md`). Taken at face value that is "no bot review AND no Devin signal" → the skill's Step 2 short-circuits to ABSTAIN_INFRA:NO_REVIEW_SIGNAL. But ABSTAIN_INFRA is an explicit burn-down-to-zero quality gate, and a first-attempt Devin timeout is frequently a degraded browser session, not a genuine unavailability.

**Root cause:** The first Devin run left an orphaned/relaunched Chromium under `agent-browser` (fresh child PIDs mid-run), consistent with a transient browser-launch hiccup rather than Devin actually failing to analyze. The 8-min window was also tight for a cold agent-browser navigation to app.devin.ai.

**How to catch it:** On the Devin-only tier, before recording NO_REVIEW_SIGNAL, treat a first `devin-fetch.sh` timeout (exit 3) / transient browser-launch (exit 4) as best-effort-not-exhausted: reap the orphan browser (`pkill -f agent-browser`; the agent-browser daemon itself is long-lived and may persist — that's fine), clear stale profiles (`rm -rf /tmp/agent-browser-chrome-* /tmp/agent-browser-profile-*`), archive the error file, and relaunch with a LONGER window (`--max-minutes 12`, `--poll-seconds 30`). In this session attempt 2 succeeded (`devin-flags.md`, analysis "up to date", clean) — turning a would-be ABSTAIN_INFRA into a real WOULD_APPROVE (shader-slang/slang#12068).

**Fix:** Persist through one Devin retry on the Devin-only tier specifically, because there Devin is the only signal and its loss forces an infra-abstain. (On the primary/harvest tier a Devin failure is merely best-effort — the bot review already carries the verdict — so no retry is needed there.) Only after a clean-state retry also fails to settle within the extended window do you record ABSTAIN_INFRA:NO_REVIEW_SIGNAL, noting both attempts. Monitor the run with a background Monitor watching for flags-file OR error-file OR process-exit so you don't burn turns polling.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783993723797-approver-infra-abstain-devin-only-tier-retry-a-tim.md`_
