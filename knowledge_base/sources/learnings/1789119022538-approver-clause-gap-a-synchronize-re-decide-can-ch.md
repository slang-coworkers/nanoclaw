---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788481356485-mgy3e9
written_at: 2026-09-11T09:30:22.538Z
---

# [approver/clause-gap] A "synchronize" re-decide can change scope — always re-read changed FILES, even when authorized to short-circuit

## Symptom
slangpy#1135 R1–R3 were all byte-identical merge-of-main commits (stable
CLAUSE_FAIL:author_trust abstain). On R4 the orchestrator explicitly said it was
"fine to short-circuit on the same grounds if this head is another such merge."
It was NOT another merge: the new head was "Bump SGL_SLANG_VERSION to 2026.17.1",
which added a THIRD changed file — `external/CMakeLists.txt` (a PROTECTED path) — and
DISMISSED both prior human approvals (reviewDecision → REVIEW_REQUIRED). Blindly
short-circuiting would have recorded the wrong reason_code and missed a protected-path
touch + a substantive pin-bump correctness question.

## Root cause
A `synchronize` webhook is just "the head moved." Across a companion-PR's life the
moves can be (a) merge-of-main no-ops (diff byte-identical) OR (b) real new commits
(here the merge-order "step 4" pin bump). Author-standing conditions (author_trust)
persist, but per-revision conditions (no_protected_paths, tier caps, ci) can flip.

## How to catch it
Cheap, mandatory first read on EVERY synchronize, before deciding how much to run:
`gh pr view <pr> --json changedFiles,additions,deletions,headRefOid,reviewDecision`
and `gh pr diff` — compare the changed-file SET and the blob index hashes to the last
head. Byte-identical blobs + same file set ⇒ genuine no-op (short-circuit is safe).
A new/changed file, a new path, or reviewDecision flipping REVIEW_REQUIRED (approvals
dismissed) ⇒ run the full procedure. A parent's "fine to short-circuit IF another such
merge" is conditional — the confirmation is yours to perform, not to assume.

## Fix / takeaway
- Never let "same as last time" or an upstream authorization skip the changed-files
  read. The one-line diff check is what distinguishes a no-op merge from a scope change.
- When multiple clauses FAIL, headline the revision-specific/substantive one
  (`no_protected_paths` for a build-file pin bump) so the ledger shows what CHANGED,
  and record the standing condition (author_trust) alongside — don't bury the new fact.
- Protected-path touches (here a `SGL_SLANG_VERSION` pin bump) are exactly what the
  clause exists to route to a human: the correctness question ("does the bumped release
  actually contain the needed symbol?") is real. Surface it for the human; the abstain
  defers it, it doesn't answer it.
