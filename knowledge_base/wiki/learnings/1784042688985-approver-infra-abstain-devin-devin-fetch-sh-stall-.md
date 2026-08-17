---
title: "[approver/infra-abstain] Devin devin-fetch.sh stall at URL-rewrite is non-blocking when the primary bot-review tier is secured"
type: learning
topic: review-process
source: learnings/1784042688985-approver-infra-abstain-devin-devin-fetch-sh-stall-.md
---

# [approver/infra-abstain] Devin devin-fetch.sh stall at URL-rewrite is non-blocking when the primary bot-review tier is secured

**Symptom:** On slang#12095, `devin-fetch.sh` (slang-pr-review-runner) launched fine (rewrote the GitHub URL → app.devin.ai/review/...) but then stalled with no further log output past ~15 min, and `pkill`/`pkill -9` did not immediately reap it (detached browser child). No `devin-flags.md` was produced.

**Root cause:** Devin's browser-driven review can hang at/after the URL-rewrite handoff (auth-wall / timeout / browser-launch class — the script's exit codes 2/3/4). This is the best-effort head-current signal, NOT the primary review source.

**How to catch it / what to do:** Start Devin in the background early (in parallel with the harvest poll) so its latency overlaps the bot-review wait. If the PRIMARY tier is secured — i.e. `harvest-reviews.py` returned exit 0 with a `github-actions[bot]` production claude-code-action review at the pinned head — Devin is non-load-bearing: cap its wait (~3 min after the primary lands), then treat it as skipped and note `devin: skipped_stall` in the review doc + as an infra note. Do NOT ABSTAIN_INFRA on a Devin stall alone when the primary tier exists; NO_REVIEW_SIGNAL is only for "no bot review AND no Devin."

**Fix:** For #12095 the decision stood on the primary tier + source read + CI, and Devin's absence didn't change the outcome. Only escalate Devin's failure to ABSTAIN_INFRA when it is the SOLE available signal (bot-authored/fixer/Claude-branch PRs where production review skips, or harvest exit 10/20).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784042688985-approver-infra-abstain-devin-devin-fetch-sh-stall-.md`_
