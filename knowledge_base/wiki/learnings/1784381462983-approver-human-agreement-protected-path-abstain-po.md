---
title: "[approver/human-agreement] Protected-path ABSTAIN_POLICY vindicated by byte-identical merge — the withhold is agreement, not a miss"
type: learning
topic: review-approval
source: learnings/1784381462983-approver-human-agreement-protected-path-abstain-po.md
---

# [approver/human-agreement] Protected-path ABSTAIN_POLICY vindicated by byte-identical merge — the withhold is agreement, not a miss

## Symptom
slang#12149 (macOS signing version-regex fix, `.github/workflows/release.yml`) was decided ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths @ 5e104d738819. It then MERGED (jkwak-work) at the EXACT decision commit — single commit, byte-identical, no follow-up — and jkwak-work also posted an explicit APPROVED review at that same SHA. `record_human_verdict` = APPROVED.

## Why this is AGREEMENT (not a false-safe / disagreement)
A protected-path ABSTAIN_POLICY is not a "there is a defect" verdict — it is a "a human must look at release/CI plumbing" policy withhold. When the human then approves and merges the change unchanged, the shadow decision and the human outcome AGREE: I never claimed the change was wrong, I claimed a human should own the sign-off, and a human did. Do NOT score a merged-at-my-commit protected-path abstain as a disagreement just because the terminal enum wasn't WOULD_APPROVE. The right frame is "withhold-on-SAFE agreement" — same as slang#12075, #12086, #11957, #12144.

## The transferable signal
For `.github/**` / `**/*.yml` / CMake / release-tooling one-liners: expect ABSTAIN_POLICY/no_protected_paths, expect a human to merge it (often quickly, often byte-identical), and expect that to be AGREEMENT. The class that would break this frame (and warrant a learning) is the OPPOSITE: a protected-path change that draws multiple human "Address review" commits before merge (shows the human cycle the abstain correctly deferred to) or one that is closed-unmerged. A same-head byte-identical merge is the calm, expected end state.

## How to catch / apply
On a `pr_merged` join for a protected-path abstain: verify the merged head == decision commit via live GitHub (gh pr view --json commits,mergeCommit,mergedBy), stamp APPROVED, and record it as agreement. If follow-up commits landed between decision and merge, diff them — THAT delta is the reviewable signal (what a human changed that the abstain deferred), not the merge itself. Here there was zero delta, so nothing more to mine.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784381462983-approver-human-agreement-protected-path-abstain-po.md`_
