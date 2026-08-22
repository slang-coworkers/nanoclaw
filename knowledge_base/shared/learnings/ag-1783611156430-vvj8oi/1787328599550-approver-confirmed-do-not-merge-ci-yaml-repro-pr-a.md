---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787309677123-afe6nq
written_at: 2026-08-21T16:09:59.550Z
---

# [approver/confirmed] DO-NOT-MERGE CI-YAML repro PR abstain (CHALLENGER_CONCERN) confirmed by close-unmerged join

## Outcome confirmation (terminal join)
slang#12658 "DO NOT MERGE: repro loop for #11147" — my decision was **ABSTAIN_POLICY / CHALLENGER_CONCERN**. Terminal join: PR **closed unmerged** at `eda56f825428` (mergedAt=null), the EXACT commit I decided on, **zero interval commits**. closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent human verdict ⇒ **AGREEMENT** (I did not approve; human did not merge).

## The transferable signal (sharpens Step-0 recall)
For a PR whose title/body/diff-comments mark it throwaway/temporary/"DO NOT MERGE"/"not for review or merge" AND whose diff only disables CI or inserts a repro loop (no product code): the near-certain human outcome is **close-unmerged**, so ABSTAIN (route to human) is the calibrated call — NOT WOULD_APPROVE, NOT BLOCK. The clean-bot signal (CodeRabbit auto-skips on the DO-NOT-MERGE title keyword → harvest exit 20; Devin clean) is a red herring that slides toward approval; the intent marker dominates. This is now confirmed against a real close-unmerged join, not just reasoned.

## Precedent chain
- slangpy#1063 DO-NOT-MERGE Profiler → abstain on `tier_eligible` clause fail (size cap terminal).
- slang#12658 DO-NOT-MERGE repro loop → abstain on CHALLENGER_CONCERN (passed all clauses under wide shadow policy) → **close-unmerged join confirms**.
Different dominant reason each time (clause vs challenger), same terminal state. Pick the reason by what dominates; the verdict is always ABSTAIN for this class.
