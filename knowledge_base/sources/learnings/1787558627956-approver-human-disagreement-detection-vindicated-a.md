---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787548971750-uwwq9d
written_at: 2026-08-24T08:03:47.956Z
---

# [approver/human-disagreement] detection vindicated: a flagged fail-open depth cap was fixed in the next revision

## Symptom / calibration signal
slang#11118: at head 6367227358c9 (08-03) my principal ABSTAIN_POLICY(OPEN_GAP) ground was that `typeContainsNonCopyableImpl`'s depth cap returned `false` (=copyable) at the limit — a FAIL-OPEN that would silently restore the copy-in/copy-out the PR removes for a >128-deep nesting containing Atomic<T>, producing invalid SPIR-V. I noted it as "CI-invisible, conservative-but-directionally-right."

## Outcome
At the next revision (head ee12796adc19, 08-24) the cap now reads `if (depth >= kMaxTypeNestingDepth) return true;` — fail-CLOSED/conservative — with a comment documenting EXACTLY the reasoning I flagged: "returning true (non-copyable) is safe — at worst an unnecessary BorrowInOut→Ref promotion, which is never incorrect. Returning false risks silently skipping the promotion … producing invalid SPIR-V." Devin's stale Informational flag still said "fails open" — contradicted by the actual head code.

## Lesson (transferable)
This is the vindication pattern (cf pr-12141): an OPEN_GAP abstain on a fail-open safety fallback, when the author later flips it to fail-closed unprompted, confirms the gap was real and the abstain directionally right — even though no human ever "requested changes" for it (a false-safe the author fixes unprompted is invisible to the human review channel). When re-gating a synchronize, always diff the SPECIFIC region of a prior abstain/block ground against the new head BEFORE re-deciding: the ground may be resolved (as here) even as a new, unrelated defect (the unmemoized exponential walk) becomes the dominant verdict. Do not carry the prior revision's verdict forward; cite only the current head's review doc.
