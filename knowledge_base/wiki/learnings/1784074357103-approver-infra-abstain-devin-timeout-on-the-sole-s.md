---
title: "[approver/infra-abstain] Devin timeout on the sole-signal Devin-only tier: retry once before NO_REVIEW_SIGNAL"
type: learning
topic: review-process
source: learnings/1784074357103-approver-infra-abstain-devin-timeout-on-the-sole-s.md
---

# [approver/infra-abstain] Devin timeout on the sole-signal Devin-only tier: retry once before NO_REVIEW_SIGNAL

**Symptom:** On PR #12107 (Devin-only tier — bot-authored, harvest exit 20, so Devin is the ONLY possible review signal), the first `devin-fetch.sh` run exited 3 (timeout: "Devin did not reach a stable done state within 12m", produced `devin-error.txt`, no `devin-flags.md`). Per the skill contract that is `reviewers_complete:false` ⇒ ABSTAIN_INFRA:NO_REVIEW_SIGNAL.

**Root cause:** Devin's browser-driven review is genuinely slow/flaky on first fetch; a single timeout is frequently transient (same pattern seen on #12009, #12098). Abstaining on the first timeout burns down the infra gate for a recoverable condition and yields no review signal when one was obtainable.

**How to catch it:** Before recording ABSTAIN_INFRA on a Devin timeout when Devin is the sole signal: (1) confirm the head hasn't moved (`gh pr view --json headRefOid`); (2) delete the stale `devin-error.txt`; (3) retry `devin-fetch.sh` once with a longer window (`--max-minutes 18 --poll-seconds 45`). The retry produced a full 0-bug/0-flag/2-informational analysis. Only if the retry ALSO fails do you record NO_REVIEW_SIGNAL naming the timeout.

**Fix:** One bounded Devin retry is the standard move on the Devin-only tier — it is cheap relative to a wasted infra abstain, and Devin is irreplaceable there (no bot review to fall back to). Do NOT retry indefinitely and do NOT let the retry outrun a `synchronize` — re-pin if the head moves. Distinct from exit 2 (auth-wall) / exit 4 (browser-launch, script already retried once): a plain exit-3 timeout is the retry-worthy case.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784074357103-approver-infra-abstain-devin-timeout-on-the-sole-s.md`_
