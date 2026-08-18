---
title: "[approver/infra-abstain] devin-fetch.sh timeout (exit 3) on fresh PRs — retry once before NO_REVIEW_SIGNAL"
type: learning
topic: review-process
source: learnings/1784019236976-approver-infra-abstain-devin-fetch-sh-timeout-exit.md
---

# [approver/infra-abstain] devin-fetch.sh timeout (exit 3) on fresh PRs — retry once before NO_REVIEW_SIGNAL

**Symptom:** On the Devin-only tier for shader-slang/slang#12090 (production claude-pr-review skipped because its `paths:` filter excludes `examples/**`), the FIRST `devin-fetch.sh` run hit its 30-min deadline and exited 3 (timeout, "Devin did not reach a stable done state") — no `devin-flags.md`, only `devin-error.txt`. With harvest already at exit 20 (no bot review object), that state is literally the SKILL's `NO_REVIEW_SIGNAL` condition (no bot review harvested AND Devin failed) → ABSTAIN_INFRA.

**Root cause:** On a fresh PR, Devin's analysis can still be settling when the fetch's poll window expires — the browser process was genuinely alive and churning CPU the whole time (renderer at 5+ min CPU), not hung. A first-attempt timeout is often a transient "not done yet," not a real signal failure. Devin is the SOLE signal on this tier, so a premature infra-abstain here throws away the only review the PR will get.

**How to catch it:** Before recording ABSTAIN_INFRA:NO_REVIEW_SIGNAL on the Devin-only tier, distinguish "Devin failed" from "Devin wasn't done yet." A single clean retry is cheap relative to burning the only signal: `rm -rf /tmp/agent-browser-chrome-*` (defensive stale-profile clear) then re-run `devin-fetch.sh`. On #12090 the retry returned exit 0 with a head-current analysis ("Analysis is up to date", 0 bugs / 0 flags / 3 informational), converting a would-be infra-abstain into a real APPROVE_WITH_NITS-tier signal that the challenger could act on. Only if the retry ALSO fails to reach a stable state is NO_REVIEW_SIGNAL the honest call.

**Fix:** Devin-only tier + first-attempt `devin-fetch.sh` timeout (exit 3) or transient browser-launch (exit 4) ⇒ retry once (clear chrome profile first) before treating it as NO_REVIEW_SIGNAL. This burns down the infra-abstain rate (a standing quality gate) without ever rounding up to approve — a genuine second failure still abstains honestly. Complements the existing `[approver/false-skips]` exec-bit note (that one is a permission-denied false-skip; this one is a poll-window-too-short false-timeout).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784019236976-approver-infra-abstain-devin-fetch-sh-timeout-exit.md`_
