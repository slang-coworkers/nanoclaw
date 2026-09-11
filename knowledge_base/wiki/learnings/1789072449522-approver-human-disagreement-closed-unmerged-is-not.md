---
title: "[approver/human-disagreement] closed-unmerged is NOT reliably a REJECTED verdict — a fork-head PR is often superseded by a maintainer's same-repo re-creation that merges the same change; the head_provenance ABSTAIN predicted the real completion blocker"
type: learning
topic: review-approval
source: learnings/1789072449522-approver-human-disagreement-closed-unmerged-is-not.md
---

# [approver/human-disagreement] closed-unmerged is NOT reliably a REJECTED verdict — a fork-head PR is often superseded by a maintainer's same-repo re-creation that merges the same change; the head_provenance ABSTAIN predicted the real completion blocker

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788201669194-g6v28y
written_at: 2026-09-10T20:34:09.522Z
---

# [approver/human-disagreement] closed-unmerged is NOT reliably a REJECTED verdict — a fork-head PR is often superseded by a maintainer's same-repo re-creation that merges the same change; the head_provenance ABSTAIN predicted the real completion blocker

**Terminal calibration — shader-slang/slang#12840.** I ABSTAIN_POLICY'd across all 5 wakes on `head_provenance` (fork head `fknfilewalker/slang`) + non-green CI. The PR was ultimately **closed unmerged** — but NOT rejected: the closing comment said "Closing because the other PR is merged: #12986," and #12986 (same change, "Fix matrix layout specialization by giving the layout its own type," authored by maintainer jkwak-work from a **same-repo/non-fork** branch) **MERGED 2026-09-10**. So the change was ACCEPTED; only the *vehicle* changed.

**Why the fork PR couldn't ship (the vindication of head_provenance).** The maintainer stated the recreation was needed "due to the security setup reason" — the fix required a **workflow change to cherry-pick the cross-repo SlangPy-side change** (companion slangpy#1135: two `.slang` sites failing `E30019 int→MatrixLayoutMode`, a circular CI gate). A **fork PR cannot run CI that needs repo secrets / workflow permissions**, so the cross-repo coordination could only be driven from a same-repo PR. The `head_provenance` (fork) ABSTAIN was therefore not mere policy caution — it correctly anticipated that this fork PR could not complete as-is. Class of signal to recall: *a fork-head PR whose completion depends on secret-gated CI or a cross-repo companion/cherry-pick workflow is very likely to be superseded by a maintainer's same-repo re-creation.*

**Calibration rule (important for human-verdict joins).** Do NOT blindly map `pr_closed & merged=false` to REJECTED/CHANGES_REQUESTED-equivalent. First read the closing comments for "closing in favor of / superseded by #M" and check whether #M merged. If a superseding/dedup PR carried the same change to merge, the change was **ACCEPTED** (≈ APPROVED-equivalent for the change, authored under a different PR number) — counting it as REJECTED would mis-calibrate the approver against reality. (Here it didn't affect scoring since ABSTAIN rows are excluded, and `record_human_verdict` is not available in this toolset anyway, but the mapping nuance is the durable lesson.)

**Net:** every ABSTAIN on #12840 was the correct safe call — the PR never became auto-approvable (fork + never-green CI), and the accepted outcome arrived through a different, policy-eligible PR.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789072449522-approver-human-disagreement-closed-unmerged-is-not.md`_
