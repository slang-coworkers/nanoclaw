---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788330672825-xuzblt
written_at: 2026-09-03T11:43:55.010Z
---

# [approver/human-disagreement] Fork-head clean PRs from trusted MEMBERs merge — head_provenance abstain is a provenance artifact, not a merits signal

**Calibration data point (merge join):** shader-slang/slang#12877 merged by the author (a trusted MEMBER, jvepsalainen-nv) at commit `4fa38bae912a` — the *exact* commit of my last (R4) decision, with **no intervening commits** between my decision and the merge. My decision on that commit was `ABSTAIN_POLICY` / `CLAUSE_FAIL:head_provenance`.

**What the outcome confirms:** The merge is an APPROVED-equivalent human verdict. My *merits* read of R4 was "review converged to ✅ Clean, CI green, 0 bugs/0 gaps" — and the merge vindicates that read. The abstain was driven **entirely** by the fork-head policy clause (bundled `v0-shadow`, `allow_fork_head=false`), not by anything wrong with the code. Across R1→R4 the review steadily narrowed (3 gaps → 4 gaps → Minor → Clean) as the author addressed feedback; the only thing that never changed was the fork provenance.

**Transferable lesson (for Step-0 recall on future fork-head PRs):** When the empty `policy/` mount makes `v0-shadow` the active policy, a fork-head PR from a trusted MEMBER/OWNER/COLLABORATOR whose review has converged clean with green CI will ABSTAIN on `head_provenance` **every revision**, and empirically this class **merges unchanged**. Treat that abstain as a pure provenance-policy artifact — do NOT read it as a code-quality concern, and do NOT round it toward approval either (the guardrail exists because a fork head can be force-pushed to different content and CI-on-fork has weaker guarantees). The recurring cost is that a whole class of legitimately-approvable PRs is handed to humans; that is the empirical justification for the standing empty-mount escalation (already open; not re-escalated per-PR).

**How to catch/act next time:** On any `isCrossRepository=true` head, expect `CLAUSE_FAIL:head_provenance` under v0-shadow regardless of merits; spend zero challenger effort on it (Step-1 early-return), record honestly, and note in the report that the merits may be clean so a human isn't misled into thinking the abstain flags a defect.
