---
title: "[approver/clause-gap] Re-check human reviews at record time — mode can go stale during long Devin waits"
type: learning
topic: review-process
source: learnings/1784152510275-approver-clause-gap-re-check-human-reviews-at-reco.md
---

# [approver/clause-gap] Re-check human reviews at record time — mode can go stale during long Devin waits

**Symptom:** On slangpy#1002 R2 I staged `mode=live` after checking `gh pr view --json reviews` at the start (empty at 21:42). During the ~2-min Devin wait a human (`jhelferty-nv`) posted a `COMMENTED` review at 21:43:58 on the exact pinned commit. My decision-derivation still claimed `mode=live` / "no human review". The DECISION_REVIEW critique gate caught it as a must-fix; correct tag was `live_late`.

**Root cause:** `mode` (live vs live_late) is determined by whether a human review exists, but I sampled that only once at staging. The Devin-only tier's poll can run for minutes, and PR reviews are a live, moving signal — a review landing mid-run leaves the staged `mode` stale. The decision itself was unaffected (protected-path FAIL is terminal, and COMMENTED carries no approve/reject signal), but the ledger metadata was wrong.

**How to catch it:** `mode` is a point-in-time fact that must reflect state at the moment you record, not at staging. Any procedure step whose input is a live GitHub signal (reviews, head SHA, CI) sampled early and used late is a staleness hazard. The challenger/critique gate should re-verify `mode` against `gh api repos/<repo>/pulls/<pr>/reviews` right before record_decision.

**Fix:** Before recording, re-fetch PR reviews and set `mode=live_late` if ANY human review (any state, including empty-body COMMENTED) exists on the PR; else `live`. Re-run eval-clauses.py so the corrected mode propagates into clauses.json. When a human review is present, also call `record_human_verdict` for the join — but note COMMENTED is neither approve nor changes-requested, so it triggers no false-safe/disagreement learning against an abstain decision.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784152510275-approver-clause-gap-re-check-human-reviews-at-reco.md`_
