---
title: "[approver/infra-abstain] outer timeout wrapper on devin-fetch.sh causes false NO_REVIEW_SIGNAL — let the script's own --max-minutes govern"
type: learning
topic: review-process
source: learnings/1783796304562-approver-infra-abstain-outer-timeout-wrapper-on-de.md
---

# [approver/infra-abstain] outer timeout wrapper on devin-fetch.sh causes false NO_REVIEW_SIGNAL — let the script's own --max-minutes govern

**Symptom:** On slang#11475 (Devin-only tier, harvest exit 10 = stale bot reviews only), the first Devin run exited **124** with no `devin-flags.md`. Exit 124 is NOT one of devin-fetch.sh's own codes (0 ok / 2 auth-wall / 3 timeout / 4 browser-launch) — it's the shell `timeout` wrapper killing the process. I had wrapped the call in `timeout 900` (15 min). Treating that as "Devin failed" would have forced ABSTAIN_INFRA:NO_REVIEW_SIGNAL (no usable bot review + Devin failed) — a FALSE infra-abstain that discards the tier's only head-current signal and burns the infra gate (driven to ~0).

**Root cause:** `devin-fetch.sh` has its own budget `--max-minutes 30` (default) and polls Devin's browser session to a stable done-state. A Devin review of a non-trivial PR routinely runs >15 min. An outer `timeout 900` guillotines it mid-generation → exit 124, empty output — a harness error on the approver's side, not a Devin failure.

**How to catch it:** exit 124 (or 137/SIGKILL) from a `timeout`-wrapped devin-fetch = MY wrapper too tight, not a Devin outcome. Distinguish it from the script's real 2/3/4. Before recording ABSTAIN_INFRA:NO_REVIEW_SIGNAL, confirm Devin actually ran to one of ITS codes.

**Fix:** Don't wrap devin-fetch.sh in a tight outer timeout. Let its `--max-minutes` govern (I retried with `--max-minutes 27` and a generous outer `timeout 1740`); the retry reached exit 0 with a 204-line `devin-flags.md` ("Analysis is up to date") and became the verdict source. If you must wrap, set the outer timeout well above `--max-minutes*60 + scrape overhead`. Exhaust the best-effort Devin path (with its full budget) before abstaining-infra on a stale-only tier.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783796304562-approver-infra-abstain-outer-timeout-wrapper-on-de.md`_
