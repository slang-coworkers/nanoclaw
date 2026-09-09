---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787908591968-6i4ed4
written_at: 2026-08-28T09:44:22.928Z
---

# [approver/process] Re-verify PR head freshness at the RECORD step, not just at stage — a merge can land between stage and decide

**Symptom:** On slang#12626 I staged the PR at head `500f60b516ea`, ran the full
harvest+Devin+challenger pipeline, wrote the review doc and decision.md — then the
DECISION_REVIEW critique (codex) flagged that the head had advanced to `ccf3244aaabc`
mid-flight. The stale derivation would have recorded a decision for a commit that was
no longer the PR head.

**Root cause:** My pre-stage freshness check (`gh pr view --json headRefOid`) ran at
~09:16Z when the head genuinely WAS `500f60b`. A merge-of-master commit
(`ccf3244aaabc`) landed on the PR at 09:19:05Z — *during* my pipeline run (harvest +
two background Devin subagents take minutes). A point-in-time check at stage cannot
see a push that happens after it. This is not the same as the "stale replay" guard
(deciding a SHA already decided); it's the opposite — the world moved forward under a
correct-at-the-time stage.

**Why it mattered here specifically:** the mid-flight merge was not cosmetic — it
introduced `TraceCoverageBindlessIndex = 158` on master, colliding with this PR's
`CudaNoInlineThreshold = 158`. The settled head resolves the collision by renumbering
to 159. Recording against the stale head would have described an enum value that no
longer existed and missed the ABI-collision-resolution I needed to verify.

**How to catch it:** Re-run `gh pr view <pr> --json headRefOid` immediately BEFORE the
record step (and treat a mismatch as a `synchronize` revision → re-pin, full re-run),
not only at stage time. The critique gate is a backstop that caught it, but the check
is cheap and mechanical — bind it to the record decision point. Corollary: on any PR
whose base is being merged/rebased (bot fixer branches especially), expect the head to
move; the longer the pipeline (background Devin), the wider the race window.

**Fix:** Added to my decision procedure: a head-freshness re-check wired to the RECORD
step. Also: when Devin's `devin-commit-status.txt` reads "unknown" (popover render
race), do NOT rely on Devin for correctness — verify every load-bearing fact first-hand
from the clone at the pinned head (I did, so the re-run was fast).

Also confirmed: Devin's "HLSL gate arm is vacuous" flag on this PR was factually WRONG
— HLSL emits `[noinline]` at `slang-emit-hlsl.cpp:1740-1742`, so a `CHECK_HLSL-NOT:
[noinline]` arm is a meaningful cross-backend leak control. Carry-and-clear every Devin
observation from source; a fallback-tier flag is a prior to check, not a verdict.
