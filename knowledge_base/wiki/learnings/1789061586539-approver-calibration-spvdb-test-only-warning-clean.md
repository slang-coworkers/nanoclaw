---
title: "[approver/calibration] spvdb test-only warning-cleanup WOULD_APPROVE merged verbatim at same SHA (slang#12993) — confirms eligibility-clause routing"
type: learning
topic: review-approval
source: learnings/1789061586539-approver-calibration-spvdb-test-only-warning-clean.md
---

# [approver/calibration] spvdb test-only warning-cleanup WOULD_APPROVE merged verbatim at same SHA (slang#12993) — confirms eligibility-clause routing

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789056898018-6jc0xs
written_at: 2026-09-10T17:33:06.539Z
---

# [approver/calibration] spvdb test-only warning-cleanup WOULD_APPROVE merged verbatim at same SHA (slang#12993) — confirms eligibility-clause routing

**Outcome (calibration join):** slang#12993 "tests/spvdb/lib: Clean up warnings" — I decided WOULD_APPROVE @ 3bbeab30d875; the PR **merged at that exact commit** (n_commits=1, merged head == decided head, zero follow-up commits). My call matched the human outcome. Second confirming datapoint for the spvdb/test-only class after slang#12896.

**Transferable signal — this shape is reliably safe to approve:** a diff confined to `tests/spvdb/lib/` (a standalone SPIR-V debug/interpreter helper, nothing under source//include//prelude/), consisting only of (a) `= {}` designated-initializer no-ops on members that already default-construct empty, and (b) dead-code removal verified unreferenced at head. When the eligibility clauses all pass (trusted author, CI green, no protected paths, within size caps) and the primary review + Devin are clean, the correct routing is WOULD_APPROVE, and it ships verbatim. Blast radius is a non-shipping test/tooling tree; there was nothing for a human to change.

**Two traps I checked and cleared (don't skip these on a "merged" join):**
1. **Author self-merge ≠ zero-review.** merged_by = skiminki-nv = the PR author. In isolation an author self-merge is a *weak* human signal (the slang#12859 trap). Here it was backed by an **independent MEMBER APPROVE** (jkiviluoto-nv) at the same commit, so the join is trustworthy — always check whether an independent approval exists before treating "merged" as validation.
2. **Merged-head vs decided-head delta.** Confirmed n_commits=1 and last_commit == my decided SHA, so there is genuinely no post-decision human churn to mine — the merge commit (928f4010) is just the squash/merge of the single reviewed commit, not new work.

**Net:** no procedure change needed; the clause-first routing and the clean-review→approve mapping were correct. Recording the positive datapoint so Step-0 recall on the next spvdb/test-only cleanup carries a confirmed "safe, merges verbatim" prior rather than only the disagreement/abstain exemplars.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789061586539-approver-calibration-spvdb-test-only-warning-clean.md`_
