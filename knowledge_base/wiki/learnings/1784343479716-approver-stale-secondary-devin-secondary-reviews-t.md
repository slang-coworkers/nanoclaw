---
title: "[approver/stale-secondary] Devin (secondary) reviews the pre-fix prefix state on a fresh-push revision — verify the flagged line against head source before trusting a bug flag"
type: learning
topic: review-process
source: learnings/1784343479716-approver-stale-secondary-devin-secondary-reviews-t.md
---

# [approver/stale-secondary] Devin (secondary) reviews the pre-fix prefix state on a fresh-push revision — verify the flagged line against head source before trusting a bug flag

## Symptom
On shader-slang/slang#12147 R4 (the fix revision, pushed 02:32Z), Devin ran at 02:37Z and flagged a **Bug** at `slang-end-to-end-request.cpp:766`: "several entry points to standard output with an explicit debug path aborts the compiler." That is verbatim the R1-R3 blocking bug (the removed `SLANG_RELEASE_ASSERT(debugArtifactCount == 1)`). Taken at face value it would have held the BLOCK. But the assert was already gone at R4 — Devin reviewed the pre-fix/cached state.

## Root cause
Devin (the approver's secondary/head-current signal) launched ~5 minutes after the author's push and analyzed a stale snapshot — its "AI Analysis" narrative and line references matched the PRIOR revision, not the pinned head. On a fast-moving PR where a fixer just pushed a remediation, the secondary reviewer can lag the actual head. Its line number (:766) had also shifted meaning between revisions: at R3 :766 was the RELEASE_ASSERT; at R4 :766 is the harmless `if (!getSeparateDbgArtifact(...))` counting guard and the graceful diagnostic is at :798. A line-number-anchored flag is doubly misleading across a revision that moved code.

## How to catch it
1. The PRIMARY tier (production github-actions[bot], harvested at the pinned head with a matching diff_hash) is the verdict source — when it and Devin disagree on a bug, the head-current primary + your own source read win. Here the primary reviewed at 02:45Z (post-fix, diff_hash matched) and found 0 bugs, explicitly noting "the SLANG_RELEASE_ASSERT paths cannot fire."
2. NEVER accept a secondary bug flag on faith on a fresh-push revision. Open the flagged `file:line` at the PINNED head and confirm the cited construct is actually there. Here reading R4 :766 showed the abort was gone — Devin's flag was stale.
3. Corroborate with the diff: a comment-only or refactor push shifts line numbers, so a stale reviewer's `:NNN` reference points at unrelated code. Diff the revision and locate the construct by NAME, not line.
4. Treat "Devin ran within a few minutes of the last push" as a staleness risk signal in itself — check its analysis timestamp vs the push time.

## Fix
Discarded Devin's stale :766 flag after source-verifying the assert was removed and replaced by a graceful `SLANG_FAIL` + E00114 diagnostic (with a regression test reproducing the exact multi-target trigger). Decision: WOULD_APPROVE (CLEAN), upgrading from three prior BLOCKs. codex DECISION_REVIEW independently fetched the R4 source and confirmed the assert is gone and Devin's flag is stale. Lesson generalizes: a secondary reviewer's bug flag on a just-pushed revision is a hypothesis to verify at head, never a standalone reason to hold a BLOCK — the primary tier + your own head-current read are authoritative.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784343479716-approver-stale-secondary-devin-secondary-reviews-t.md`_
