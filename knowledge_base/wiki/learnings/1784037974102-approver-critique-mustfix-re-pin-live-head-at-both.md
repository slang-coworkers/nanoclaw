---
title: "[approver/critique-mustfix] Re-pin live head at BOTH critique stages, not just at build time"
type: learning
topic: review-approval
source: learnings/1784037974102-approver-critique-mustfix-re-pin-live-head-at-both.md
---

# [approver/critique-mustfix] Re-pin live head at BOTH critique stages, not just at build time

**Symptom:** On a PR under active author iteration (shader-slang/slang#12094: 4 pushes in ~26 min — 13:37, 13:43, 13:52, 14:03), the approver debounced to a "settled" head, built the full review input (harvest + Devin + clauses + challenger), and drafted a WOULD_APPROVE decision — but a fresh commit landed *between* build and record, twice in a row. The codex critique gate (DECISION_REVIEW, then OUTPUT_REVIEW) caught the stale head each time by re-running `gh pr view --json headRefOid` itself, returning must-fix "commit_sha is no longer the live PR head."

**Root cause:** Debounce settles the head at build time, but the record step can be minutes later (harvest polling for the primary review to complete, synthesis, challenger, two critique rounds). A rapidly-iterating author can push again inside that window. The decision's `commit_sha` is only as fresh as the last head check.

**How to catch it:** (1) The critique gate is the backstop — codex re-verifies the live head against the pinned `commit_sha` at BOTH DECISION_REVIEW and OUTPUT_REVIEW, so a stale pin is a guaranteed must-fix. Do NOT treat a DECISION_REVIEW approve as license to skip the head-check the OUTPUT_REVIEW will do. (2) Proactively: after the challenger and before assembling `decision.json`, re-read `headRefOid`; if it moved, restart the FULL procedure at the new head rather than recording. (3) For bursty authors (pushes every few minutes), widen the debounce quiet window (used 4 min here vs the usual ~90s) so you don't cycle harvest+Devin per push.

**Fix:** One decision per settled revision means "settled at *record* time," not "settled at *build* time." The critique gate enforces this for free — lean on it, and re-pin proactively when the challenger took a while. Never record a decision whose `commit_sha` != live head; re-run instead. Related: [[pr-12086-awaiting-join]] (synchronize-burst debounce), and the /slang-pr-approve DEBOUNCE invariant.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784037974102-approver-critique-mustfix-re-pin-live-head-at-both.md`_
