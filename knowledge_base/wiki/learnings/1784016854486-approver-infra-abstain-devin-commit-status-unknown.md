---
title: "[approver/infra-abstain] Devin commit-status 'unknown' ≠ ABSTAIN — verify the flagged finding on the pinned head instead"
type: learning
topic: review-approval
source: learnings/1784016854486-approver-infra-abstain-devin-commit-status-unknown.md
---

# [approver/infra-abstain] Devin commit-status "unknown" ≠ ABSTAIN — verify the flagged finding on the pinned head instead

**Symptom:** On a `synchronize` revision (slang#11979 rev2, head 2bd14efb01a1), `devin-fetch.sh` exited 0 but `devin-commit-status.txt` read `"unknown"` (rev1 had "Analysis is up to date"), and Devin's process-report narrative still described the PRE-revision code (the old compile-order comment). Strong sign Devin served a CACHED prior-revision analysis rather than re-analyzing the new head.

**Why it's a trap:** Devin-only fallback tier means Devin is the sole review signal. A stale/cached Devin analysis technically "completed" (exit 0, reviewers_complete=true), so the harness won't auto-abstain — but its findings describe the wrong commit. Naively trusting it could (a) miss a defect introduced by the new revision, or (b) carry a finding that the new revision already fixed.

**How to catch it:** Check `devin-commit-status.txt`. If it's `"unknown"` (not "up to date"), and/or the AI-analysis narrative references code/comments that the revision's diff changed, treat Devin as possibly-cached. Don't grep the page for the head SHA — Devin's page rarely prints it.

**Fix (don't abstain — verify):** A cached Devin is NOT automatically ABSTAIN_INFRA (STALE_STAGE) — that would burn the infra gate on a recoverable case. Instead, do the challenger's job directly against the PINNED head: (1) pull the rev1→rev2 delta (`gh api .../compare/<prev>...<head> --jq '.files[].patch'`), (2) confirm each Devin-flagged finding is still present (or now fixed) in the new diff — a finding you verify byte-for-byte on the pinned head stands regardless of Devin's cache state, and (3) eyeball the revision-NEW regions Devin may not have seen, since a cached run definitionally didn't analyze them. If the flagged 🔴 is verified present on the head and the new regions are clean, BLOCK/decide on that verified basis. Only escalate to ABSTAIN_INFRA if you genuinely can't verify the signal against the head. codex DECISION_REVIEW agreed: "stale bot review plus completed Devin is a fallback signal, and the challenger independently verified the blocking bug on the pinned head" — so no abstain.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784016854486-approver-infra-abstain-devin-commit-status-unknown.md`_
