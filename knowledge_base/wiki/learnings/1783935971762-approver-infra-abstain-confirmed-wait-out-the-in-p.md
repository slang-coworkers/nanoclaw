---
title: "[approver/infra-abstain] Confirmed: wait out the IN_PROGRESS production review before Devin-only; and debounce a head that moves mid-decision"
type: learning
topic: review-process
source: learnings/1783935971762-approver-infra-abstain-confirmed-wait-out-the-in-p.md
---

# [approver/infra-abstain] Confirmed: wait out the IN_PROGRESS production review before Devin-only; and debounce a head that moves mid-decision

**Symptom:** PR shader-slang/slang#11977 harvest returned exit 10 (STALE ONLY — newest github-actions[bot] review was against an older commit than the pinned head). The naive path is "fall to Devin-only, note staleness." But a fresh production `review` check was IN_PROGRESS on the pinned head at the same time.

**Root cause:** A stale harvest + an in-progress review check is the same timing-race class as harvest exit 22 — the primary signal is imminent, not absent. Falling to Devin-only here discards the strongest signal (the production claude-code-action review) and is the root cause of prior `harvest_used=0` misses (slang#12064). Compounding wrinkle on this PR: the author was **actively iterating** — head moved 472e1e2 → 6f1a6b4 → d2b6269 during my polling, and again to ea4437f right after the decision was derived.

**How to catch it / what worked:**
1. On harvest exit 10/22 with a doc-review pending, check `gh pr view --json statusCheckRollup` for a `review` (Claude) check `IN_PROGRESS`/`PENDING` or a CodeRabbit status still running. If present, POLL it (~30s cadence, several-minute budget) and re-harvest when it settles. Here it took ~12 min of IN_PROGRESS before COMPLETED/SUCCESS, then re-harvest returned exit 0 (primary tier recovered, head-matched, non-stale).
2. Before committing to a head, DEBOUNCE: poll `headRefOid` until it's unchanged across a quiet window (~3 min). Build the review input ONCE on the settled head, not per-push. A head that moves during a poll means re-pin and restart the input build.
3. If the head moves AFTER the decision is derived (as here: ea4437f), record the decision for the commit you actually reviewed (one ledger row per (pr, revision commit)); the new head arrives as its own synchronize turn and gets its own decision. Do not retro-fit the old decision onto the new head.

**Fix / rule:** STALE-only harvest is not automatically Devin-only when a review is still running — the primary review is worth the wait. And an actively-iterating author demands a settle-then-build discipline, or you burn a full harvest+Devin cycle per push. Confirms and extends [[approver-infra-abstain-harvest-exit-timing-race]].

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783935971762-approver-infra-abstain-confirmed-wait-out-the-in-p.md`_
