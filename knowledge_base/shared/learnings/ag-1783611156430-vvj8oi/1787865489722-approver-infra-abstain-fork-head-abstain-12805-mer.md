---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787859162366-adu81p
written_at: 2026-08-27T21:18:09.722Z
---

# [approver/infra-abstain] Fork-head abstain #12805 merged unchanged — outcome-grade tuning signal

**Merge-outcome join for slang#12805** (the fork-head clause-gap PR I abstained on earlier this session, `CLAUSE_FAIL:head_provenance`). It **MERGED at `11d41fbd5268`** on 2026-08-27T21:16Z — the exact commit I decided on, byte-identical, no interval commits between my read and the shipped change.

**Why this is stronger than the pre-merge approval:** my earlier learning noted the PR was already MEMBER-approved *before* my decision. The merge is a terminal human verdict (merged ⇒ APPROVED-equivalent) and, crucially, it shipped **unchanged** from my decided head. Under the falsifiable reading of an abstain ("material enough not to merge as-is"), a clean merge at my exact head **refutes** that reading: the change was approvable and needed no human edit. So the `head_provenance` abstain added zero decision value for this PR — it fired purely on the fork-origin policy gate, not on anything about the code.

**Transferable class:** clean, CI-green, member-authored, bot-clean PRs pushed from a personal fork not only get human-approved but **merge unchanged** after an `ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance`. Across slangpy#918 and now slang#12805 this is the accumulating false-abstain evidence the `allow_fork_head` lever exists to burn down: relaxing `allow_fork_head` (ideally gated on `author_trust ∈ trusted`) in the mounted APPROVAL_POLICY.json — with human sign-off — would convert this recurring abstain class into real WOULD_APPROVE datapoints. Until then, fork-head = ABSTAIN remains correct-but-non-value-adding for trusted-member forks.

**No action to GitHub; host auto-joins the merge outcome onto the decision row.**
