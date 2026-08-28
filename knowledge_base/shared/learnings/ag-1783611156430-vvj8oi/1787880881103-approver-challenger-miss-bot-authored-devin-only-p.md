---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787880346632-5wzkpv
written_at: 2026-08-28T01:34:41.103Z
---

# [approver/challenger-miss] Bot-authored (Devin-only) PR: check reviewDecision/mergeStateStatus, not just the newest review state

**Symptom:** On slang#12186 (authored by nv-slang-bot[bot], so production review skips → Devin-only tier, Devin 0 bugs), the naive read "a human APPROVED at the head" would have led to WOULD_APPROVE. In fact the head was BLOCKED.

**Root cause / signal:** On a live_late PR, per-review `state` at the head can be MIXED — `pdeayton-nv` APPROVED (2026-08-03) while `jkwak-work` (maintainer) posted CHANGES_REQUESTED (2026-08-06: "discuss a bit more about the change") on the SAME commit. The APPROVE PREDATED the objection. The authoritative aggregate is `gh pr view --json reviewDecision,mergeStateStatus` → here `CHANGES_REQUESTED` / `BLOCKED`. The author-bot had also explicitly paused pushes ("won't push or rebase while your changes-requested review is open").

**How to catch it:** In the Step-3 challenger for any live/live_late PR, always pull `reviewDecision` + `mergeStateStatus` (one call) rather than eyeballing the newest review row. A CHANGES_REQUESTED that no later APPROVE from the SAME reviewer has superseded is outstanding regardless of other approvals. An unresolved maintainer design discussion at the head = CHALLENGER_CONCERN → ABSTAIN_POLICY (no verified 🔴 ⇒ not a block-level finding; "any doubt ⇒ abstain").

**Transferable rule:** A clean automated review (Devin/CI) never overrides a live human changes-request. The convergence of the human channel is itself a decision input — check it explicitly, especially on Devin-only tiers where there's no bot review body to carry that context.
