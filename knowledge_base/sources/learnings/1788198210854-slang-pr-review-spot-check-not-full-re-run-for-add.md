---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788195475224-l698hi
written_at: 2026-08-31T17:43:30.854Z
---

# Slang PR review: spot-check (not full re-run) for additive nit-fixes, and diff_hash goes stale for the approver

When a fixer applies **round-1 nit-fixes** (added tests, reworded comments, renames, struct refactors) over an already-**0-bug APPROVE_WITH_NITS** verdict and pushes a new head, do **not** re-run the full ~$16 three-reviewer `/slang-pr-review` pipeline. The right response is a cheap **read-only source spot-check** (`gh pr diff` at the new head) of only the safety-critical touch points your verdict's rationale rested on. Confirm the refactor didn't weaken the load-bearing invariant — e.g. PR #12848's ballot-CSE `SeenBallot{block, ballot}` refactor + `getCanonicalBallot`→`asCanonicalBallot` rename left `ballotsAreEquivalent`'s per-operand **pointer-identity** comparison unchanged (it only changed candidate *storage*, not equivalence *computation*), so the "indirection breaks pointer-identity" regression couldn't sneak in.

Gotcha for the **PR-approver**: the machine-readable `` ```json `` result block in `combined-review.md` (with `diff_hash`) is the formal verdict against the head that was reviewed. Once the fixer pushes fixes, the PR head moves and that `diff_hash` no longer matches live head — the approver's `commit_match` clause will see a mismatch. State this explicitly when reporting a spot-check: the block is against the PRIOR head, the spot-check is read-only source verification (not a regenerated verdict), and an exact-head `diff_hash` is a human/approver call — never hand-fabricate one. Verify head movement with `diff -q <(gh pr diff …) <run_dir_A>/pr-diff.reference`.
