---
title: "[approver/infra-abstain] Devin timeout + bot-authored PR = NO_REVIEW_SIGNAL despite clean CI"
type: learning
topic: review-process
source: learnings/1784695299892-approver-infra-abstain-devin-timeout-bot-authored-.md
---

# [approver/infra-abstain] Devin timeout + bot-authored PR = NO_REVIEW_SIGNAL despite clean CI

**Symptom:** slangpy#1071 (bot-authored, `nv-slang-bot[bot]` — a rebased takeover of a human PR) recorded ABSTAIN_INFRA / NO_REVIEW_SIGNAL even though the change was tiny, CI fully green, and the approver's own investigation found no red flag.

**Root cause (the two named artifacts that failed):**
1. `collect-reviews.sh` exit 20 — no harvestable bot review. Production `claude-pr-review.yml` / claude-code-action genuinely SKIPS bot-authored branches, and CodeRabbit posted nothing. Expected for this PR class.
2. `devin-fetch.sh` SKIPPED:timeout — agent-browser drove headless Chromium against `app.devin.ai/review/...` but never progressed past the URL-rewrite step; >12 min, no `devin-flags.md`, no exit code. Had to be killed.

Exit-20 alone is NOT an abstain (Devin-only tier decides). But exit-20 AND a Devin failure = the `reviewers_complete=false` harness-integrity case → ABSTAIN_INFRA:NO_REVIEW_SIGNAL. Correct per procedure.

**How to catch it / what to watch:** On the Devin-only tier (bot-authored / fixer / Claude-branch PRs), the whole decision hinges on ONE fragile signal — the browser-driven Devin fetch. When it hangs, there is no fallback and the PR abstains regardless of how safe it looks. This is the dominant infra-abstain driver for bot-authored PRs. Two burn-down levers: (a) make devin-fetch fail-fast (it hung silently past URL rewrite with no internal timeout — a ~5min hard cap inside the script would have returned a clean skip instead of a 12-min hang); (b) if the Devin-only tier keeps abstaining on trivially-safe bot-authored test-only PRs, that's a policy question for humans, not a reason to self-review — the procedure explicitly forbids substituting the approver's own investigation for the missing review verdict.

**Fix (procedure worked; infra needs hardening):** decision was correct. The fix is on devin-fetch.sh reliability/timeout, tracked as an infra-abstain data point. Do NOT round up to WOULD_APPROVE from investigation — investigation only adds caution, never manufactures a review signal.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784695299892-approver-infra-abstain-devin-timeout-bot-authored-.md`_
